import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLibraryFolders, libraryWithDota, dotaCfgDir, DOTA_APPID } from './steam-path.ts';

const winJoin = (...p: string[]) => p.join('\\');
const posixJoin = (...p: string[]) => p.join('/');

const SINGLE = `
"libraryfolders"
{
  "0"
  {
    "path"    "C:\\\\Program Files (x86)\\\\Steam"
    "apps"    { "570"  "12345"  "730"  "999" }
  }
}`;

const MULTI = `
"libraryfolders"
{
  "0"
  {
    "path"    "C:\\\\Program Files (x86)\\\\Steam"
    "apps"    { "730"  "999" }
  }
  "1"
  {
    "path"    "D:\\\\SteamLibrary"
    "apps"    { "570"  "12345" }
  }
}`;

test('parseLibraryFolders: extracts path + appids per library', () => {
  const libs = parseLibraryFolders(SINGLE);
  assert.equal(libs.length, 1);
  assert.equal(libs[0].path, 'C:\\Program Files (x86)\\Steam');
  assert.ok(libs[0].apps.includes(DOTA_APPID));
});

test('libraryWithDota: picks the library whose apps include 570', () => {
  const libs = parseLibraryFolders(MULTI);
  const lib = libraryWithDota(libs);
  assert.ok(lib);
  assert.equal(lib!.path, 'D:\\SteamLibrary', 'Dota is in the second library');
});

test('dotaCfgDir: joins the resolved library with the GSI cfg subpath (Windows)', () => {
  const dir = dotaCfgDir(MULTI, winJoin);
  assert.equal(dir, 'D:\\SteamLibrary\\steamapps\\common\\dota 2 beta\\game\\dota\\cfg\\gamestate_integration');
});

test('dotaCfgDir: cross-platform join (POSIX)', () => {
  const dir = dotaCfgDir(SINGLE, posixJoin);
  assert.equal(dir, 'C:\\Program Files (x86)\\Steam/steamapps/common/dota 2 beta/game/dota/cfg/gamestate_integration');
});

test('dotaCfgDir: returns null when Dota is not installed in any library', () => {
  const noDota = `"libraryfolders" { "0" { "path" "C:\\\\Steam" "apps" { "730" "1" } } }`;
  assert.equal(dotaCfgDir(noDota, winJoin), null);
});

test('parseLibraryFolders: empty/garbage input is safe', () => {
  assert.deepEqual(parseLibraryFolders(''), []);
  assert.deepEqual(parseLibraryFolders('not vdf'), []);
  // @ts-expect-error deliberate bad input
  assert.deepEqual(parseLibraryFolders(null), []);
});
