import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import * as TikTokConnector from 'tiktok-live-connector';
import { createNewGameInstance, WiKirecGame } from './src/server/game.ts';
import type {
  AuthorizedUser,
  FinderInfo,
  GameMode,
  LiveChatItem,
  TikTokConnectionStatus,
} from './src/shared/types.ts';

// Support both WebcastPushConnection (v1) and TikTokLiveConnection (v2.1.1-beta1) with safe default options
const BaseTikTokConnection: any =
  (TikTokConnector as any).WebcastPushConnection ||
  (TikTokConnector as any).TikTokLiveConnection;

class WebcastPushConnection extends BaseTikTokConnection {
  constructor(username: string, options: Record<string, any> = {}) {
    super(username, options);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;

// Ensure Vite HMR WebSocket is disabled in middleware mode as required by AI Studio runtime
process.env.DISABLE_HMR = 'true';

interface ClientMeta {
  ws: WebSocket;
  sessionId: string;
  displayName: string;
  mode: GameMode;
  streamerUsername?: string | null;
}

function normalizeChatData(data: any) {
  const uniqueId = String(
    data?.uniqueId ||
      data?.user?.displayId ||
      data?.user?.uniqueId ||
      data?.username ||
      data?.user?.id ||
      'tiktok_viewer'
  );
  const nickname = String(
    data?.nickname ||
      data?.user?.nickname ||
      data?.displayName ||
      uniqueId
  );
  const comment = String(
    data?.comment ??
      data?.content ??
      data?.text ??
      data?.message ??
      ''
  ).trim();
  const profilePictureUrl = String(
    data?.profilePictureUrl ||
      data?.user?.profilePictureUrl ||
      data?.user?.avatarThumb?.urlList?.[0] ||
      data?.user?.avatarMedium?.urlList?.[0] ||
      data?.user?.avatarLarger?.urlList?.[0] ||
      data?.user?.profilePicture?.url?.[0] ||
      data?.user?.profilePicture?.urls?.[0] ||
      ''
  );

  return {
    uniqueId,
    nickname,
    comment,
    profilePictureUrl,
  };
}

function normalizeLikeData(data: any) {
  const uniqueId = String(
    data?.uniqueId ||
      data?.user?.displayId ||
      data?.user?.uniqueId ||
      data?.username ||
      data?.user?.id ||
      'tiktok_viewer'
  );
  const nickname = String(
    data?.nickname ||
      data?.user?.nickname ||
      data?.displayName ||
      uniqueId
  );
  const likeCount = Math.max(1, Number(data?.likeCount || data?.count || 1));
  const totalLikeCount = Number(data?.totalLikeCount || data?.total || likeCount);
  const profilePictureUrl = String(
    data?.profilePictureUrl ||
      data?.user?.profilePictureUrl ||
      data?.user?.avatarThumb?.urlList?.[0] ||
      data?.user?.profilePicture?.url?.[0] ||
      ''
  );

  return {
    uniqueId,
    nickname,
    likeCount,
    totalLikeCount,
    profilePictureUrl,
  };
}

function normalizeGiftData(data: any) {
  const uniqueId = String(
    data?.uniqueId ||
      data?.user?.displayId ||
      data?.user?.uniqueId ||
      data?.username ||
      data?.user?.id ||
      'tiktok_viewer'
  );
  const nickname = String(
    data?.nickname ||
      data?.user?.nickname ||
      data?.displayName ||
      uniqueId
  );
  const giftName = String(
    data?.giftName ||
      data?.gift?.name ||
      data?.giftDetails?.giftName ||
      data?.extendedGiftInfo?.name ||
      'TikTok Gift'
  );
  const diamondCount = Math.max(
    1,
    Number(
      data?.diamondCount ||
        data?.gift?.diamondCount ||
        data?.giftDetails?.diamondCount ||
        10
    )
  );
  const repeatCount = Math.max(1, Number(data?.repeatCount || 1));
  const repeatEnd = Boolean(data?.repeatEnd ?? true);
  const profilePictureUrl = String(
    data?.profilePictureUrl ||
      data?.user?.profilePictureUrl ||
      data?.user?.avatarThumb?.urlList?.[0] ||
      data?.user?.profilePicture?.url?.[0] ||
      ''
  );

  return {
    uniqueId,
    nickname,
    giftName,
    diamondCount,
    repeatCount,
    repeatEnd,
    profilePictureUrl,
  };
}

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = http.createServer(app);

  // Attach Socket.IO Server for real-time TikTok Live & Simulation events
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Attach WebSocketServer for "/ws" game state synchronization
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url ? request.url.split('?')[0] : '';
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  const clients = new Map<WebSocket, ClientMeta>();
  const soloGames = new Map<string, WiKirecGame>();
  const liveChatHistory: LiveChatItem[] = [];

  let multiplayerGame = await createNewGameInstance('multiplayer', `boot-${Date.now()}`);
  let wikiword4x4Game = await createNewGameInstance('wikiword-4x4', `boot4x4-${Date.now()}`);
  let mpCountdownInterval: NodeJS.Timeout | null = null;
  let wwCountdownInterval: NodeJS.Timeout | null = null;

  // Per-Streamer Session and TikTok Live Connection Store
  interface StreamerSession {
    username: string; // clean lowercase handle without @
    sessionId: string; // client tab session ID
    token: string;
    lastActivity: number;
    conn: any | null;
    reconnectTimer: NodeJS.Timeout | null;
    desiredLiveUsername: string | null;
    currentRoomId: string | null;
    status: TikTokConnectionStatus;
    chatHistory: LiveChatItem[];
  }

  const activeStreamers = new Map<string, StreamerSession>();

  function createDefaultStreamerSession(username: string, sessionId: string): StreamerSession {
    return {
      username,
      sessionId,
      token: `st_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      lastActivity: Date.now(),
      conn: null,
      reconnectTimer: null,
      desiredLiveUsername: null,
      currentRoomId: null,
      status: {
        connected: false,
        mode: 'webhook-ready',
        username,
        tikfinityUrl: null,
        viewerCount: 0,
        chatEventsProcessed: 0,
        guessesFromChat: 0,
        likesCount: 0,
        giftsDiamonds: 0,
        lastError: null,
      },
      chatHistory: [],
    };
  }

  // Fallback status for global health checks
  const fallbackTikTokStatus: TikTokConnectionStatus = {
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
  let tiktokStatus: TikTokConnectionStatus = fallbackTikTokStatus;

  // Registered & Authorized Streamers list with individual admin-provided keys
  let authorizedUsers: AuthorizedUser[] = [
    {
      username: 'mindtipgames',
      key: 'LIVE-KEY-2026',
      label: 'Official MindTipGames Live',
      createdAt: Date.now(),
    },
  ];

  // Admin login credentials (default: User: Admin, Password: MissingWiki)
  let adminCredentials = {
    username: 'Admin',
    password: 'MissingWiki',
  };

  function cleanStreamerUsername(raw: string): string {
    return String(raw || '').trim().replace(/^@/, '').toLowerCase();
  }

  function isStreamerAuthorized(username: string, key?: string): boolean {
    const clean = cleanStreamerUsername(username);
    if (!clean) return false;
    const found = authorizedUsers.find(
      (u) => cleanStreamerUsername(u.username) === clean
    );
    if (!found) return false;
    if (key !== undefined) {
      return String(found.key).trim() === String(key).trim();
    }
    return true;
  }

  function getTodaySeed(): string {
    const now = new Date();
    return `daily-${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  }

  function broadcastToMode(mode: GameMode, message: object) {
    const raw = JSON.stringify(message);
    for (const [ws, meta] of clients.entries()) {
      if (ws.readyState === WebSocket.OPEN && meta.mode === mode) {
        ws.send(raw);
      }
    }
  }

  function broadcastAll(message: object) {
    const raw = JSON.stringify(message);
    for (const [ws] of clients.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(raw);
      }
    }
  }

  function getViewerPresence() {
    let mpViewers = 0;
    let soloViewers = 0;
    let wwViewers = 0;
    for (const meta of clients.values()) {
      if (meta.mode === 'multiplayer') mpViewers++;
      else if (meta.mode === 'wikiword-4x4') wwViewers++;
      else soloViewers++;
    }
    return {
      totalConnected: clients.size,
      mpViewers,
      soloViewers,
      wwViewers,
    };
  }

  function pushLiveChatItem(item: LiveChatItem) {
    liveChatHistory.push(item);
    if (liveChatHistory.length > 50) {
      liveChatHistory.shift();
    }
    broadcastAll({
      type: 'chat:event',
      item,
    });
  }

  let desiredTikTokUsername: string | null = null;
  let tiktokReconnectTimer: NodeJS.Timeout | null = null;

  function scheduleRoundRollover(mode: 'multiplayer' | 'wikiword-4x4') {
    if (mode === 'multiplayer') {
      if (mpCountdownInterval) return;
      multiplayerGame.roundEndCountdownSec = 15;
      broadcastToMode('multiplayer', {
        type: 'game:state',
        state: multiplayerGame.publicState(),
      });

      mpCountdownInterval = setInterval(async () => {
        if (multiplayerGame.roundEndCountdownSec !== null && multiplayerGame.roundEndCountdownSec > 1) {
          multiplayerGame.roundEndCountdownSec -= 1;
          broadcastToMode('multiplayer', {
            type: 'game:countdown',
            seconds: multiplayerGame.roundEndCountdownSec,
          });
        } else {
          if (mpCountdownInterval) clearInterval(mpCountdownInterval);
          mpCountdownInterval = null;
          multiplayerGame = await createNewGameInstance('multiplayer');
          broadcastToMode('multiplayer', {
            type: 'game:state',
            state: multiplayerGame.publicState(),
          });
          broadcastAll({ type: 'tiktok:status', status: tiktokStatus });
        }
      }, 1000);
    } else {
      if (wwCountdownInterval) return;
      wikiword4x4Game.roundEndCountdownSec = 10;
      broadcastToMode('wikiword-4x4', {
        type: 'game:state',
        state: wikiword4x4Game.publicState(),
      });

      wwCountdownInterval = setInterval(async () => {
        if (wikiword4x4Game.roundEndCountdownSec !== null && wikiword4x4Game.roundEndCountdownSec > 1) {
          wikiword4x4Game.roundEndCountdownSec -= 1;
          broadcastToMode('wikiword-4x4', {
            type: 'game:countdown',
            seconds: wikiword4x4Game.roundEndCountdownSec,
          });
        } else {
          if (wwCountdownInterval) clearInterval(wwCountdownInterval);
          wwCountdownInterval = null;
          wikiword4x4Game = await createNewGameInstance('wikiword-4x4');
          broadcastToMode('wikiword-4x4', {
            type: 'game:state',
            state: wikiword4x4Game.publicState(),
          });
          broadcastAll({ type: 'tiktok:status', status: tiktokStatus });
        }
      }, 1000);
    }
  }

  // Extract a single-word alphabetical answer, ignoring capitalization and punctuation.
  // Returns null if the message contains multiple words, numbers (e.g. "zn55"), or is < 3 letters.
  function extractSingleWordFromChat(rawComment: string): string | null {
    const strippedPunctuation = String(rawComment || '')
      .replace(/['’`]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim();
    if (!strippedPunctuation) return null;
    const words = strippedPunctuation.split(/\s+/).filter(Boolean);
    if (words.length !== 1) return null;
    const singleWord = words[0].toLowerCase();
    if (!/^[a-z]{3,15}$/.test(singleWord)) return null;
    return singleWord;
  }

  function cleanupStreamerSession(cleanUsername: string, reason = 'logout') {
    const session = activeStreamers.get(cleanUsername);
    if (!session) return;

    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer);
      session.reconnectTimer = null;
    }

    if (session.conn) {
      try {
        session.conn.removeAllListeners();
        session.conn.disconnect();
      } catch {}
      session.conn = null;
    }

    session.desiredLiveUsername = null;
    session.status.connected = false;
    session.status.username = null;
    session.currentRoomId = null;

    io.to(`streamer:${cleanUsername}`).emit('tiktok-disconnected');
    io.to(`streamer:${cleanUsername}`).emit('tiktok-status', session.status);
    if (reason === 'inactivity') {
      io.to(`streamer:${cleanUsername}`).emit('streamer-timeout', {
        reason: 'inactivity',
        message: 'Logged out after 20 minutes of inactivity (no chat or user activity)',
      });
    }

    for (const [ws, meta] of clients.entries()) {
      if (meta.streamerUsername === cleanUsername && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'tiktok:status',
            status: session.status,
          })
        );
        if (reason === 'inactivity') {
          ws.send(
            JSON.stringify({
              type: 'streamer:timeout',
              message: 'Logged out after 20 minutes of inactivity',
            })
          );
        }
      }
    }

