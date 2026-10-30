import WebSocket from 'ws';
import { createRequire } from 'module';
import { FinderInfo, LiveChatItem, TikTokConnectionStatus } from '../shared/types';

const require = createRequire(import.meta.url);
let WebcastPushConnection: any = null;
try {
  const tiktokPkg = require('tiktok-live-connector');
  WebcastPushConnection = tiktokPkg.WebcastPushConnection;
} catch {
  // Handled gracefully if optional native dependency isn't loaded
}

export interface TikTokBridgeCallbacks {
  onChatGuess: (word: string, finder: FinderInfo, rawComment: string) => void;
  onEngagement: (finder: FinderInfo, type: 'like' | 'gift', count: number, giftName?: string) => void;
  onStatusChange: (status: TikTokConnectionStatus) => void;
}

export class TikTokLiveBridge {
  private callbacks: TikTokBridgeCallbacks;
  private tiktokConn: any = null;
  private tikfinityWs: WebSocket | null = null;
  private status: TikTokConnectionStatus = {
    connected: false,
    mode: 'webhook-ready',
    username: null,
    tikfinityUrl: null,
    viewerCount: 0,
    chatEventsProcessed: 0,
    guessesFromChat: 0,
    likesCount: 0,
    giftsDiamonds: 0,
    lastError: null,
  };

  constructor(callbacks: TikTokBridgeCallbacks) {
    this.callbacks = callbacks;
  }

  getStatus(): TikTokConnectionStatus {
    return { ...this.status };
  }

  async connectTikTokUsername(rawUsername: string): Promise<{ ok: boolean; error?: string }> {
    const clean = String(rawUsername || '').trim().replace(/^@/, '').toLowerCase();
    if (!clean) {
      return { ok: false, error: 'Please provide a valid TikTok @username' };
    }

    this.disconnect();

    if (!WebcastPushConnection) {
      this.status.lastError = 'tiktok-live-connector unavailable in environment; Webhook & Live Chat Bridge active.';
      this.callbacks.onStatusChange(this.getStatus());
      return { ok: false, error: this.status.lastError };
    }

    try {
      this.status.username = clean;
      this.status.lastError = null;
      const conn = new WebcastPushConnection(clean, {
        processInitialData: true,
        enableExtendedGiftInfo: true,
        requestPollingIntervalMs: 1000,
      });
      this.tiktokConn = conn;

      conn.on('chat', (data: any) => {
        const uid = String(data.uniqueId || data.userId || 'tiktok_viewer');
        const displayName = String(data.nickname || data.uniqueId || 'TikTok Viewer');
        const comment = String(data.comment || '').trim();
        this.ingestRawChatEvent({
          uniqueId: uid,
          displayName,
          profileImage: data.profilePictureUrl || null,
          comment,
        });
      });

      conn.on('like', (data: any) => {
        const uid = String(data.uniqueId || data.userId || 'tiktok_viewer');
        const displayName = String(data.nickname || data.uniqueId || 'TikTok Viewer');
        const count = Number(data.likeCount) || 1;
        this.ingestEngagementEvent('like', {
          uniqueId: uid,
          displayName,
          profileImage: data.profilePictureUrl || null,
          count,
        });
      });

      conn.on('gift', (data: any) => {
        if (data.giftType === 1 && !data.repeatEnd) return;
        const uid = String(data.uniqueId || data.userId || 'tiktok_viewer');
        const displayName = String(data.nickname || data.uniqueId || 'TikTok Viewer');
        const diamonds = (Number(data.diamondCount) || 1) * (Number(data.repeatCount) || 1);
        this.ingestEngagementEvent('gift', {
          uniqueId: uid,
          displayName,
          profileImage: data.profilePictureUrl || null,
          count: diamonds,
          giftName: data.giftName || 'TikTok Gift',
        });
      });

      conn.on('roomUser', (data: any) => {
        if (typeof data.viewerCount === 'number') {
          this.status.viewerCount = data.viewerCount;
          this.callbacks.onStatusChange(this.getStatus());
        }
      });

      conn.on('streamEnd', () => {
        this.status.connected = false;
        this.status.mode = 'webhook-ready';
        this.status.lastError = `@${clean} stream ended`;
        this.callbacks.onStatusChange(this.getStatus());
      });

      const state = await conn.connect();
      this.status.connected = true;
      this.status.mode = 'tiktok-live';
      this.status.viewerCount = state?.viewerCount || 1;
      this.callbacks.onStatusChange(this.getStatus());
      return { ok: true };
    } catch (err: any) {
      const msg = err?.message || 'Stream is currently offline or unreachable';
      this.status.connected = false;
      this.status.mode = 'webhook-ready';
      this.status.lastError = `@${clean}: ${msg} (Use Webhook or Streamer Chat Bridge below to test live chat guesses)`;
      this.callbacks.onStatusChange(this.getStatus());
      return { ok: false, error: this.status.lastError };
    }
  }

