// Pure Steam-library resolution (plan U1). No filesystem IO here — callers read
// `libraryfolders.vdf` and pass its text in, so this is unit-testable without a Steam install.
// The actual file read + write lives in the Electron glue (src/main/gsi-cfg-install.ts).
import path from 'node:path';

// Dota 2's Steam appid. The library whose `apps` block lists this id is where Dota is installed.
export const DOTA_APPID = '570';
// Relative path from a Steam library root to Dota's GSI cfg directory.
export const DOTA_CFG_SUBPATH = ['steamapps', 'common', 'dota 2 beta', 'game', 'dota', 'cfg', 'gamestate_integration'];

export type SteamLibrary = { path: string; apps: string[] };

/**
 * Parse a Steam `libraryfolders.vdf` into a list of libraries with their installed appids.
 * Tolerant of both the modern (nested object per library) and legacy (flat "path") formats.
 */
export function parseLibraryFolders(vdf: string): SteamLibrary[] {
  const libs: SteamLibrary[] = [];
  if (typeof vdf !== 'string' || !vdf) return libs;

  // Match each `"path" "<value>"` and, for each, the nearest following `"apps" { ... }` block.
  const pathRe = /"path"\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(vdf))) {
    const libPath = m[1].replace(/\\\\/g, '\\'); // VDF escapes backslashes
    // Look at the slice after this path for the library's apps block (bounded to avoid bleeding
    // into the next library entry).
    const rest = vdf.slice(m.index);
    const appsMatch = /"apps"\s*\{([^}]*)\}/.exec(rest);
    const apps: string[] = [];
    if (appsMatch) {
      const appIdRe = /"(\d+)"\s*"\d+"/g;
      let a: RegExpExecArray | null;
      while ((a = appIdRe.exec(appsMatch[1]))) apps.push(a[1]);
    }
    libs.push({ path: libPath, apps });
  }
  return libs;
}

/** Return the Steam library that has Dota 2 installed, or null. */
export function libraryWithDota(libs: SteamLibrary[]): SteamLibrary | null {
  return libs.find((l) => l.apps.includes(DOTA_APPID)) ?? null;
}

/**
 * Resolve Dota's GSI cfg directory from `libraryfolders.vdf` text. Returns null when Dota
 * isn't found in any library. `join` is injectable for cross-platform testing (defaults to
 * the host's path.join).
 */
export function dotaCfgDir(vdf: string, join: (...parts: string[]) => string = path.join): string | null {
  const lib = libraryWithDota(parseLibraryFolders(vdf));
  if (!lib) return null;
  return join(lib.path, ...DOTA_CFG_SUBPATH);
}
