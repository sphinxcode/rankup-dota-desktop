# Rank Up Dota — Desktop GSI Companion

Electron companion that reads Dota 2 **safely** and streams live picks to the Rank Up Dota web app
over a **local WebSocket** (`ws://127.0.0.1`). Implements the plan at
`docs/plans/2026-07-15-001-feat-desktop-gsi-live-picks-plan.md`.

- **No memory reading, no packet sniffing, no VAC risk.** Phase 1 uses Valve's official Game State
  Integration (GSI). Phase 2 reads the user's **own screen** (portrait image-matching) for the enemy
  draft — the only ToS-safe way to see enemy picks, and the method STRATZ+ actually used.
- **Phase 1 (built):** auto-detects your own hero + live in-game state → the site auto-loads your build.
- **Phase 2 (gated on the U6 spike):** screen portrait-matching for the enemy/ally/ban draft.

## Repo split note

This lives inside the `dota2-coach` repo under `desktop-gsi/` for now (coexists with the legacy Pake
webview in `../desktop/`, which stays the live download until this ships). It is **not** part of the
web/server build — nothing in `web/` or `server/` imports it. Intended to move to the standalone
`github.com/sphinxcode/rankup-dota-desktop` repo (or have CI point here) when released. When it ships,
update `web/src/components/DownloadModal.tsx` (`REL` + `PLATFORMS`) to the new release assets.

## Layout

```
src/core/     pure, unit-tested — no Electron, no IO
  bridge-types.ts   wire contract (mirror of web/src/lib/gsiBridge.ts)
  steam-path.ts     libraryfolders.vdf → Dota cfg dir
  gsi-cfg.ts        render gamestate_integration_rankup.cfg
  normalize.ts      GSI payload / vision detections → BridgeEvent
  match.ts          average-hash + best-match portrait recognition
src/main/     Electron glue — verify on a real machine
  index.ts          app entry: token, cfg install, HTTP+WS, tray, opens site with ?bridge=
  gsi-cfg-install.ts  resolves Steam path + writes the cfg
  gsi-http.ts       127.0.0.1:3100 GSI listener (token-checked)
  bridge-ws.ts      127.0.0.1:52100 token+origin-gated WebSocket bridge
  vision/           Phase 2 (screen capture, matching, detect loop)
scripts/vision-spike.mjs   U6 validation harness (run on a real machine)
docs/vision-spike-findings.md  U6 GO/NO-GO + crop calibration (PENDING)
```

## Data flow

```
Dota 2 ──GSI POST──▶ 127.0.0.1:3100 ──normalize──▶ WS 127.0.0.1:52100 ──▶ browser (DraftContext)
Dota 2 ──(draft screen pixels)──▶ vision match ──▶ same WS ──▶ browser   (Phase 2)
```

## Develop / test / build

```bash
npm install            # NOT on the RAM-limited VPS — do this on a dev box
npm run test:unit      # pure-core tests (no Electron/Steam/Dota needed) — these run anywhere
npm run spike:vision   # U6 harness — run on a machine with Dota 2 in a real draft
npm run dev            # launch the Electron app locally
npm run build          # tsc + electron-builder → release/ (win/mac/linux installers)
```

## Verification status

- ✅ **Pure cores** (`steam-path`, `gsi-cfg`, `normalize`, `match`): unit-tested (`npm run test:unit`),
  and also wired into the parent repo's suite.
- ⏳ **Electron glue** (`index`, `gsi-http`, `bridge-ws`, `vision/*`): written to standard patterns;
  **verify on a real machine** with Steam + Dota + a display. Not runnable on headless CI.
- ⏳ **Phase 2 vision**: `PLACEHOLDER_REGIONS` in `vision/capture.ts` must be filled from the U6 spike
  before the detect loop is enabled.
