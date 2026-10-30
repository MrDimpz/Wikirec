import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { createNewGameInstance, WiKirecGame } from './src/server/game';
import { TikTokLiveBridge } from './src/server/tiktok-bridge';
import {
  FinderInfo,
  GameMode,
  LiveChatItem,
  PublicGameState,
} from './src/shared/types';

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
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
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
    if (liveChatHistory.length > 40) {
      liveChatHistory.shift();
    }
    broadcastAll({
      type: 'chat:event',
      item,
    });
  }

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
        }
      }, 1000);
    }
  }

  // Initialize TikTok Live Bridge
  const tiktokBridge = new TikTokLiveBridge({
    onChatGuess: (word, finder, rawComment) => {
      const outcome = multiplayerGame.guess(word, finder);
      pushLiveChatItem({
        id: `tt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        platform: 'tiktok',
        username: finder.platformUserId.replace(/^tt_/, ''),
        displayName: finder.displayName,
        comment: rawComment,
        guessResult: outcome.result === 'too_short' ? 'chat' : outcome.result,
        points: outcome.points,
        isTitleWord: outcome.isTitleWord,
        tierName: outcome.tierName,
        timestamp: Date.now(),
        eventType: 'chat',
      });

      if (outcome.result !== 'too_short') {
        broadcastToMode('multiplayer', {
          type: 'guess:stream',
          outcome,
        });
      }

      if (outcome.result === 'correct') {
        broadcastToMode('multiplayer', {
          type: 'game:word-found',
          outcome,
        });
      }
      broadcastToMode('multiplayer', {
        type: 'game:state',
        state: multiplayerGame.publicState(),
      });

      if (multiplayerGame.isComplete()) {
        scheduleRoundRollover('multiplayer');
      }
    },
    onEngagement: (finder, type, count, giftName) => {
      multiplayerGame.recordEngagement(finder, type, count);
      pushLiveChatItem({
        id: `tt-eng-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        platform: 'tiktok',
        username: finder.platformUserId.replace(/^tt_/, ''),
        displayName: finder.displayName,
        comment: type === 'gift' ? `Sent ${giftName || 'Gift'} (${count} diamonds)` : `Sent ${count} likes`,
        timestamp: Date.now(),
        eventType: type,
        giftName,
        diamondCount: type === 'gift' ? count : undefined,
      });
      broadcastToMode('multiplayer', {
        type: 'game:state',
        state: multiplayerGame.publicState(),
      });
    },
    onStatusChange: (status) => {
      broadcastAll({
        type: 'tiktok:status',
        status,
      });
    },
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

  // REST Endpoints for TikTok Webhook & Streamer Controls
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      tiktok: tiktokBridge.getStatus(),
      presence: getViewerPresence(),
    });
  });

  app.post('/api/tiktok/connect', async (req, res) => {
    const { username, tikfinityUrl } = req.body || {};
    if (tikfinityUrl) {
      const result = tiktokBridge.connectTikFinityWebSocket(tikfinityUrl);
      return res.json({ ...result, status: tiktokBridge.getStatus() });
    }
    if (username) {
      const result = await tiktokBridge.connectTikTokUsername(username);
      return res.json({ ...result, status: tiktokBridge.getStatus() });
    }
    return res.status(400).json({ ok: false, error: 'Provide username or tikfinityUrl' });
  });

  app.post('/api/tiktok/disconnect', (_req, res) => {
    tiktokBridge.disconnect();
    res.json({ ok: true, status: tiktokBridge.getStatus() });
  });

  // External Webhook for TikFinity / Streamer.bot / Live TikTok Chat
  app.post('/api/tiktok/webhook', (req, res) => {
    tiktokBridge.handleWebhookOrTikFinityPayload(req.body);
    res.json({ ok: true, status: tiktokBridge.getStatus() });
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

    // Send initial state immediately
    ws.send(
      JSON.stringify({
        type: 'init',
        state: multiplayerGame.publicState(),
        tiktokStatus: tiktokBridge.getStatus(),
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

        if (msg.type === 'identify') {
          if (msg.sessionId) meta.sessionId = String(msg.sessionId).slice(0, 64);
          if (msg.displayName) meta.displayName = String(msg.displayName).trim().slice(0, 28) || 'Explorer';
          if (msg.mode && ['multiplayer', 'daily-solo', 'practice-solo', 'wikiword-4x4'].includes(msg.mode)) {
            meta.mode = msg.mode as GameMode;
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
          const word = String(msg.word || '').trim();
          if (!word) return;
          const finder: FinderInfo = {
            displayName: meta.displayName,
            platform: 'web',
            platformUserId: meta.sessionId,
          };
          const game = await getGameForClient(meta);
          const outcome = game.guess(word, finder);

          ws.send(
            JSON.stringify({
              type: 'guess:result',
              outcome,
            })
          );

          if (meta.mode === 'multiplayer' || meta.mode === 'wikiword-4x4') {
            if (outcome.result !== 'too_short') {
              broadcastToMode(meta.mode, {
                type: 'guess:stream',
                outcome,
              });
            }
            if (outcome.result === 'correct') {
              broadcastToMode(meta.mode, {
                type: 'game:word-found',
                outcome,
              });
              pushLiveChatItem({
                id: `web-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                platform: 'web',
                username: meta.displayName.toLowerCase().replace(/\s+/g, '_'),
                displayName: meta.displayName,
                comment: outcome.word.toUpperCase(),
                guessResult: 'correct',
                points: outcome.points,
                isTitleWord: outcome.isTitleWord,
                tierName: outcome.tierName,
                timestamp: Date.now(),
                eventType: 'chat',
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
            if (outcome.result !== 'too_short') {
              ws.send(
                JSON.stringify({
                  type: 'guess:stream',
                  outcome,
                })
              );
            }
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
      clients.delete(ws);
      broadcastAll({
        type: 'presence:update',
        presence: getViewerPresence(),
      });
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
