// Local HTTP listener that receives Dota's GSI POSTs (plan U2). Binds 127.0.0.1 only, validates
// the auth token Dota echoes from the cfg, normalizes the payload, and hands a BridgeEvent to a
// callback. Electron-main glue — the pure work (normalizeGsi) is unit-tested separately.
import { createServer, type Server } from 'node:http';
import { normalizeGsi } from '../core/normalize.ts';
import { GSI_HTTP_PORT } from '../core/bridge-types.ts';
import type { BridgeSelfEvent } from '../core/bridge-types.ts';

export type GsiHttpServer = { close: () => void };

/**
 * Start the GSI listener. `token` must equal the cfg's auth.token. `onSelf` fires on every
 * valid tick with the normalized self-state event.
 */
export function startGsiHttp(token: string, onSelf: (evt: BridgeSelfEvent) => void, port = GSI_HTTP_PORT): GsiHttpServer {
  const server: Server = createServer((req, res) => {
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 1_000_000) req.destroy(); // GSI payloads are small; cap abuse
    });
    req.on('end', () => {
      let payload: any;
      try { payload = JSON.parse(body); } catch { res.writeHead(400).end(); return; }
      // Dota echoes the cfg token under auth.token — reject anything else.
      if (payload?.auth?.token !== token) { res.writeHead(403).end(); return; }
      res.writeHead(200).end();
      try { onSelf(normalizeGsi(payload)); } catch { /* never let a bad tick crash the listener */ }
    });
  });
  // Loopback only — never expose game state on the LAN.
  server.listen(port, '127.0.0.1');
  return { close: () => server.close() };
}