  connectTikFinityWebSocket(wsUrl: string): { ok: boolean; error?: string } {
    const cleanUrl = String(wsUrl || '').trim();
    if (!cleanUrl.startsWith('ws://') && !cleanUrl.startsWith('wss://')) {
      return { ok: false, error: 'URL must start with ws:// or wss://' };
    }

    this.disconnect();
    this.status.tikfinityUrl = cleanUrl;
    this.status.lastError = null;

    try {
      const ws = new WebSocket(cleanUrl);
      this.tikfinityWs = ws;

      ws.on('open', () => {
        this.status.connected = true;
        this.status.mode = 'tikfinity-ws';
        this.status.lastError = null;
        this.callbacks.onStatusChange(this.getStatus());
      });

      ws.on('message', (raw) => {
        try {
          const event = JSON.parse(raw.toString());
          this.handleWebhookOrTikFinityPayload(event);
        } catch {
          // ignore malformed payload
        }
      });

      ws.on('close', () => {
        this.status.connected = false;
        this.status.mode = 'webhook-ready';
        this.callbacks.onStatusChange(this.getStatus());
      });

      ws.on('error', (err) => {
        this.status.connected = false;
        this.status.mode = 'webhook-ready';
        this.status.lastError = `TikFinity WS error: ${err.message}`;
        this.callbacks.onStatusChange(this.getStatus());
      });

      return { ok: true };
    } catch (err: any) {
      this.status.lastError = err?.message || 'Failed to connect TikFinity WebSocket';
      this.callbacks.onStatusChange(this.getStatus());
      return { ok: false, error: this.status.lastError || undefined };
    }
  }

  disconnect() {
    if (this.tiktokConn) {
      try {
        this.tiktokConn.disconnect();
      } catch {}
      this.tiktokConn = null;
    }
    if (this.tikfinityWs) {
      try {
        this.tikfinityWs.close();
      } catch {}
      this.tikfinityWs = null;
    }
    this.status.connected = false;
    this.status.mode = 'webhook-ready';
    this.status.username = null;
    this.status.tikfinityUrl = null;
    this.callbacks.onStatusChange(this.getStatus());
  }

  handleWebhookOrTikFinityPayload(event: any) {
    if (!event || typeof event !== 'object') return;
    const type = event.event || event.type || 'chat';
    const data = event.data || event;

    if (type === 'like') {
      const uid = String(data.uniqueId || data.userId || data.username || 'tiktok_user');
      const displayName = String(data.nickname || data.displayName || uid);
      this.ingestEngagementEvent('like', {
        uniqueId: uid,
        displayName,
        profileImage: data.profilePictureUrl || null,
        count: Number(data.likeCount || data.count) || 5,
      });
      return;
    }

    if (type === 'gift') {
      const uid = String(data.uniqueId || data.userId || data.username || 'tiktok_user');
      const displayName = String(data.nickname || data.displayName || uid);
      const diamonds = Number(data.diamondCount || data.diamonds || data.giftValue || 10);
      this.ingestEngagementEvent('gift', {
        uniqueId: uid,
        displayName,
        profileImage: data.profilePictureUrl || null,
        count: diamonds,
        giftName: String(data.giftName || 'Galaxy Rose'),
      });
      return;
    }

    const comment = String(data.comment || data.message || data.text || '').trim();
    if (comment) {
      const uid = String(data.uniqueId || data.userId || data.username || 'tiktok_viewer');
      const displayName = String(data.nickname || data.displayName || uid);
      this.ingestRawChatEvent({
        uniqueId: uid,
        displayName,
        profileImage: data.profilePictureUrl || null,
        comment,
      });
    }
  }

  ingestRawChatEvent(payload: {
    uniqueId: string;
    displayName: string;
    profileImage?: string | null;
    comment: string;
  }) {
    this.status.chatEventsProcessed += 1;
    const finder: FinderInfo = {
      platform: 'tiktok',
      platformUserId: `tt_${payload.uniqueId.toLowerCase()}`,
      displayName: payload.displayName,
      profileImage: payload.profileImage || null,
    };

    // Extract candidate word guesses from the chat message (up to 3 words per chat line so viewers can type a word or short phrase)
    const tokens = (payload.comment.toLowerCase().match(/[a-z]{3,14}/g) || []).slice(0, 3);
    if (tokens.length === 0) return;

    for (const word of tokens) {
      this.status.guessesFromChat += 1;
      this.callbacks.onChatGuess(word, finder, payload.comment);
    }
    this.callbacks.onStatusChange(this.getStatus());
  }

  ingestEngagementEvent(
    type: 'like' | 'gift',
    payload: {
      uniqueId: string;
      displayName: string;
      profileImage?: string | null;
      count: number;
      giftName?: string;
    }
  ) {
    this.status.chatEventsProcessed += 1;
    if (type === 'like') this.status.likesCount += payload.count;
    if (type === 'gift') this.status.giftsDiamonds += payload.count;

    const finder: FinderInfo = {
      platform: 'tiktok',
      platformUserId: `tt_${payload.uniqueId.toLowerCase()}`,
      displayName: payload.displayName,
      profileImage: payload.profileImage || null,
    };
    this.callbacks.onEngagement(finder, type, payload.count, payload.giftName);
    this.callbacks.onStatusChange(this.getStatus());
  }
}
