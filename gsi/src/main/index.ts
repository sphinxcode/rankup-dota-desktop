// Electron main process (plan U1/U2) — full-window coach app.
// The app opens a real window that loads the Rank Up Dota coach directly, AND runs the GSI
// bridge in the same process, so the live-pick integration works *inside the app* — no separate
// browser needed. Flow:
//   1. generate a per-install pairing token
//   2. install the GSI cfg into Dota's Steam path
//   3. start the GSI HTTP listener (127.0.0.1:3100) + WS bridge (127.0.0.1:52100)
//   4. open a BrowserWindow at <site>/?bridge=<token>; the page's bridge hook connects to the
//      local WS (loopback is a secure context, so wss-from-https rules don't block it)
//   5. each normalized GSI tick is relayed to the in-app page → auto-selects your hero
import { app, BrowserWindow, Tray, Menu, shell, nativeImage } from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { installGsiConfig } from './gsi-cfg-install.ts';
import { startGsiHttp } from './gsi-http.ts';
import { startBridgeWs } from './bridge-ws.ts';
import { normalizeDraft } from '../core/normalize.ts';
import { PREGAME_STATES, type BridgeSelfEvent } from '../core/bridge-types.ts';
import type { Template } from '../core/match.ts';
// Vision modules (sharp/screenshot-desktop native deps) are imported LAZILY below so that if those
// native modules fail to load, Phase 1 (GSI hero detection) keeps working — Phase 2 just no-ops.

const SITE_URL = process.env.RANKUP_SITE_URL || 'https://rankupdota.com';
const token = randomUUID();

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let bridge: ReturnType<typeof startBridgeWs> | null = null;
let http: ReturnType<typeof startGsiHttp> | null = null;

function appIcon(): Electron.NativeImage {
  // extraResources copies build/icon.png → resources/icon.png in the packaged app.
  const p = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(app.getAppPath(), 'build', 'icon.png');
  const img = nativeImage.createFromPath(p);
  return img.isEmpty() ? nativeImage.createEmpty() : img;
}

function coachUrl(): string {
  return `${SITE_URL}/?bridge=${encodeURIComponent(token)}`;
}

function createWindow() {
  if (win && !win.isDestroyed()) { win.show(); win.focus(); return; }
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    icon: appIcon(),
    backgroundColor: '#0b0f16',
    title: 'Rank Up Dota — Live Coach',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  win.loadURL(coachUrl());
  // Keep external links (Steam login, socials) in the user's real browser, not this window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(SITE_URL)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  win.on('closed', () => { win = null; });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => createWindow());

  app.on('ready', () => {
    const install = installGsiConfig(token);
    bridge = startBridgeWs(token);
    // Relay every GSI/vision event to BOTH transports: WebSocket (external browsers) and IPC to
    // the in-app window (which cannot use ws://localhost from an https page).
    const relay = (evt: Parameters<NonNullable<typeof bridge>['broadcast']>[0]) => {
      bridge?.broadcast(evt);
      if (win && !win.isDestroyed()) win.webContents.send('bridge-event', evt);
    };

    // Phase 2: build hero color-descriptors once at startup for enemy screen-reading. Lazy-loaded
    // so a native-module (sharp/screenshot-desktop) failure degrades to "no enemy detection" rather
    // than crashing the app.
    let templates: Template[] = [];
    let detectEnemiesFn: ((t: Template[]) => Promise<Array<{ slot: 'enemy'; heroId: number }>>) | null = null;
    (async () => {
      try {
        const [{ loadTemplates }, { detectEnemies }] = await Promise.all([
          import('./vision/heroes-templates.ts'),
          import('./vision/capture.ts'),
        ]);
        detectEnemiesFn = detectEnemies;
        templates = await loadTemplates(SITE_URL);
      } catch { /* vision unavailable — Phase 1 continues without enemy detection */ }
    })();

    let lastDetect = 0;
    const maybeReadEnemies = (evt: BridgeSelfEvent) => {
      // Pixel-check continuously across the ENTIRE draft/pre-game window (pick phase → strategy),
      // so enemies are read the instant they appear on screen, in any mode. Throttled; the web side
      // diffs, so re-pushing the same lineup (or an empty read while enemies are still hidden) is a
      // harmless no-op.
      if (!detectEnemiesFn || !templates.length) return;
      if (!evt.gameState || !PREGAME_STATES.includes(evt.gameState)) return;
      const now = Date.now();
      if (now - lastDetect < 2500) return;
      lastDetect = now;
      detectEnemiesFn(templates)
        .then((dets) => { if (dets.length) relay(normalizeDraft(dets)); })
        .catch(() => {});
    };

    http = startGsiHttp(token, (evt) => { relay(evt); maybeReadEnemies(evt); });

    createWindow();

    const trayIcon = appIcon().resize({ width: 18, height: 18 });
    tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon);
    tray.setToolTip('Rank Up Dota — Live Coach');
    const rebuildTrayMenu = () => tray?.setContextMenu(Menu.buildFromTemplate([
      { label: install.ok ? 'GSI configured ✓' : `GSI setup: ${install.reason}`, enabled: false },
      { label: 'Open coach window', click: () => createWindow() },
      { label: 'Open coach in external browser', click: () => shell.openExternal(coachUrl()) },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]));
    rebuildTrayMenu();
    tray.on('double-click', () => createWindow());
  });

  // Closing the window quits the app (it's the coach surface). macOS keeps the app alive per convention.
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('activate', () => createWindow());
  app.on('before-quit', () => { http?.close(); bridge?.close(); });
}
