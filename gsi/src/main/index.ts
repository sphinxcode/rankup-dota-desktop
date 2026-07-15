// Electron main process (plan U1/U2). Ties the pieces together:
//   1. generate a per-install pairing token
//   2. install the GSI cfg into Dota's Steam path
//   3. start the GSI HTTP listener (127.0.0.1:3100) and the WS bridge (127.0.0.1:52100)
//   4. relay each normalized GSI tick to the browser
//   5. open the site with ?bridge=<token> so the tab pairs
// Tray-only app (no main window beyond a small status window). Electron glue — run on a real
// machine; the pure cores it calls are unit-tested.
import { app, Tray, Menu, shell, nativeImage } from 'electron';
import { randomUUID } from 'node:crypto';
import { installGsiConfig } from './gsi-cfg-install.ts';
import { startGsiHttp } from './gsi-http.ts';
import { startBridgeWs } from './bridge-ws.ts';

const SITE_URL = process.env.RANKUP_SITE_URL || 'https://rankupdota.com';
const token = randomUUID();

let tray: Tray | null = null;
let bridge: ReturnType<typeof startBridgeWs> | null = null;
let http: ReturnType<typeof startGsiHttp> | null = null;

// Single-instance: a second launch just focuses/opens the site again.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('ready', () => {
    const install = installGsiConfig(token);

    bridge = startBridgeWs(token);
    http = startGsiHttp(token, (evt) => bridge?.broadcast(evt));

    tray = new Tray(nativeImage.createEmpty());
    const openSite = () => shell.openExternal(`${SITE_URL}/?bridge=${encodeURIComponent(token)}`);
    tray.setToolTip('Rank Up Dota — Live Coach');
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: install.ok ? 'GSI configured ✓' : `GSI setup: ${install.reason}`, enabled: false },
        { label: 'Open coach in browser', click: openSite },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() },
      ]),
    );
    // Auto-open the paired site on first launch.
    openSite();
  });

  app.on('second-instance', () => shell.openExternal(`${SITE_URL}/?bridge=${encodeURIComponent(token)}`));
  app.on('window-all-closed', () => { /* tray app: stay alive */ });
  app.on('before-quit', () => { http?.close(); bridge?.close(); });
}
