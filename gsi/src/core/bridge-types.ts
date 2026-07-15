// The wire contract between the desktop app and the web app. MUST stay in sync with the
// browser-side copy at web/src/lib/gsiBridge.ts (BridgeEvent / BridgeSelfEvent / BridgeDraftEvent).
// Kept as a standalone pure module so both the Electron main process and the unit tests can
// import it without pulling in Electron.
export type BridgeSelfEvent = {
  kind: 'self';
  heroId: number | null;
  inGame?: boolean;
  items?: string[];
  gold?: number;
  clock?: number;
};

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
