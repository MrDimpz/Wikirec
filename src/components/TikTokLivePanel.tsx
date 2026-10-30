import React, { useState } from 'react';
import { Radio, Send, Sparkles, Users, Heart, Gift, Terminal, X } from 'lucide-react';
import { LiveChatItem, TikTokConnectionStatus } from '../shared/types';

interface TikTokLivePanelProps {
  status: TikTokConnectionStatus;
  chatItems: LiveChatItem[];
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_TIKTOK_VIEWERS = [
  { uniqueId: 'lexi_wordsmith', nickname: 'Lexi Wordsmith' },
  { uniqueId: 'boggle_king99', nickname: 'BoggleKing' },
  { uniqueId: 'wiki_hunter_tt', nickname: 'WikiHunter' },
  { uniqueId: 'nova_starlight', nickname: 'Nova Starlight' },
  { uniqueId: 'puzzle_champ', nickname: 'PuzzleChamp' },
];

export const TikTokLivePanel: React.FC<TikTokLivePanelProps> = ({
  status,
  chatItems,
  isOpen,
  onClose,
}) => {
  const [tiktokHandle, setTiktokHandle] = useState('');
  const [tikfinityUrl, setTikfinityUrl] = useState('ws://localhost:21213/');
  const [testViewer, setTestViewer] = useState(SAMPLE_TIKTOK_VIEWERS[0].uniqueId);
  const [testComment, setTestComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleConnectLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tiktokHandle.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/tiktok/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: tiktokHandle.trim() }),
      });
      const data = await res.json();
      setFeedback(data.ok ? `Connected to @${tiktokHandle}` : data.error);
    } catch (err: any) {
      setFeedback(err.message || 'Connection failed');
    } finally {
      setBusy(false);
    }
  };

  const handleConnectTikFinity = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/tiktok/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tikfinityUrl: tikfinityUrl.trim() }),
      });
      const data = await res.json();
      setFeedback(data.ok ? 'TikFinity WebSocket relay initialized' : data.error);
    } catch (err: any) {
      setFeedback(err.message || 'TikFinity connection failed');
    } finally {
      setBusy(false);
    }
  };

  const sendWebhookEvent = async (payload: object) => {
    await fetch('/api/tiktok/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  const handleSendTestChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testComment.trim()) return;
    const viewer =
      SAMPLE_TIKTOK_VIEWERS.find((v) => v.uniqueId === testViewer) || SAMPLE_TIKTOK_VIEWERS[0];
    const comment = testComment.trim();
    setTestComment('');
    await sendWebhookEvent({
      event: 'chat',
      data: {
        uniqueId: viewer.uniqueId,
        nickname: viewer.nickname,
        comment,
      },
    });
  };

  const handleTriggerSmartViewerGuess = async (tierType: 'title' | 'common' | 'rare') => {
    try {
      const res = await fetch('/api/tiktok/sample-words');
      const words = await res.json();
      const pool: string[] =
        tierType === 'title'
          ? words.titleWords
          : tierType === 'rare'
          ? words.rareWords
          : words.commonWords;
      const chosen =
        pool && pool.length > 0
          ? pool[Math.floor(Math.random() * pool.length)]
          : 'planet';
      const viewer =
        SAMPLE_TIKTOK_VIEWERS[Math.floor(Math.random() * SAMPLE_TIKTOK_VIEWERS.length)];
      await sendWebhookEvent({
        event: 'chat',
        data: {
          uniqueId: viewer.uniqueId,
          nickname: viewer.nickname,
          comment: chosen,
        },
      });
    } catch {}
  };

  const handleTriggerGiftOrLike = async (type: 'like' | 'gift') => {
    const viewer =
      SAMPLE_TIKTOK_VIEWERS[Math.floor(Math.random() * SAMPLE_TIKTOK_VIEWERS.length)];
    if (type === 'like') {
      await sendWebhookEvent({
        event: 'like',
        data: {
          uniqueId: viewer.uniqueId,
          nickname: viewer.nickname,
          likeCount: 25,
        },
      });
    } else {
      await sendWebhookEvent({
        event: 'gift',
        data: {
          uniqueId: viewer.uniqueId,
          nickname: viewer.nickname,
          diamondCount: 50,
          giftName: 'TikTok Universe Crown',
        },
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-[#0F172A] border-l border-slate-800 h-full flex flex-col justify-between overflow-y-auto p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-display font-bold text-slate-100">
                TikTok Live Chat & Relay Hub
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time viewer word guesses, likes, and gifts synchronized across all connected players
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close TikTok Hub"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Connection Telemetry Row */}
          <div className="p-4 rounded-xl bg-[#151F32] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Relay Bridge Status</span>
              <span className="font-mono text-slate-200 tabular-nums">
                {status.connected
                  ? `Connected (${status.mode === 'tiktok-live' ? `@${status.username}` : 'TikFinity WS'})`
                  : 'Webhook & Studio Bridge Active'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800/80 text-center">
              <div>
                <div className="text-base font-mono font-bold text-slate-100 tabular-nums">
                  {status.guessesFromChat}
                </div>
                <div className="text-[11px] text-slate-400">Chat Guesses</div>
              </div>
              <div>
                <div className="text-base font-mono font-bold text-slate-100 tabular-nums">
                  {status.likesCount}
                </div>
                <div className="text-[11px] text-slate-400">Stream Likes</div>
              </div>
              <div>
                <div className="text-base font-mono font-bold text-amber-400 tabular-nums">
                  {status.giftsDiamonds}
                </div>
                <div className="text-[11px] text-slate-400">Gift Diamonds</div>
              </div>
            </div>
          </div>

          {/* Connect Real TikTok @Username or TikFinity WS */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">
              01. Connect Live TikTok Stream (@username)
            </h3>
            <form onSubmit={handleConnectLive} className="flex gap-2">
              <input
                type="text"
                value={tiktokHandle}
                onChange={(e) => setTiktokHandle(e.target.value)}
                placeholder="@username (live on TikTok)"
                className="flex-1 px-3 py-2 text-sm rounded-lg bg-[#151F32] border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Connect Stream
              </button>
            </form>

            <div className="flex gap-2 items-center pt-1">
              <input
                type="text"
                value={tikfinityUrl}
                onChange={(e) => setTikfinityUrl(e.target.value)}
                placeholder="ws://localhost:21213/"
                className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg bg-[#151F32] border border-slate-800 text-slate-300"
              />
              <button
                type="button"
                onClick={handleConnectTikFinity}
                disabled={busy}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Connect TikFinity WS
              </button>
            </div>

            {feedback && (
              <p className="text-xs text-amber-300/90 leading-relaxed">{feedback}</p>
            )}
          </div>

          {/* Interactive TikTok Chat Bridge (Test Live Viewer Guesses & Gifts) */}
          <div className="p-4 rounded-xl bg-[#151F32] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">
                02. Interactive TikTok Viewer Chat Bridge
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                POST /api/tiktok/webhook
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Dispatch real-time TikTok viewer chat messages into the Multiplayer room. Every connected browser tab receives the state update and word reveal simultaneously.
            </p>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleTriggerSmartViewerGuess('common')}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Chat Common Find
              </button>
              <button
                type="button"
                onClick={() => handleTriggerSmartViewerGuess('rare')}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 hover:bg-sky-500/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Chat Rare Find
              </button>
              <button
                type="button"
                onClick={() => handleTriggerSmartViewerGuess('title')}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Chat Title Hit
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTriggerGiftOrLike('like')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                Send +25 Stream Likes
              </button>
              <button
                type="button"
                onClick={() => handleTriggerGiftOrLike('gift')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Gift className="w-3.5 h-3.5 text-amber-400" />
                Send +50 Diamond Gift
              </button>
            </div>

            {/* Custom Chat Message Form */}
            <form onSubmit={handleSendTestChat} className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex gap-2">
                <select
                  value={testViewer}
                  onChange={(e) => setTestViewer(e.target.value)}
                  className="px-2.5 py-2 text-xs rounded-lg bg-[#0F172A] border border-slate-700 text-slate-200"
                >
                  {SAMPLE_TIKTOK_VIEWERS.map((v) => (
                    <option key={v.uniqueId} value={v.uniqueId}>
                      @{v.uniqueId}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={testComment}
                  onChange={(e) => setTestComment(e.target.value)}
                  placeholder="Type a word guess as TikTok viewer..."
                  className="flex-1 px-3 py-2 text-xs rounded-lg bg-[#0F172A] border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-950 hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Send Chat
                </button>
              </div>
            </form>
          </div>

          {/* Live Chat Event Log */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-200">
              03. Live Stream & Multiplayer Activity Log
            </h3>
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {chatItems.length === 0 ? (
                <div className="text-xs text-slate-500 py-4 text-center">
                  No chat guesses yet. Use the buttons above or type a word on the board!
                </div>
              ) : (
                [...chatItems].reverse().map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/60"
                  >
                    <div className="truncate pr-2">
                      <span className="font-semibold text-slate-200">
                        {item.platform === 'tiktok' ? `@${item.username}` : item.displayName}
                      </span>
                      <span className="mx-1.5 text-slate-600">·</span>
                      <span className="font-mono text-slate-300">{item.comment}</span>
                    </div>
                    <div className="text-right font-mono tabular-nums whitespace-nowrap shrink-0">
                      {item.points && item.points > 0 ? (
                        <span className="text-emerald-400 font-semibold">
                          +{item.points.toLocaleString()} pts
                        </span>
                      ) : item.eventType === 'like' ? (
                        <span className="text-rose-400">Liked</span>
                      ) : (
                        <span className="text-slate-500">{item.guessResult || 'chat'}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
