// IO wrapper around the pure steam-path/gsi-cfg cores (plan U1). Resolves the Steam library,
// then writes gamestate_integration_rankup.cfg into Dota's cfg dir. Idempotent: re-running
// overwrites cleanly. This is Electron-main glue — verify on a machine with Steam + Dota.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { dotaCfgDir } from '../core/steam-path.ts';
import { renderGsiConfig, GSI_CFG_FILENAME } from '../core/gsi-cfg.ts';
import { GSI_HTTP_PORT } from '../core/bridge-types.ts';

// Default Steam roots per OS — where libraryfolders.vdf lives. The vdf then points at every
// library (including non-default drives), which steam-path.ts resolves.
function steamRoots(): string[] {
  const home = os.homedir();
  switch (process.platform) {
    case 'win32':
      return ['C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam'];
    case 'darwin':
      return [path.join(home, 'Library', 'Application Support', 'Steam')];
    default: // linux
      return [
        path.join(home, '.steam', 'steam'),
        path.join(home, '.local', 'share', 'Steam'),
        path.join(home, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam'),
      ];
  }
}

function findLibraryFoldersVdf(): string | null {
  for (const root of steamRoots()) {
    const p = path.join(root, 'steamapps', 'libraryfolders.vdf');
    if (existsSync(p)) return p;
  }
  return null;
}

export type InstallResult =
  | { ok: true; cfgPath: string }
  | { ok: false; reason: 'no-steam' | 'no-dota' | 'write-failed'; detail?: string };

/** Resolve Dota's cfg dir and write the GSI config with the given pairing token. */
export function installGsiConfig(token: string): InstallResult {
  const vdfPath = findLibraryFoldersVdf();
  if (!vdfPath) return { ok: false, reason: 'no-steam' };

  let cfgDir: string | null;
  try {
    cfgDir = dotaCfgDir(readFileSync(vdfPath, 'utf8'));
  } catch (e) {
    return { ok: false, reason: 'no-steam', detail: String(e) };
  }
  if (!cfgDir) return { ok: false, reason: 'no-dota' };

  const cfgText = renderGsiConfig({ uri: `http://127.0.0.1:${GSI_HTTP_PORT}/`, token });
  const cfgPath = path.join(cfgDir, GSI_CFG_FILENAME);
  try {
    mkdirSync(cfgDir, { recursive: true });
    writeFileSync(cfgPath, cfgText, 'utf8');
    return { ok: true, cfgPath };
  } catch (e) {
    return { ok: false, reason: 'write-failed', detail: String(e) };
  }
}
