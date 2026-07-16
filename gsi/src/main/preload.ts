// Preload for the in-app coach window. Exposes a minimal, safe surface so the loaded web page can:
//   - receive GSI/vision events pushed from the main process over IPC (instead of a
//     ws://127.0.0.1 socket, which Electron blocks as mixed content from an https page), and
//   - know it is running INSIDE the desktop app, so it can hide "Get the app" (absurd when you're
//     already in it) and offer "Check for updates" instead.
import { contextBridge, ipcRenderer } from 'electron';

// Injected by the main process via webPreferences.additionalArguments — avoids a sync IPC hop.
const version = process.argv.find((a) => a.startsWith('--rankup-version='))?.split('=')[1] ?? '';

contextBridge.exposeInMainWorld('rankupDesktop', {
  /** Desktop app version, e.g. "0.17.0". Presence of this whole object == "we're in the app". */
  version,
  /** Fire the same update check as the tray item. Reports its own result via a native dialog. */
  checkForUpdates: () => ipcRenderer.send('rankup:check-for-updates'),
  // Subscribe to BridgeEvents. Returns an unsubscribe fn. The web hook (useDesktopBridge) detects
  // window.rankupDesktop and prefers this path over WebSocket.
  onEvent: (cb: (evt: unknown) => void) => {
    const listener = (_e: unknown, data: unknown) => { try { cb(data); } catch { /* noop */ } };
    ipcRenderer.on('bridge-event', listener);
    return () => ipcRenderer.removeListener('bridge-event', listener);
  },
});
