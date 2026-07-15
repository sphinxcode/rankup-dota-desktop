// The wire contract between the desktop app and the web app. MUST stay in sync with the
// browser-side copy at web/src/lib/gsiBridge.ts (BridgeEvent / BridgeSelfEvent / BridgeDraftEvent).
// Kept as a standalone pure module so both the Electron main process and the unit tests can
// import it without pulling in Electron.
export type BridgeSelfEvent = {
  kind: 'self';
  heroId: number | null;
  inGame?: boolean;
  gameState?: string; // raw GSI map.game_state — used by the app to trigger enemy screen-reading
  items?: string[];
  gold?: number;
  clock?: number;
};

// GSI game_state where all heroes (incl. enemies) are revealed on the strategy screen but the
// game hasn't started — the window to screen-read the enemy lineup.
export const STRATEGY_STATES = ['DOTA_GAMERULES_STATE_STRATEGY_TIME', 'DOTA_GAMERULES_STATE_PRE_GAME'];

export type BridgeDraftEvent = {
  kind: 'draft';
  enemy?: number[];
  ally?: number[];
  ban?: number[];
};

export type BridgeEvent = BridgeSelfEvent | BridgeDraftEvent;

// Loopback port the WS bridge listens on — must match web/src/lib/gsiBridge.ts BRIDGE_PORT.
export const BRIDGE_PORT = 52100;
// Loopback port Dota's GSI POSTs to (the cfg's uri) — must match the rendered cfg.
export const GSI_HTTP_PORT = 3100;
