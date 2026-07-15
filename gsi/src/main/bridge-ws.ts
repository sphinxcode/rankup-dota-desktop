// Token-gated local WebSocket bridge (plan U2, KTD7). Binds 127.0.0.1 only. The browser tab
// connects with ?token=<pairing token> and an Origin the app allowlists; the app broadcasts the
// latest BridgeEvent to every connected client and re-sends it once on connect (so a tab opened
// mid-game gets current state). Electron-main glue — requires the `ws` package.
import { WebSocketServer, type WebSocket } from 'ws';
import { BRIDGE_PORT, type BridgeEvent } from '../core/bridge-types.ts';

// The production site + local dev. A random localhost page must not read game state.
const DEFAULT_ALLOWED_ORIGINS = [
  'https://rankupdota.com',
  'https://www.rankupdota.com',
  'https://dota.sphinx.codes', // legacy domain — 301s to rankupdota.com but allow it directly too
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export type BridgeServer = {
  broadcast: (evt: BridgeEvent) => void;
  close: () => void;
  clientCount: () => number;
};

export function startBridgeWs(
  token: string,
  opts: { port?: number; allowedOrigins?: string[] } = {},
): BridgeServer {
  const port = opts.port ?? BRIDGE_PORT;
  const allowed = new Set(opts.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS);
  let last: BridgeEvent | null = null;

  const wss = new WebSocketServer({
    host: '127.0.0.1',
    port,
    verifyClient: (info, done) => {
      const url = new URL(info.req.url ?? '/', 'ws://127.0.0.1');
      const okToken = url.searchParams.get('token') === token;
      const origin = info.origin ?? info.req.headers.origin ?? '';
      const okOrigin = !origin || allowed.has(origin); // Electron-opened tab may omit Origin
      done(okToken && okOrigin);
    },
  });

  wss.on('connection', (ws: WebSocket) => {
    if (last) { try { ws.send(JSON.stringify(last)); } catch { /* noop */ } }
  });

  return {
    broadcast(evt: BridgeEvent) {
      last = evt;
      const msg = JSON.stringify(evt);
      for (const client of wss.clients) {
        if (client.readyState === client.OPEN) {
          try { client.send(msg); } catch { /* drop */ }
        }
      }
    },
    close: () => wss.close(),
    clientCount: () => wss.clients.size,
  };
}
