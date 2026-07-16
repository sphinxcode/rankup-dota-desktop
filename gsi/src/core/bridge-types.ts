// The wire contract between the desktop app and the web app. MUST stay in sync with the
// browser-side copy at web/src/lib/gsiBridge.ts (BridgeEvent / BridgeSelfEvent / BridgeDraftEvent).
// Kept as a standalone pure module so both the Electron main process and the unit tests can
// import it without pulling in Electron.
export type BridgeSelfEvent = {
  kind: 'self';
  heroId: number | null;
  inGame?: boolean;
  gameState?: string; // raw GSI map.game_state — used by the app to trigger enemy screen-reading
  /** GSI player.team_name ('radiant' | 'dire'). Decides which side of the top bar is yours WITHOUT
   *  depending on vision — a hero wearing an alternate persona won't match its template, which
   *  silently inverted both teams before this existed. */
  team?: string;
  items?: string[];
  gold?: number;
  clock?: number;
};

// The entire pre-horn window — pick/ban phase through strategy time. We pixel-check the screen
// continuously across ALL of these so enemies are read the instant they become visible, whatever
// the mode: Captain's Mode shows picks live during HERO_SELECTION; All Pick/Turbo only reveal them
// at STRATEGY_TIME. Checking the whole window covers every mode without special-casing.
export const PREGAME_STATES = [
  'DOTA_GAMERULES_STATE_HERO_SELECTION',
  'DOTA_GAMERULES_STATE_STRATEGY_TIME',
  'DOTA_GAMERULES_STATE_PRE_GAME',
];

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
