import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameMode,
  GuessResult,
  LiveChatItem,
  PublicGameState,
  TargetCard,
  TikTokConnectionStatus,
} from './shared/types';
import { BoggleGrid } from './components/BoggleGrid';
import { TikTokLivePanel } from './components/TikTokLivePanel';
import { sfx } from './utils/sfx';

const STORAGE_NAME_KEY = 'wkt_display_name';
const STORAGE_SESSION_KEY = 'wkt_session_id';

function getOrInitSessionId(): string {
  try {
    let id = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!id) {
      id = `wkt_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
      localStorage.setItem(STORAGE_SESSION_KEY, id);
    }
    return id;
  } catch {
    return `wkt_anon_${Math.random().toString(36).slice(2, 9)}`;
  }
}

function getStoredDisplayName(): string {
  try {
    return localStorage.getItem(STORAGE_NAME_KEY) || 'You';
  } catch {
    return 'You';
  }
}

function formatRank(n: number | null): string {
  if (n == null) return '?';
  if (n >= 9999999) return '???';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function getTargetCardHue(rank: number | null, totalRankedWords: number): string {
  const GREEN_HUE = 120;
  const PURPLE_HUE = 285;
  const total = Math.max(2, totalRankedWords || 50000);
  let gradT = 1;
  if (rank != null && rank > 0) {
    gradT = Math.min(1, Math.log(Math.max(1, rank)) / Math.log(total));
  }
  const hue = GREEN_HUE + (PURPLE_HUE - GREEN_HUE) * gradT;
  return `hsl(${hue.toFixed(1)}, 70%, 55%)`;
}

export default function App() {
  const [mode, setMode] = useState<GameMode>(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/solo') {
      return 'daily-solo';
    }
    return 'multiplayer';
  });

  const [gameState, setGameState] = useState<PublicGameState | null>(null);
  const [tiktokStatus, setTiktokStatus] = useState<TikTokConnectionStatus>({
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
  });
  const [chatHistory, setChatHistory] = useState<LiveChatItem[]>([]);
  const [presence, setPresence] = useState({
    totalConnected: 1,
    mpViewers: 1,
    soloViewers: 0,
    wwViewers: 0,
  });

  const [guessInput, setGuessInput] = useState('');
  const [swipePreview, setSwipePreview] = useState('');
  const [flashedCells, setFlashedCells] = useState<number[]>([]);
  const [wordAnnounce, setWordAnnounce] = useState<{
    word: string;
    points: number;
    finderName: string;
    visible: boolean;
  }>({
    word: '',
    points: 0,
    finderName: '',
    visible: false,
  });

  const [displayName, setDisplayName] = useState(getStoredDisplayName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName);
  const [muted, setMuted] = useState(sfx.muted);
  const [tiktokDrawerOpen, setTiktokDrawerOpen] = useState(false);
  const [dismissedRoundId, setDismissedRoundId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string>(getOrInitSessionId());
  const modeRef = useRef<GameMode>(mode);
  const displayNameRef = useRef<string>(displayName);
  const prevCompleteRef = useRef<boolean>(false);
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName]);

  const triggerWordAnnounce = useCallback((finderName: string, word: string, points: number) => {
    if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    setWordAnnounce({
      finderName,
      word: word.toUpperCase(),
      points,
      visible: true,
    });
    announceTimerRef.current = setTimeout(() => {
      setWordAnnounce((prev) => ({ ...prev, visible: false }));
    }, 2400);
  }, []);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    function connect() {
      if (isUnmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'identify',
            sessionId: sessionIdRef.current,
            displayName: displayNameRef.current,
            mode: modeRef.current,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'init') {
            if (msg.state) setGameState(msg.state);
            if (msg.tiktokStatus) setTiktokStatus(msg.tiktokStatus);
            if (Array.isArray(msg.chatHistory)) setChatHistory(msg.chatHistory);
            if (msg.presence) setPresence(msg.presence);
          } else if (msg.type === 'game:state') {
            setGameState(msg.state);
            if (msg.state?.isComplete && !prevCompleteRef.current) {
              sfx.playRoundWin();
            }
            prevCompleteRef.current = !!msg.state?.isComplete;
          } else if (msg.type === 'game:countdown') {
            setGameState((prev) =>
              prev ? { ...prev, roundEndCountdownSec: msg.seconds } : prev
            );
          } else if (msg.type === 'guess:result') {
            const outcome: GuessResult = msg.outcome;
            if (outcome.result === 'correct') {
              sfx.playWordFound(outcome.tierName, outcome.isTitleWord);
              if (outcome.cells?.length) {
                setFlashedCells(outcome.cells);
                setTimeout(() => setFlashedCells([]), 900);
              }
              triggerWordAnnounce(outcome.finder.displayName, outcome.word, outcome.points);
            } else if (outcome.result === 'already_found') {
              sfx.playAlreadyFound();
              if (outcome.cells?.length) {
                setFlashedCells(outcome.cells);
                setTimeout(() => setFlashedCells([]), 600);
              }
            } else if (outcome.result === 'miss_in_article') {
              sfx.playMiss(true);
            } else if (outcome.result === 'incorrect') {
              sfx.playMiss(false);
            }
          } else if (msg.type === 'game:word-found') {
            const outcome: GuessResult = msg.outcome;
            sfx.playWordFound(outcome.tierName, outcome.isTitleWord);
            if (outcome.cells?.length) {
              setFlashedCells(outcome.cells);
              setTimeout(() => setFlashedCells([]), 900);
            }
            triggerWordAnnounce(
              outcome.finder.displayName,
              outcome.word,
              outcome.points
            );
          } else if (msg.type === 'chat:event' && msg.item) {
            if (!msg.item.eventType || msg.item.eventType === 'chat') {
              setChatHistory((prev) => [...prev.slice(-39), msg.item]);
            }
          } else if (msg.type === 'tiktok:status' && msg.status) {
            setTiktokStatus(msg.status);
          } else if (msg.type === 'presence:update' && msg.presence) {
            setPresence(msg.presence);
          }
        } catch {}
      };

      ws.onclose = () => {
        if (!isUnmounted) {
          reconnectTimer = setTimeout(connect, 1500);
        }
      };
    }

    connect();
    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [triggerWordAnnounce]);

  const switchMode = useCallback((nextMode: GameMode) => {
    setMode(nextMode);
    setGuessInput('');
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'mode:switch',
          mode: nextMode,
        })
      );
    }
  }, []);

  const submitWordGuess = useCallback((wordRaw: string) => {
    const strippedPunctuation = String(wordRaw || '')
      .replace(/['’`]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim();
    const parts = strippedPunctuation.split(/\s+/).filter(Boolean);
    setGuessInput('');
    if (parts.length !== 1) return;
    const clean = parts[0].toLowerCase();
    if (!/^[a-z]{3,15}$/.test(clean)) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'guess:submit',
          word: clean,
        })
      );
    }
  }, []);

  const handleComposerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessInput.trim()) return;
    submitWordGuess(guessInput);
  };

  const handleRequestHint = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'game:hint' }));
    }
  };

  const handleNewRound = (forceNewArticle = true) => {
    setDismissedRoundId(null);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'game:new-round',
          forceNewArticle,
        })
      );
    }
  };

  const handleSaveDisplayName = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = nameDraft.trim().slice(0, 24) || 'You';
    setDisplayName(cleaned);
    setIsEditingName(false);
    try {
      localStorage.setItem(STORAGE_NAME_KEY, cleaned);
    } catch {}
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'identify',
          sessionId: sessionIdRef.current,
          displayName: cleaned,
          mode,
        })
      );
    }
  };

  // Scrambled order for unrevealed title chips (matching wikirectangled.com's renderTitleChips)
  const displayedTitleChips = useMemo(() => {
    const chips = gameState?.titleChips || [];
    const allRevealed = chips.length > 0 && chips.every((c) => c.revealed);
    if (allRevealed) return chips;
    const copy = [...chips];
    let seed = (gameState?.roundId || 'seed').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    for (let i = copy.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) | 0;
      const j = Math.abs(seed) % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, [gameState?.titleChips, gameState?.roundId]);

  const allTitleRevealed = useMemo(() => {
    const chips = gameState?.titleChips || [];
    return chips.length > 0 && chips.every((c) => c.revealed);
  }, [gameState?.titleChips]);

  const topThreePlayers = useMemo(() => {
    const list = gameState?.topPlayers || [];
    return [list[0] || null, list[1] || null, list[2] || null];
  }, [gameState?.topPlayers]);

  const latestFoundWord = gameState?.foundWords?.[0] || null;
  const lastTag =
    gameState?.recentTags && gameState.recentTags.length > 0
      ? gameState.recentTags[gameState.recentTags.length - 1]
      : null;
  const firstRevealedTarget = useMemo(() => {
    return (gameState?.targets || []).find((t) => t.revealed && t.word && t.finder) || null;
  }, [gameState?.targets]);

  const lastGuessEntry = useMemo(() => {
    if (lastTag) {
      return {
        word: lastTag.word.toUpperCase(),
        displayName: lastTag.displayName || displayName,
        platform: lastTag.platform || 'web',
        profileImage: lastTag.profileImage,
        badge:
          lastTag.points && lastTag.points > 0
            ? `+${lastTag.points.toLocaleString()}`
            : lastTag.rank != null
            ? `#${formatRank(lastTag.rank)}`
            : lastTag.result === 'already_found'
            ? 'DUP'
            : '',
        cells:
          latestFoundWord &&
          latestFoundWord.word.toLowerCase() === lastTag.word.toLowerCase()
            ? latestFoundWord.cells
            : [],
      };
    }
    if (latestFoundWord) {
      return {
        word: latestFoundWord.word.toUpperCase(),
        displayName: latestFoundWord.displayName || displayName,
        platform: latestFoundWord.platform || 'web',
        profileImage: latestFoundWord.profileImage,
        badge: `+${latestFoundWord.points.toLocaleString()}`,
        cells: latestFoundWord.cells,
      };
    }
    if (firstRevealedTarget && firstRevealedTarget.word && firstRevealedTarget.finder) {
      return {
        word: firstRevealedTarget.word.toUpperCase(),
        displayName: firstRevealedTarget.finder.displayName || displayName,
        platform: firstRevealedTarget.finder.platform || 'web',
        profileImage: firstRevealedTarget.finder.profileImage,
        badge: `#${formatRank(firstRevealedTarget.rank)}`,
        cells: [],
      };
    }
    return {
      word: (swipePreview || guessInput || '—').toUpperCase(),
      displayName: displayName || 'You',
      platform: 'web' as const,
      profileImage: null,
      badge: '',
      cells: [],
    };
  }, [lastTag, latestFoundWord, firstRevealedTarget, swipePreview, guessInput, displayName]);

  const searchWordGroups = useMemo(() => {
    const all = gameState?.searchWords || [];
    return {
      title: all.filter((w) => w.tier === 'title'),
      common: all.filter((w) => w.tier === 'common'),
      rare: all.filter((w) => w.tier === 'rare'),
      ultra: all.filter((w) => w.tier === 'ultra'),
    };
  }, [gameState?.searchWords]);

  const handleQuickSimChat = async () => {
    try {
      const res = await fetch('/api/tiktok/sample-words');
      const words = await res.json();
      const pool: string[] = [
        ...(words.commonWords || []),
        ...(words.rareWords || []),
        ...(words.titleWords || []),
      ];
      const chosen =
        pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : 'planet';
      submitWordGuess(chosen);
    } catch {}
  };

  const chatOnlyItems = useMemo(
    () => chatHistory.filter((item) => !item.eventType || item.eventType === 'chat'),
    [chatHistory]
  );

  useEffect(() => {
    const el = chatListRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chatOnlyItems]);

  const isSolo = mode === 'daily-solo' || mode === 'practice-solo';
  const showVictoryModal =
    gameState?.isComplete && dismissedRoundId !== gameState.roundId;

  return (
    <>
      <div className="app-stage">
        {/* LEFT BOX: LIVE CHAT STREAM (50px gap to the left of the game) */}
        <aside className="side-box left-chat-box" aria-label="Live Chat Stream">
          <div className="side-box-header">
            <div className="side-box-title">
              <span className={`live-dot ${tiktokStatus.connected ? 'connected' : ''}`} />
              <span>LIVE CHAT STREAM</span>
            </div>
            <button
              type="button"
              className="side-box-action"
              onClick={() => setTiktokDrawerOpen(true)}
            >
              {tiktokStatus.connected && tiktokStatus.username
                ? `@${tiktokStatus.username}`
                : 'TikTok Setup'}
            </button>
          </div>

          <div className="side-box-body chat-stream-list" ref={chatListRef}>
            {chatOnlyItems.length === 0 ? (
              <div className="side-box-empty">
                <p>Waiting for live chat &amp; player guesses...</p>
                <span>
                  Connect a TikTok Live stream or type a word guess to see real-time chat activity here.
                </span>
              </div>
            ) : (
              chatOnlyItems.map((item) => {
                const nameLabel = (item.displayName || item.username || 'Player').replace(/^@/, '');
                const initial = nameLabel[0]?.toUpperCase() || '?';
                return (
                  <div
                    key={item.id}
                    className={`chat-stream-item ${
                      item.guessResult === 'correct' ? 'is-correct' : ''
                    }`}
                  >
                    <div className="csi-avatar">
                      {item.profileImage ? (
                        <img
                          src={item.profileImage}
                          alt={nameLabel}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        initial
                      )}
                    </div>
                    <div className="csi-content">
                      <div className="csi-top">
                        <span className="csi-name">{nameLabel}</span>
                        {item.points && item.points > 0 ? (
                          <span className="csi-badge correct">
                            +{item.points.toLocaleString()}
                          </span>
                        ) : item.guessResult === 'already_found' ? (
                          <span className="csi-badge dup">DUP</span>
                        ) : item.guessResult === 'miss_in_article' ? (
                          <span className="csi-badge wiki">WIKI</span>
                        ) : (
                          <span className="csi-badge miss">CHAT</span>
                        )}
                      </div>
                      <div className="csi-comment">{item.comment}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="side-box-footer">
            <button
              type="button"
              className="side-footer-btn"
              onClick={handleQuickSimChat}
            >
              + Sim Guess
            </button>
            <button
              type="button"
              className="side-footer-btn primary"
              onClick={() => setTiktokDrawerOpen(true)}
            >
              TikTok Live Hub
            </button>
          </div>
        </aside>

        {/* CENTER COLUMN: MAIN WIKIRECTANGLED GAME */}
        <div className="game-center-col">
          {/* TOPBAR — Exact wikirectangled.com structure */}
          <header className="topbar">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                switchMode('multiplayer');
              }}
              className="logo-text"
              id="logo"
            >
          <span>WiKi</span>
          <span className="accent">rec</span>
          <span className="green">Tangled</span>
        </a>

        <div className="topbar-spacer" />

        <div className="counts">
          <span className="count g" title="Grid words found">
            <span className="badge">G</span>
            <b id="grid-found">{gameState?.foundCount || 0}</b>
          </span>
          <span className="count t" title="Title words revealed">
            <span className="badge">T</span>
            <b id="title-found">{gameState?.revealedTitleWordCount || 0}</b>
            <span className="slash">/</span>
            <span className="total" id="title-total">
              {gameState?.titleWordCount || 0}
            </span>
          </span>
          <span className="count c" title="Common words target">
            <span className="badge">C</span>
            <b id="common-found">{gameState?.foundCommonCount || 0}</b>
            <span className="slash">/</span>
            <span className="total" id="common-total">
              {gameState?.commonWordTarget || 0}
            </span>
          </span>
        </div>

        {/* Hint button */}
        <button
          type="button"
          onClick={handleRequestHint}
          className="mute-toggle"
          title="Reveal a tile hint"
          aria-label="Reveal Hint"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
          </svg>
        </button>

        {/* TikTok Live Chat & Streamer Relay Button */}
        <button
          type="button"
          onClick={() => setTiktokDrawerOpen(true)}
          className={`tiktok-pill-btn ${tiktokStatus.connected ? 'live' : ''}`}
          title="Open TikTok Live Interactivity Hub"
        >
          <span>TikTok Live</span>
          {tiktokStatus.guessesFromChat > 0 && (
            <span>({tiktokStatus.guessesFromChat})</span>
          )}
        </button>

        {/* Sound Mute Toggle */}
        <button
          className={`mute-toggle ${muted ? 'muted' : ''}`}
          id="muteToggle"
          type="button"
          onClick={() => setMuted(sfx.toggleMute())}
          aria-pressed={muted}
          aria-label="Toggle sound"
        >
          {!muted ? (
            <svg
              className="icon-sound"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          ) : (
            <svg
              className="icon-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="22" y1="9" x2="16" y2="15" />
              <line x1="16" y1="9" x2="22" y2="15" />
            </svg>
          )}
        </button>
      </header>

      {/* MAIN 2-COLUMN LAYOUT — Exact wikirectangled.com structure */}
      <main className="layout">
        {/* LEFT COLUMN: Title Block + 3-Player Podium */}
        <section className="left-col">
          <div className="title-block">
            <div className="title-eyebrow">
              <span>TITLE</span>
              {gameState?.activeHint && (
                <span style={{ color: 'var(--accent-green)', letterSpacing: '0.04em' }}>
                  {gameState.activeHint.revealedPrefix}... ({gameState.activeHint.wordLength}L)
                </span>
              )}
            </div>

            <div className="title-chips" id="title-chips">
              {allTitleRevealed && gameState?.articleTitle ? (
                gameState.articleTitle.split(/\s+/).map((tok, idx) => (
                  <span key={idx} className="title-chip">
                    {tok.toUpperCase()}
                  </span>
                ))
              ) : (
                displayedTitleChips.map((chip) => (
                  <span
                    key={chip.index}
                    className={`title-chip ${chip.revealed ? '' : 'hidden-word'}`}
                  >
                    {chip.revealed && chip.word ? chip.word.toUpperCase() : 'HIDDEN'}
                  </span>
                ))
              )}
            </div>

            <div
              className="title-tier-status"
              id="title-tier-status"
              data-active={
                allTitleRevealed &&
                gameState?.currentTierPhase &&
                gameState.currentTierPhase !== 'complete'
                  ? 'true'
                  : 'false'
              }
              data-tier={gameState?.currentTierPhase || 'common'}
            >
              {allTitleRevealed &&
              gameState?.currentTierPhase &&
              gameState.currentTierPhase !== 'complete'
                ? `Searching for ${gameState.currentTierPhase} words`
                : ''}
            </div>
          </div>

          <div className="leader-spacer" />

          {/* 3-Player Podium Row (.first, .second, .third) */}
          <div className="players-row" id="players-row">
            {(['first', 'second', 'third'] as const).map((rankClass, i) => {
              const player = topThreePlayers[i];
              const cleanPlayerName = player
                ? (player.displayName || 'Player').replace(/^@/, '')
                : 'Open';
              return (
                <div key={rankClass} className={`player-card ${rankClass}`}>
                  <div className="pfp">
                    {player ? (
                      player.profileImage ? (
                        <img
                          src={player.profileImage}
                          alt={cleanPlayerName}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        cleanPlayerName[0]?.toUpperCase() || '?'
                      )
                    ) : (
                      i + 1
                    )}
                  </div>
                  <div className="pname">{cleanPlayerName}</div>
                  <div className="pscore">
                    {player ? player.score.toLocaleString() : '0'}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* RIGHT COLUMN: 5 Capsule-in-Capsule Target Cards */}
        <section className="right-col">
          <div id="target-cards">
            {(gameState?.targets || []).map((t: TargetCard) => {
              const isPlaceholder = !t.revealed || !t.word;
              const isRevealedTarget = !!t.isTarget;
              const cardColor = getTargetCardHue(
                t.rank,
                gameState?.totalRankedWords || 50000
              );
              const finderName = t.finder
                ? (t.finder.displayName || 'Player').replace(/^@/, '')
                : '';

              return (
                <div
                  key={t.position}
                  className={`tcard ${isRevealedTarget ? 'revealed' : ''} ${
                    isPlaceholder ? 'placeholder' : ''
                  }`}
                >
                  <div
                    className="tcard-body"
                    style={
                      {
                        '--card-color': cardColor,
                        '--close': (t.closeness || 0).toFixed(3),
                      } as React.CSSProperties
                    }
                  >
                    <div className="tcard-fill" />

                    <div className="tlabel">
                      <span className="trank">
                        #{isPlaceholder ? t.position : formatRank(t.rank)}
                      </span>
                      <span className="tword">
                        {t.word ? t.word.toUpperCase() : '•••••'}
                      </span>
                    </div>

                    {t.finder && !isPlaceholder && (
                      <div className="tfinder">
                        <div className="tpfp">
                          {t.finder.profileImage ? (
                            <img
                              src={t.finder.profileImage}
                              alt={finderName}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            finderName[0]?.toUpperCase() || '?'
                          )}
                        </div>
                        <div className="tname">{finderName}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* LAST GUESS CARD (Always shows last guess with icon, name, and guess) */}
        <div className="found-words-card" id="found-words-card">
          <div className="found-words-list" id="found-words-list">
            <div
              className="found-word-item"
              onMouseEnter={() => {
                if (lastGuessEntry.cells.length > 0) {
                  setFlashedCells(lastGuessEntry.cells);
                }
              }}
              onMouseLeave={() => setFlashedCells([])}
            >
              <span className="fw-avatar-wrap">
                {lastGuessEntry.profileImage ? (
                  <img
                    src={lastGuessEntry.profileImage}
                    alt={lastGuessEntry.displayName}
                    referrerPolicy="no-referrer"
                    className="fw-fallback"
                  />
                ) : (
                  <div className="fw-fallback">
                    {(lastGuessEntry.displayName || '?').replace(/^@/, '')[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </span>
              <span className="fw-word">{lastGuessEntry.word}</span>
              <span className="fw-finder-wrap">
                <span className="fw-finder">
                  {(lastGuessEntry.displayName || 'You').replace(/^@/, '')}
                </span>
              </span>
              <span className="fw-pts">{lastGuessEntry.badge}</span>
            </div>
          </div>
        </div>
      </main>

      {/* 9x5 BOGGLE KEYCAP LETTER GRID */}
      <BoggleGrid
        grid={gameState?.grid || []}
        rows={gameState?.rows || 5}
        cols={gameState?.cols || 9}
        activeTierStartCells={gameState?.activeTierStartCells || []}
        activeCommonCells={gameState?.activeCommonCells || []}
        typedWord={guessInput}
        flashedCells={flashedCells}
        activeHint={gameState?.activeHint}
        onSwipeWordSubmit={submitWordGuess}
        onSwipePreviewChange={setSwipePreview}
      />

      {/* COMPOSER */}
      <form
        className="composer"
        id="composer"
        autoComplete="off"
        onSubmit={handleComposerSubmit}
      >
        <input
          type="text"
          id="guess-input"
          value={guessInput}
          onChange={(e) => setGuessInput(e.target.value)}
          aria-label="Guess a word"
          placeholder={swipePreview ? `Swiping: ${swipePreview}` : 'Type or Swipe'}
          autoComplete="off"
        />
        <button type="submit">Guess</button>
        {isSolo ? (
          <button
            type="button"
            id="end-solo"
            className="ghost"
            onClick={() => handleNewRound(true)}
          >
            End run
          </button>
        ) : (
          <button
            type="button"
            className="ghost"
            onClick={() => handleNewRound(true)}
            title="Start a new puzzle article"
          >
            Skip
          </button>
        )}
      </form>

      {/* WIN-CONDITION STRIP (T, C, R, U) */}
      <div className="win-strip" id="win-strip">
        <span className="count t">
          <span className="badge">T</span>
          <b id="win-title-found">{gameState?.revealedTitleWordCount || 0}</b>
          <span className="slash">/</span>
          <span className="total" id="win-title-total">
            {gameState?.titleWordCount || 0}
          </span>
        </span>
        <span className="count c">
          <span className="badge">C</span>
          <b id="win-common-found">{gameState?.foundCommonCount || 0}</b>
          <span className="slash">/</span>
          <span className="total" id="win-common-total">
            {gameState?.commonWordTarget || 0}
          </span>
        </span>
        <span className="count r">
          <span className="badge">R</span>
          <b id="win-rare-found">{gameState?.foundRareCount || 0}</b>
          <span className="slash">/</span>
          <span className="total" id="win-rare-total">
            {gameState?.rareWordTarget || 0}
          </span>
        </span>
        <span className="count u">
          <span className="badge">U</span>
          <b id="win-ultra-found">{gameState?.foundUltraCount || 0}</b>
          <span className="slash">/</span>
          <span className="total" id="win-ultra-total">
            {gameState?.ultraWordTarget || 0}
          </span>
        </span>
      </div>

      {/* PLAYER STRIP — Exact wikirectangled.com footer links */}
      <div className="player-strip">
        {isEditingName ? (
          <form
            onSubmit={handleSaveDisplayName}
            style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
          >
            <span>Playing as</span>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              style={{
                background: 'var(--panel)',
                color: 'var(--text)',
                border: '1px solid var(--accent-orange)',
                borderRadius: '6px',
                padding: '2px 8px',
                width: '120px',
                font: 'inherit',
              }}
              autoFocus
            />
            <button type="submit" className="link-btn">
              Save
            </button>
          </form>
        ) : (
          <>
            Playing as{' '}
            <button
              type="button"
              id="rename-link"
              className="link-btn"
              onClick={() => {
                setNameDraft(displayName);
                setIsEditingName(true);
              }}
              aria-label="Change display name"
            >
              {displayName}
            </button>
          </>
        )}
        {' · '}
        <button
          type="button"
          className={`link-btn ${mode === 'multiplayer' ? 'active-mode' : ''}`}
          onClick={() => switchMode('multiplayer')}
        >
          Multiplayer →
        </button>
        {' · '}
        <button
          type="button"
          className={`link-btn ${mode === 'wikiword-4x4' ? 'active-mode' : ''}`}
          onClick={() => switchMode('wikiword-4x4')}
        >
          WikiWord →
        </button>
        {' · '}
        <button
          type="button"
          className={`link-btn ${mode === 'daily-solo' ? 'active-mode' : ''}`}
          onClick={() => switchMode('daily-solo')}
        >
          Solo →
        </button>
        {' · '}
        <button
          type="button"
          className={`link-btn ${mode === 'practice-solo' ? 'active-mode' : ''}`}
          onClick={() => switchMode('practice-solo')}
        >
          Practice →
        </button>
      </div>

      {/* LEGAL FOOTER */}
      <footer className="wt-legal-footer">
        <button type="button" onClick={() => switchMode('multiplayer')}>
          Multiplayer
        </button>{' '}
        &middot;{' '}
        <button type="button" onClick={() => switchMode('daily-solo')}>
          Daily Solo
        </button>{' '}
        &middot;{' '}
        <button type="button" onClick={() => switchMode('wikiword-4x4')}>
          WikiWord 4×4
        </button>{' '}
        &middot;{' '}
        <button type="button" onClick={() => setTiktokDrawerOpen(true)}>
          TikTok Live Relay
        </button>{' '}
        &middot; <span>&copy; 2026 Word Tycoon</span>
      </footer>
        </div>

        {/* RIGHT BOX: WORDS BEING LOOKED FOR (50px gap to the right of the game) */}
        <aside className="side-box right-words-box" aria-label="Words Being Looked For">
          <div className="side-box-header">
            <div className="side-box-title">
              <span>WORDS BEING LOOKED FOR</span>
            </div>
            <span className="side-box-counter">
              {(gameState?.revealedTitleWordCount || 0) +
                (gameState?.foundCommonCount || 0) +
                (gameState?.foundRareCount || 0) +
                (gameState?.foundUltraCount || 0)}
              /
              {(gameState?.titleWordCount || 0) +
                (gameState?.commonWordTarget || 0) +
                (gameState?.rareWordTarget || 0) +
                (gameState?.ultraWordTarget || 0)}
            </span>
          </div>

          <div className="side-box-body target-words-list">
            {/* Title Words Group */}
            <div className="tw-group">
              <div className="tw-group-header tier-title">
                <span className="tw-tier-label">
                  <span className="badge-dot t">T</span> TITLE WORDS
                </span>
                <span className="tw-tier-count">
                  {gameState?.revealedTitleWordCount || 0}/{gameState?.titleWordCount || 0}
                </span>
              </div>
              <div className="tw-chips-grid">
                {searchWordGroups.title.map((slot) => (
                  <div
                    key={slot.id}
                    className={`tw-slot ${slot.revealed ? 'found title-found' : 'unfound'}`}
                    onMouseEnter={() => {
                      if (slot.revealed && slot.cells?.length) setFlashedCells(slot.cells);
                    }}
                    onMouseLeave={() => setFlashedCells([])}
                  >
                    <span className="tw-slot-word">
                      {slot.revealed && slot.word
                        ? slot.word
                        : `${slot.startLetter}${'•'.repeat(Math.max(1, slot.length - 1))}`}
                    </span>
                    <span className="tw-slot-meta">
                      {slot.revealed ? slot.finderName || 'Found' : `${slot.length}L`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Common Words Group */}
            <div className="tw-group">
              <div className="tw-group-header tier-common">
                <span className="tw-tier-label">
                  <span className="badge-dot c">C</span> COMMON WORDS
                </span>
                <span className="tw-tier-count">
                  {gameState?.foundCommonCount || 0}/{gameState?.commonWordTarget || 0}
                </span>
              </div>
              <div className="tw-chips-grid">
                {searchWordGroups.common.map((slot) => (
                  <div
                    key={slot.id}
                    className={`tw-slot ${slot.revealed ? 'found common-found' : 'unfound'}`}
                    onMouseEnter={() => {
                      if (slot.revealed && slot.cells?.length) setFlashedCells(slot.cells);
                    }}
                    onMouseLeave={() => setFlashedCells([])}
                  >
                    <span className="tw-slot-word">
                      {slot.revealed && slot.word
                        ? slot.word
                        : `${slot.startLetter}${'•'.repeat(Math.max(1, slot.length - 1))}`}
                    </span>
                    <span className="tw-slot-meta">
                      {slot.revealed ? slot.finderName || 'Found' : `${slot.length}L`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rare Words Group */}
            <div className="tw-group">
              <div className="tw-group-header tier-rare">
                <span className="tw-tier-label">
                  <span className="badge-dot r">R</span> RARE WORDS
                </span>
                <span className="tw-tier-count">
                  {gameState?.foundRareCount || 0}/{gameState?.rareWordTarget || 0}
                </span>
              </div>
              <div className="tw-chips-grid">
                {searchWordGroups.rare.map((slot) => (
                  <div
                    key={slot.id}
                    className={`tw-slot ${slot.revealed ? 'found rare-found' : 'unfound'}`}
                    onMouseEnter={() => {
                      if (slot.revealed && slot.cells?.length) setFlashedCells(slot.cells);
                    }}
                    onMouseLeave={() => setFlashedCells([])}
                  >
                    <span className="tw-slot-word">
                      {slot.revealed && slot.word
                        ? slot.word
                        : `${slot.startLetter}${'•'.repeat(Math.max(1, slot.length - 1))}`}
                    </span>
                    <span className="tw-slot-meta">
                      {slot.revealed ? slot.finderName || 'Found' : `${slot.length}L`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ultra Words Group */}
            <div className="tw-group">
              <div className="tw-group-header tier-ultra">
                <span className="tw-tier-label">
                  <span className="badge-dot u">U</span> ULTRA RARE WORDS
                </span>
                <span className="tw-tier-count">
                  {gameState?.foundUltraCount || 0}/{gameState?.ultraWordTarget || 0}
                </span>
              </div>
              <div className="tw-chips-grid">
                {searchWordGroups.ultra.map((slot) => (
                  <div
                    key={slot.id}
                    className={`tw-slot ${slot.revealed ? 'found ultra-found' : 'unfound'}`}
                    onMouseEnter={() => {
                      if (slot.revealed && slot.cells?.length) setFlashedCells(slot.cells);
                    }}
                    onMouseLeave={() => setFlashedCells([])}
                  >
                    <span className="tw-slot-word">
                      {slot.revealed && slot.word
                        ? slot.word
                        : `${slot.startLetter}${'•'.repeat(Math.max(1, slot.length - 1))}`}
                    </span>
                    <span className="tw-slot-meta">
                      {slot.revealed ? slot.finderName || 'Found' : `${slot.length}L`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* WORD ANNOUNCE SLIDE-DOWN TOAST */}
      <div
        id="word-announce"
        className={`word-announce ${wordAnnounce.visible ? 'show' : ''}`}
      >
        <div className="wa-pfp" id="wa-pfp">
          {(wordAnnounce.finderName || '?').replace(/^@/, '')[0]?.toUpperCase() || 'W'}
        </div>
        <div className="wa-info">
          <div className="wa-name" id="wa-name">
            {wordAnnounce.finderName}
          </div>
          <div className="wa-line">
            <span className="wa-word" id="wa-word">
              {wordAnnounce.word}
            </span>
            <span className="wa-pts" id="wa-pts">
              +{wordAnnounce.points.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* ROUND-END OVERLAY */}
      {showVictoryModal && gameState && (
        <div className="round-end-overlay" id="solo-end-overlay">
          <div className="round-end-card">
            <h2 id="solo-end-title">
              {isSolo ? 'Run complete' : 'Round complete'}
            </h2>
            <div className="rev-title" id="solo-end-article">
              {gameState.articleTitle || gameState.unmaskedArticleTitle || 'Wikipedia Article Solved'}
            </div>

            {topThreePlayers[0] && (
              <div className="round-end-winner">
                <div className="round-end-winner-pfp">
                  {topThreePlayers[0].profileImage ? (
                    <img
                      src={topThreePlayers[0].profileImage}
                      alt={(topThreePlayers[0].displayName || 'Player').replace(/^@/, '')}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    (topThreePlayers[0].displayName || 'Player')
                      .replace(/^@/, '')[0]
                      ?.toUpperCase() || '1'
                  )}
                </div>
                <div className="round-end-winner-info">
                  <span className="round-end-winner-label">Top Player</span>
                  <span className="round-end-winner-name">
                    {(topThreePlayers[0].displayName || 'Player').replace(/^@/, '')}
                  </span>
                  <span className="round-end-winner-score">
                    {topThreePlayers[0].score.toLocaleString()} pts
                  </span>
                </div>
              </div>
            )}

            {gameState.articleExtract && (
              <p
                style={{
                  color: 'var(--text-dim)',
                  fontSize: '0.92rem',
                  lineHeight: 1.5,
                  marginBottom: '14px',
                }}
              >
                {gameState.articleExtract}
              </p>
            )}
            {gameState.roundEndCountdownSec !== null && (
              <div
                style={{
                  color: 'var(--text-dim)',
                  fontSize: '0.92rem',
                  marginBottom: '12px',
                }}
              >
                Next round in {gameState.roundEndCountdownSec}s
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="ghost"
                style={{
                  background: 'transparent',
                  color: 'var(--text-dim)',
                  border: '2px solid var(--border)',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                onClick={() => setDismissedRoundId(gameState.roundId)}
              >
                View board
              </button>
              <button
                type="button"
                id="solo-end-again"
                style={{
                  background: 'var(--accent-orange)',
                  color: '#fff',
                  border: '2px solid var(--accent-orange-2)',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
                onClick={() => handleNewRound(true)}
              >
                Play again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TIKTOK LIVE INTERACTIVITY DRAWER */}
      <TikTokLivePanel
        status={tiktokStatus}
        chatItems={chatHistory}
        gameState={gameState}
        isOpen={tiktokDrawerOpen}
        onClose={() => setTiktokDrawerOpen(false)}
        onConnectionStateChange={(connected, username) => {
          setTiktokStatus((prev) => ({
            ...prev,
            connected,
            username,
          }));
        }}
      />
    </>
  );
}
