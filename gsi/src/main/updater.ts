// Auto-update via electron-updater against our existing electron-builder + GitHub Releases setup.
// Pattern adapted from shipping tray apps (pear-desktop/th-ch youtube-music): gate on packaged
// builds, delay the first background check so launch isn't blocked, ASK before downloading rather
// than surprising the user, and offer an explicit restart.
//
// PLATFORM REALITY (why this is Windows-only for now):
//   - Windows: electron-updater supports NSIS (not MSI — that's why the build ships nsis). Works
//     unsigned, but SmartScreen still warns on the installer launch; the download/stage is silent.
//   - macOS: Squirrel.Mac REQUIRES a signed app. Unsigned auto-update fails outright, so we don't
//     pretend — mac users get the download page instead.
//   - Linux: .deb has no auto-update path (only AppImage does), so same fallback.
import { app, dialog, shell } from 'electron';
import electronUpdater from 'electron-updater';

const { autoUpdater } = electronUpdater;
const RELEASES_URL = 'https://github.com/sphinxcode/rankup-dota-desktop/releases/latest';

/** True only where electron-updater can actually deliver an update today. */
export function updatesSupported(): boolean {
  return app.isPackaged && process.platform === 'win32';
}

// Distinguishes a user-initiated check (which should report "you're up to date" / errors) from the
// quiet background one (which should stay silent).
let manualCheck = false;

export function setupUpdater(): void {
  if (!updatesSupported()) return;

  autoUpdater.autoDownload = false;        // ask first — don't burn bandwidth behind the user's back
  autoUpdater.autoInstallOnAppQuit = true; // if downloaded, apply on next quit

  autoUpdater.on('update-available', async (info) => {
    manualCheck = false;
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update available',
      message: `Rank Up Dota ${info.version} is available.`,
      detail: `You're on ${app.getVersion()}. Download it now?`,
    });
    if (response === 0) autoUpdater.downloadUpdate().catch(() => {});
  });

  autoUpdater.on('update-not-available', () => {
    if (manualCheck) {
      dialog.showMessageBox({
        type: 'info',
        title: 'No update',
        message: "You're up to date.",
        detail: `Rank Up Dota ${app.getVersion()} is the latest version.`,
      });
    }
    manualCheck = false;
  });

  autoUpdater.on('error', (err) => {
    if (manualCheck) {
      dialog.showMessageBox({
        type: 'error',
        title: 'Update check failed',
        message: "Couldn't check for updates.",
        detail: String(err?.message ?? err),
      });
    }
    manualCheck = false;
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `Rank Up Dota ${info.version} is ready to install.`,
      detail: 'The app will restart to finish updating. Windows may warn about an unknown publisher — the app is unsigned.',
    });
    if (response === 0) setImmediate(() => autoUpdater.quitAndInstall());
  });

  // Quiet background check shortly after launch — never on every tick, never blocking startup.
  setTimeout(() => { autoUpdater.checkForUpdates().catch(() => {}); }, 2000);
}

/** Tray "Check for updates…" — reports its outcome, unlike the background check. */
export function checkForUpdatesNow(): void {
  if (!app.isPackaged) {
    dialog.showMessageBox({ type: 'info', message: 'Updates are disabled in development builds.' });
    return;
  }
  if (!updatesSupported()) {
    // mac/linux: be honest rather than failing silently, and hand them the download.
    dialog.showMessageBox({
      type: 'info',
      buttons: ['Open downloads', 'Close'],
      defaultId: 0,
      title: 'Check for updates',
      message: 'Automatic updates aren\'t available on this platform yet.',
      detail: 'macOS updates need a signed build, and .deb has no update channel. Grab the latest from the releases page.',
    }).then(({ response }) => { if (response === 0) shell.openExternal(RELEASES_URL); });
    return;
  }
  manualCheck = true;
  autoUpdater.checkForUpdates().catch((e) => {
    manualCheck = false;
    dialog.showMessageBox({ type: 'error', message: "Couldn't check for updates.", detail: String(e?.message ?? e) });
  });
}