    activeStreamers.delete(cleanUsername);
  }

  // Automatic 20-minute inactivity sweeper (user + chat activity combined)
  setInterval(() => {
    const now = Date.now();
    const INACTIVITY_MS = 20 * 60 * 1000;
    for (const [username, session] of activeStreamers.entries()) {
      if (now - session.lastActivity >= INACTIVITY_MS) {
        cleanupStreamerSession(username, 'inactivity');
      }
    }
  }, 15000);

  function handleStreamerChatInGame(cleanUsername: string, rawData: any) {
    const session = activeStreamers.get(cleanUsername);
    if (!session) return;

    const data = normalizeChatData(rawData);
    if (!data.comment) return;

    session.status.chatEventsProcessed += 1;
    session.lastActivity = Date.now();

    const finder: FinderInfo = {
      displayName: data.nickname || data.uniqueId,
      platform: 'tiktok',
      platformUserId: `tt_${data.uniqueId}`,
      profileImage: data.profilePictureUrl || undefined,
    };

    const singleWord = extractSingleWordFromChat(data.comment);
    if (!singleWord) {
      const item: LiveChatItem = {
        id: `tt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        platform: 'tiktok',
        username: data.uniqueId,
        displayName: finder.displayName,
        profileImage: finder.profileImage || undefined,
        comment: data.comment,
        guessResult: 'chat',
        timestamp: Date.now(),
        eventType: 'chat',
      };
      session.chatHistory.push(item);
      if (session.chatHistory.length > 50) session.chatHistory.shift();

      io.to(`streamer:${cleanUsername}`).emit('chat-message', item);
      for (const [ws, meta] of clients.entries()) {
        if (meta.streamerUsername === cleanUsername && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'chat:event', item }));
          ws.send(JSON.stringify({ type: 'tiktok:status', status: session.status }));
        }
      }
      return;
    }

    const bestOutcome = multiplayerGame.guess(singleWord, finder);
    session.status.guessesFromChat += 1;

    if (bestOutcome.result === 'correct') {
      broadcastToMode('multiplayer', {
        type: 'game:word-found',
        outcome: bestOutcome,
      });
    }

    const item: LiveChatItem = {
      id: `tt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      platform: 'tiktok',
      username: data.uniqueId,
      displayName: finder.displayName,
      profileImage: finder.profileImage || undefined,
      comment: data.comment,
      guessResult: bestOutcome.result === 'too_short' ? 'chat' : bestOutcome.result,
      points: bestOutcome.result === 'correct' ? bestOutcome.points : undefined,
      isTitleWord: bestOutcome.isTitleWord,
      tierName: bestOutcome.tierName,
      timestamp: Date.now(),
      eventType: 'chat',
    };
    session.chatHistory.push(item);
    if (session.chatHistory.length > 50) session.chatHistory.shift();

    io.to(`streamer:${cleanUsername}`).emit('chat-message', item);
    for (const [ws, meta] of clients.entries()) {
      if (meta.streamerUsername === cleanUsername && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'chat:event', item }));
        ws.send(JSON.stringify({ type: 'tiktok:status', status: session.status }));
      }
    }

    broadcastToMode('multiplayer', {
      type: 'game:state',
      state: multiplayerGame.publicState(),
    });

    if (multiplayerGame.isComplete()) {
      scheduleRoundRollover('multiplayer');
    }
  }

  function handleStreamerLikeInGame(cleanUsername: string, rawData: any) {
    const session = activeStreamers.get(cleanUsername);
    if (!session) return;
    const data = normalizeLikeData(rawData);
    session.status.likesCount += data.likeCount;
    session.lastActivity = Date.now();

    const finder: FinderInfo = {
      displayName: data.nickname || data.uniqueId,
      platform: 'tiktok',
      platformUserId: `tt_${data.uniqueId}`,
      profileImage: data.profilePictureUrl || undefined,
    };
    multiplayerGame.recordEngagement(finder, 'like', data.likeCount);

    io.to(`streamer:${cleanUsername}`).emit('like-event', data);
    for (const [ws, meta] of clients.entries()) {
      if (meta.streamerUsername === cleanUsername && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'tiktok:status', status: session.status }));
      }
    }
  }

  function handleStreamerGiftInGame(cleanUsername: string, rawData: any) {
    const session = activeStreamers.get(cleanUsername);
    if (!session) return;
    const data = normalizeGiftData(rawData);
    const totalDiamonds = data.diamondCount * data.repeatCount;
    session.status.giftsDiamonds += totalDiamonds;
    session.lastActivity = Date.now();

    const finder: FinderInfo = {
      displayName: data.nickname || data.uniqueId,
      platform: 'tiktok',
      platformUserId: `tt_${data.uniqueId}`,
      profileImage: data.profilePictureUrl || undefined,
    };
    multiplayerGame.recordEngagement(finder, 'gift', totalDiamonds);

    io.to(`streamer:${cleanUsername}`).emit('gift-event', data);
    for (const [ws, meta] of clients.entries()) {
      if (meta.streamerUsername === cleanUsername && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'tiktok:status', status: session.status }));
      }
    }
  }

  function startStreamerConnection(cleanUsername: string, requestingSocket?: any) {
    const session = activeStreamers.get(cleanUsername);
    if (!session) {
      if (requestingSocket) {
        requestingSocket.emit('tiktok-error', 'Streamer session not found. Please log in first.');
      }
      return;
    }

    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer);
      session.reconnectTimer = null;
    }

    // If already connected to this username, re-emit connected status
    if (
      session.conn &&
      session.status.connected &&
      session.status.username?.toLowerCase() === cleanUsername.toLowerCase()
    ) {
      const payload = {
        username: session.status.username,
        roomId: session.currentRoomId || 'live',
      };
      if (requestingSocket) requestingSocket.emit('tiktok-connected', payload);
      io.to(`streamer:${cleanUsername}`).emit('tiktok-connected', payload);
      io.to(`streamer:${cleanUsername}`).emit('tiktok-status', session.status);
      return;
    }

    if (session.conn) {
      try {
        session.conn.removeAllListeners();
        session.conn.disconnect();
      } catch {}
      session.conn = null;
    }

    session.desiredLiveUsername = cleanUsername;
    const conn = new WebcastPushConnection(cleanUsername);
    session.conn = conn;

    conn
      .connect()
      .then((state: any) => {
        if (session.conn !== conn) return;
        const roomId = String(state?.roomId || state?.roomInfo?.id || 'live');
        session.currentRoomId = roomId;
        session.status.connected = true;
        session.status.mode = 'tiktok-live';
        session.status.username = cleanUsername;
        session.status.lastError = null;
        session.lastActivity = Date.now();

        const payload = { username: cleanUsername, roomId };
        if (requestingSocket) requestingSocket.emit('tiktok-connected', payload);
        io.to(`streamer:${cleanUsername}`).emit('tiktok-connected', payload);
        io.to(`streamer:${cleanUsername}`).emit('tiktok-status', session.status);

        for (const [ws, meta] of clients.entries()) {
          if (meta.streamerUsername === cleanUsername && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'tiktok:status',
                status: session.status,
              })
            );
          }
        }
      })
      .catch((err: any) => {
        if (session.conn !== conn) return;
        const errMsg = err?.message || String(err);
        session.status.connected = false;
        session.status.lastError = errMsg;
        if (requestingSocket) requestingSocket.emit('tiktok-error', errMsg);
        io.to(`streamer:${cleanUsername}`).emit('tiktok-status', session.status);
      });

    conn.on('chat', (data: any) => {
      if (session.conn !== conn) return;
      handleStreamerChatInGame(cleanUsername, data);
    });

    conn.on('like', (data: any) => {
      if (session.conn !== conn) return;
      handleStreamerLikeInGame(cleanUsername, data);
    });

    conn.on('gift', (data: any) => {
      if (session.conn !== conn) return;
      handleStreamerGiftInGame(cleanUsername, data);
    });

    conn.on('disconnected', () => {
      if (session.conn !== conn) return;
      if (session.desiredLiveUsername === cleanUsername) {
        session.reconnectTimer = setTimeout(() => {
          if (session.desiredLiveUsername === cleanUsername) {
            startStreamerConnection(cleanUsername);
          }
        }, 2500);
        return;
      }
      session.status.connected = false;
      session.currentRoomId = null;
      io.to(`streamer:${cleanUsername}`).emit('tiktok-disconnected');
      io.to(`streamer:${cleanUsername}`).emit('tiktok-status', session.status);
    });

    conn.on('error', (err: any) => {
      if (session.conn !== conn) return;
      if (!session.status.connected && requestingSocket) {
        requestingSocket.emit('tiktok-error', err?.message || String(err));
      }
    });
  }

  // Socket.IO Real-Time TikTok Live Integration (Scoped per streamer)
  io.on('connection', (socket) => {
    socket.on('register-streamer', (payload: any) => {
      const username = cleanStreamerUsername(payload?.username);
      if (!username) return;
      socket.join(`streamer:${username}`);
      const session = activeStreamers.get(username);
      if (session) {
        session.lastActivity = Date.now();
        socket.emit('tiktok-status', session.status);
        if (session.status.connected) {
          socket.emit('tiktok-connected', {
            username: session.username,
            roomId: session.currentRoomId || 'live',
          });
        }
      }
    });

    socket.on('connect-tiktok', (payload: any) => {
      try {
        const raw =
          typeof payload === 'object' && payload !== null
            ? payload.username
            : payload;
        const key =
          typeof payload === 'object' && payload !== null
            ? payload.key
            : undefined;
        const sessionId =
          typeof payload === 'object' && payload !== null
            ? payload.sessionId
            : '';

        const cleanUsername = cleanStreamerUsername(raw);
        if (!cleanUsername) {
          socket.emit('tiktok-error', 'Please enter a valid TikTok username');
          return;
        }

        if (!isStreamerAuthorized(cleanUsername, key)) {
          socket.emit(
            'tiktok-error',
            `@${cleanUsername} is not in the list of authorized streamers, or the access key is invalid.`
          );
          return;
        }

        socket.join(`streamer:${cleanUsername}`);
        let session = activeStreamers.get(cleanUsername);
        if (!session) {
          session = createDefaultStreamerSession(cleanUsername, sessionId || socket.id);
          activeStreamers.set(cleanUsername, session);
        }
        session.lastActivity = Date.now();

        startStreamerConnection(cleanUsername, socket);
      } catch (err: any) {
        socket.emit('tiktok-error', err?.message || String(err));
      }
    });

    socket.on('disconnect-tiktok', (payload?: any) => {
      const rawUser = typeof payload === 'object' && payload !== null ? payload.username : payload;
      const cleanUsername = cleanStreamerUsername(rawUser);
      if (cleanUsername) {
        const session = activeStreamers.get(cleanUsername);
        if (session) {
          if (session.reconnectTimer) {
            clearTimeout(session.reconnectTimer);
            session.reconnectTimer = null;
          }
          if (session.conn) {
            try {
              session.conn.removeAllListeners();
              session.conn.disconnect();
            } catch {}
            session.conn = null;
          }
          session.desiredLiveUsername = null;
          session.status.connected = false;
          session.currentRoomId = null;
          socket.emit('tiktok-disconnected');
          io.to(`streamer:${cleanUsername}`).emit('tiktok-disconnected');
          io.to(`streamer:${cleanUsername}`).emit('tiktok-status', session.status);
        }
      }
    });

    // Simulated / debug events scoped to a streamer's room
    socket.on('chat-message', (data: any) => {
      const streamerUser = cleanStreamerUsername(data?.streamerUsername || data?.streamer);
      if (streamerUser && activeStreamers.has(streamerUser)) {
        handleStreamerChatInGame(streamerUser, data);
      }
    });

    socket.on('like-event', (data: any) => {
      const streamerUser = cleanStreamerUsername(data?.streamerUsername || data?.streamer);
      if (streamerUser && activeStreamers.has(streamerUser)) {
        handleStreamerLikeInGame(streamerUser, data);
      }
    });

    socket.on('gift-event', (data: any) => {
      const streamerUser = cleanStreamerUsername(data?.streamerUsername || data?.streamer);
      if (streamerUser && activeStreamers.has(streamerUser)) {
        handleStreamerGiftInGame(streamerUser, data);
      }
    });
  });

  async function getOrCreateSoloGame(sessionId: string, mode: 'daily-solo' | 'practice-solo'): Promise<WiKirecGame> {
    const key = `${sessionId}:${mode}`;
    let existing = soloGames.get(key);
    if (!existing) {
      const seed = mode === 'daily-solo' ? getTodaySeed() : undefined;
      existing = await createNewGameInstance(mode, seed);
      soloGames.set(key, existing);
    }
    return existing;
  }

  async function getGameForClient(meta: ClientMeta): Promise<WiKirecGame> {
    if (meta.mode === 'multiplayer') return multiplayerGame;
    if (meta.mode === 'wikiword-4x4') return wikiword4x4Game;
    return getOrCreateSoloGame(meta.sessionId, meta.mode);
  }

  // REST Endpoints
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      tiktok: tiktokStatus,
      presence: getViewerPresence(),
    });
  });

  // Admin: Get authorized streamers
  app.get('/api/admin/authorized-users', (_req, res) => {
    res.json({
      ok: true,
      users: authorizedUsers,
    });
  });

  // Admin: Update authorized streamers list
  app.post('/api/admin/authorized-users', (req, res) => {
    try {
      const incoming = req.body?.users;
      if (!Array.isArray(incoming)) {
        return res.status(400).json({ ok: false, error: 'Expected an array of authorized users' });
      }

      const validList: AuthorizedUser[] = incoming
        .map((u: any) => ({
          username: cleanStreamerUsername(u?.username),
          key: String(u?.key || '').trim(),
          label: String(u?.label || '').trim() || undefined,
          createdAt: Number(u?.createdAt) || Date.now(),
        }))
        .filter((u) => u.username.length > 0 && u.key.length > 0);

      // Deduplicate by username (case-insensitive)
      const deduped: AuthorizedUser[] = [];
      const seen = new Set<string>();
      for (const u of validList) {
        if (!seen.has(u.username)) {
          seen.add(u.username);
          deduped.push(u);
        }
      }

      authorizedUsers = deduped;
      res.json({ ok: true, users: authorizedUsers });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  // Streamer Auth: Validate registered @username and admin-provided key
  // Enforces single-active-session per @username and rejects concurrent logins
  app.post('/api/auth/validate-streamer', (req, res) => {
    const rawUsername = req.body?.username;
    const rawKey = req.body?.key;
    const sessionId = String(req.body?.sessionId || '').trim();
    const username = cleanStreamerUsername(rawUsername);
    const key = String(rawKey || '').trim();

    if (!username || !key) {
      return res.status(400).json({
        ok: false,
        valid: false,
        message: 'Both TikTok username and admin-provided key are required',
      });
    }

    const found = authorizedUsers.find(
      (u) => cleanStreamerUsername(u.username) === username && String(u.key).trim() === key
    );

    if (!found) {
      return res.status(401).json({
        ok: false,
        valid: false,
        message: 'Invalid username or access key. Contact administrator for authorization.',
      });
    }

    const now = Date.now();
    const INACTIVITY_MS = 20 * 60 * 1000;
    const existing = activeStreamers.get(username);

    if (existing) {
      const isStale = now - existing.lastActivity >= INACTIVITY_MS;
      if (isStale) {
        // Automatically cleanup stale session older than 20 minutes
        cleanupStreamerSession(username, 'inactivity');
      } else if (sessionId && existing.sessionId && existing.sessionId !== sessionId) {
        // Active session under this @username already running on another tab/device
        return res.status(409).json({
          ok: false,
          valid: false,
          isAlreadyLoggedIn: true,
          message: `@${found.username} is already logged in on another device or window. Multiple simultaneous logins under the same @username are not permitted.`,
        });
      }
    }

    // Initialize or refresh streamer session
    let session = activeStreamers.get(username);
    if (!session) {
      session = createDefaultStreamerSession(username, sessionId || `sess_${Date.now()}`);
      activeStreamers.set(username, session);
    } else {
      if (sessionId) session.sessionId = sessionId;
      session.lastActivity = now;
    }

    res.json({
      ok: true,
      valid: true,
      sessionId: session.sessionId,
      token: session.token,
      user: {
        username: found.username,
        label: found.label,
      },
    });
  });

  // Streamer Activity: Heartbeat to keep session alive during user or chat interactions
  app.post('/api/auth/streamer-activity', (req, res) => {
    try {
      const username = cleanStreamerUsername(req.body?.username);
      const sessionId = String(req.body?.sessionId || '').trim();
      if (!username) {
        return res.status(400).json({ ok: false, message: 'Username required' });
      }
      const session = activeStreamers.get(username);
      if (session) {
        if (!sessionId || !session.sessionId || session.sessionId === sessionId) {
          session.lastActivity = Date.now();
          return res.json({ ok: true, lastActivity: session.lastActivity });
        }
      }
      res.json({ ok: false });
    } catch {
      res.json({ ok: false });
    }
  });

  // Streamer Logout: Explicit logout or window unload beacon cleanup
  app.post('/api/auth/streamer-logout', (req, res) => {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {}
      }
      const rawUser = body?.username;
      const sessionId = String(body?.sessionId || '').trim();
      const username = cleanStreamerUsername(rawUser);

      if (username) {
        const session = activeStreamers.get(username);
        if (session) {
          if (!sessionId || !session.sessionId || session.sessionId === sessionId) {
            cleanupStreamerSession(username, 'logout');
          }
        }
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  // Admin Login: Authenticate admin User & Password
  app.post('/api/admin/login', (req, res) => {
    const rawUser = String(req.body?.username || '').trim();
    const rawPass = String(req.body?.password || '').trim();

    if (
      rawUser.toLowerCase() === adminCredentials.username.toLowerCase() &&
      rawPass === adminCredentials.password
    ) {
      res.json({
        ok: true,
        username: adminCredentials.username,
        token: `adm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      });
    } else {
      res.status(401).json({
        ok: false,
        message: 'Invalid Admin username or password',
      });
    }
  });

  // Admin Change Credentials: Change Admin Username & Password
  app.post('/api/admin/change-credentials', (req, res) => {
    const currentPass = String(req.body?.currentPassword || '').trim();
    const newUsername = String(req.body?.newUsername || '').trim();
    const newPassword = String(req.body?.newPassword || '').trim();

    if (currentPass !== adminCredentials.password) {
      return res.status(401).json({
        ok: false,
        message: 'Current admin password is incorrect',
      });
    }

    if (!newUsername || newUsername.length < 2) {
      return res.status(400).json({
        ok: false,
        message: 'New username must be at least 2 characters',
      });
    }

    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({
        ok: false,
        message: 'New password must be at least 4 characters',
      });
    }

    adminCredentials = {
      username: newUsername,
      password: newPassword,
    };

    res.json({
      ok: true,
      username: adminCredentials.username,
      message: 'Admin credentials updated successfully',
    });
  });

  // Helper endpoint to inspect unfound words when testing TikTok chat interaction
  app.get('/api/tiktok/sample-words', (_req, res) => {
    const unfoundTitle = multiplayerGame.titleWords.filter(
      (w) => !multiplayerGame.revealedTitleWords.has(w)
    );
    const unfoundCommon = Array.from(multiplayerGame.commonWords.keys())
      .filter((w) => !multiplayerGame.foundWords.has(w))
      .slice(0, 6);
    const unfoundRare = Array.from(multiplayerGame.rareWords.keys())
      .filter((w) => !multiplayerGame.foundWords.has(w))
      .slice(0, 4);
    res.json({
      titleWords: unfoundTitle,
      commonWords: unfoundCommon,
      rareWords: unfoundRare,
    });
  });

  wss.on('connection', (ws) => {
    const defaultMeta: ClientMeta = {
      ws,
      sessionId: `anon-${Math.random().toString(36).slice(2, 10)}`,
      displayName: 'Explorer',
      mode: 'multiplayer',
    };
    clients.set(ws, defaultMeta);

    ws.send(
      JSON.stringify({
        type: 'init',
        state: multiplayerGame.publicState(),
        tiktokStatus,
        chatHistory: liveChatHistory,
        presence: getViewerPresence(),
      })
    );

    broadcastAll({
      type: 'presence:update',
      presence: getViewerPresence(),
    });

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const meta = clients.get(ws);
        if (!meta) return;

        if (msg.type === 'identify' || msg.type === 'streamer:identify') {
          if (msg.sessionId) meta.sessionId = String(msg.sessionId).slice(0, 64);
          if (msg.displayName) meta.displayName = String(msg.displayName).trim().slice(0, 28) || 'Explorer';
          if (msg.mode && ['multiplayer', 'daily-solo', 'practice-solo', 'wikiword-4x4'].includes(msg.mode)) {
            meta.mode = msg.mode as GameMode;
          }
          if (msg.streamerUsername !== undefined) {
            meta.streamerUsername = msg.streamerUsername ? cleanStreamerUsername(msg.streamerUsername) : null;
          }

          if (meta.streamerUsername) {
            const session = activeStreamers.get(meta.streamerUsername);
            if (session) {
              session.lastActivity = Date.now();
              ws.send(
                JSON.stringify({
                  type: 'tiktok:status',
                  status: session.status,
                })
              );
              if (session.chatHistory.length > 0) {
                for (const item of session.chatHistory) {
                  ws.send(JSON.stringify({ type: 'chat:event', item }));
                }
              }
            }
          }

          const game = await getGameForClient(meta);
          ws.send(
            JSON.stringify({
              type: 'game:state',
              state: game.publicState(),
            })
          );
          broadcastAll({
            type: 'presence:update',
            presence: getViewerPresence(),
          });
          return;
        }

        if (msg.type === 'streamer:activity') {
          if (meta.streamerUsername) {
            const session = activeStreamers.get(meta.streamerUsername);
            if (session) {
              session.lastActivity = Date.now();
            }
          }
          return;
        }

        if (msg.type === 'mode:switch') {
          const nextMode = msg.mode as GameMode;
          if (['multiplayer', 'daily-solo', 'practice-solo', 'wikiword-4x4'].includes(nextMode)) {
            meta.mode = nextMode;
            const game = await getGameForClient(meta);
            ws.send(
              JSON.stringify({
                type: 'game:state',
                state: game.publicState(),
              })
            );
            broadcastAll({
              type: 'presence:update',
              presence: getViewerPresence(),
            });
          }
          return;
        }

        if (msg.type === 'guess:submit') {
          const singleWord = extractSingleWordFromChat(String(msg.word || ''));
          if (!singleWord) return;
          const finder: FinderInfo = {
            displayName: meta.displayName,
            platform: 'web',
            platformUserId: meta.sessionId,
          };
          const game = await getGameForClient(meta);
          const outcome = game.guess(singleWord, finder);

          ws.send(
            JSON.stringify({
              type: 'guess:result',
              outcome,
            })
          );

          if (outcome.result !== 'too_short') {
            pushLiveChatItem({
              id: `web-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              platform: 'web',
              username: meta.displayName.toLowerCase().replace(/\s+/g, '_'),
              displayName: meta.displayName,
              comment: outcome.word.toUpperCase(),
              guessResult: outcome.result,
              points: outcome.points,
              isTitleWord: outcome.isTitleWord,
              tierName: outcome.tierName,
              timestamp: Date.now(),
              eventType: 'chat',
            });
          }

          if (meta.mode === 'multiplayer' || meta.mode === 'wikiword-4x4') {
            if (outcome.result === 'correct') {
              broadcastToMode(meta.mode, {
                type: 'game:word-found',
                outcome,
              });
            }
            broadcastToMode(meta.mode, {
              type: 'game:state',
              state: game.publicState(),
            });
            if (game.isComplete()) {
              scheduleRoundRollover(meta.mode);
            }
          } else {
            ws.send(
              JSON.stringify({
                type: 'game:state',
                state: game.publicState(),
              })
            );
          }
          return;
        }

        if (msg.type === 'game:hint') {
          const game = await getGameForClient(meta);
          const hint = game.requestHint();
          if (meta.mode === 'multiplayer' || meta.mode === 'wikiword-4x4') {
            broadcastToMode(meta.mode, {
              type: 'game:state',
              state: game.publicState(),
            });
          } else {
            ws.send(
              JSON.stringify({
                type: 'game:state',
                state: game.publicState(),
                hint,
              })
            );
          }
          return;
        }

        if (msg.type === 'game:new-round') {
          if (meta.mode === 'multiplayer') {
            if (mpCountdownInterval) {
              clearInterval(mpCountdownInterval);
              mpCountdownInterval = null;
            }
            multiplayerGame = await createNewGameInstance('multiplayer');
            broadcastToMode('multiplayer', {
              type: 'game:state',
              state: multiplayerGame.publicState(),
            });
          } else if (meta.mode === 'wikiword-4x4') {
            if (wwCountdownInterval) {
              clearInterval(wwCountdownInterval);
              wwCountdownInterval = null;
            }
            wikiword4x4Game = await createNewGameInstance('wikiword-4x4');
            broadcastToMode('wikiword-4x4', {
              type: 'game:state',
              state: wikiword4x4Game.publicState(),
            });
          } else {
            const key = `${meta.sessionId}:${meta.mode}`;
            const seed =
              meta.mode === 'daily-solo' && !msg.forceNewArticle
                ? getTodaySeed()
                : undefined;
            const fresh = await createNewGameInstance(meta.mode, seed);
            soloGames.set(key, fresh);
            ws.send(
              JSON.stringify({
                type: 'game:state',
                state: fresh.publicState(),
              })
            );
          }
          return;
        }
      } catch (err) {
        console.error('[WS Error]', err);
      }
    });

    ws.on('close', () => {
      const closedMeta = clients.get(ws);
      clients.delete(ws);
      broadcastAll({
        type: 'presence:update',
        presence: getViewerPresence(),
      });

      if (closedMeta?.streamerUsername) {
        const streamerUser = closedMeta.streamerUsername;
        // Check after brief grace period (e.g. 3.5s for page reload) if any active sockets remain for this streamer
        setTimeout(() => {
          let hasOtherStreamerWs = false;
          for (const remaining of clients.values()) {
            if (remaining.streamerUsername === streamerUser) {
              hasOtherStreamerWs = true;
              break;
            }
          }
          if (!hasOtherStreamerWs) {
            cleanupStreamerSession(streamerUser, 'window_close');
          }
        }, 3500);
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      plugins: [
        {
          name: 'disable-vite-hmr-ws',
          enforce: 'post',
          transform(code, id) {
            if (id.includes('client.mjs') || code.includes('createWebSocketModuleRunnerTransport')) {
              return code
                .replace(
                  /transport\.connect\(createHMRHandler\(handleMessage\)\);/g,
                  '/* hmr disabled */'
                )
                .replace(
                  /setupForwardConsoleHandler\(transport,\s*forwardConsole\);/g,
                  '/* console forward disabled */'
                );
            }
          },
        },
      ],
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`WiKirecTangled Live & Solo Server running on http://localhost:${PORT}`);
  });
}

startServer();
