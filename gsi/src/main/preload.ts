// Preload for the in-app coach window. Exposes a minimal, safe bridge so the loaded web page can
// receive GSI/vision events pushed from the main process over IPC — instead of opening a
// ws://127.0.0.1 socket, which Electron blocks as mixed content from an https page. This is why
// the in-app hero detection works where the embedded WebSocket did not.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('rankupDesktop', {
  version: '0.5.0',
  // Subscribe to BridgeEvents. Returns an unsubscribe fn. The web hook (useDesktopBridge) detects
  // window.rankupDesktop and prefers this path over WebSocket.
  onEvent: (cb: (evt: unknown) => void) => {
    const listener = (_e: unknown, data: unknown) => { try { cb(data); } catch { /* noop */ } };
    ipcRenderer.on('bridge-event', listener);
    return () => ipcRenderer.removeListener('bridge-event', listener);
  },
});
