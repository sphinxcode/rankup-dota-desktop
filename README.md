# Rank Up Dota — Desktop apps (Windows / macOS / Linux)

The desktop app is a **Pake** (Tauri/Rust) wrapper around the live site — a ~5 MB
native window that always shows the latest deployed app. Because the main repo is
**private** (its GitHub Release assets aren't publicly downloadable) and Pake only
needs the **URL** (not the source), the installers are built + hosted in a tiny
**public** repo.

## One-time setup

1. Create a **public** GitHub repo, e.g. `sphinxcode/rankup-dota-desktop`.
2. Add `build-desktop-apps.yml` (in this folder) to it at
   `.github/workflows/build-desktop-apps.yml`.
3. Actions tab → **Build Desktop Apps** → **Run workflow** → set a version (`v0.1.0`).
   ~10–15 min; the Windows/macOS/Linux jobs each publish to the same Release.

## How the app links to it

`web/src/components/DownloadModal.tsx` links to the public repo's stable
`releases/latest/download/` URLs:

| Platform | Asset |
|----------|-------|
| Windows  | `RankUpDota-windows.msi` |
| macOS    | `RankUpDota-macos.dmg` |
| Linux    | `RankUpDota-linux.deb` |

If you name the public repo something other than `rankup-dota-desktop`, update the
`REL` constant in `DownloadModal.tsx` to match.

## Notes

- The wrapped URL defaults to `https://dota.sphinx.codes` — make sure the custom
  domain is routing (Cloudflare) before shipping installers, or wrap the
  `*.up.railway.app` URL for testing.
- Icon: currently Pake's default (placeholder). To brand it, add a real `.ico`
  (Windows) / `.icns` (macOS) / `.png` (Linux) and pass `icon:` to the Pake step.
  A placeholder SVG lives at `web/public/app-icon.svg` (used as the site favicon).
- Steam login inside the native webview: the OpenID redirect returns to
  `PUBLIC_BASE_URL`; since Pake wraps that same origin it should land back in-app,
  but verify in the built app (some webviews pop OAuth to the system browser).
