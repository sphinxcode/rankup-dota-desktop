// Pure renderer for Dota's Game State Integration config file (plan U1). The Electron installer
// writes the returned text into the cfg dir resolved by steam-path.ts. Kept pure/testable.

// Phase 1 data blocks. NOTE: 'draft' is intentionally omitted — Valve's GSI does not expose the
// enemy draft to a player-mode client, so requesting it adds noise with no benefit. Enemy picks
// come from Phase 2 screen portrait-matching, not GSI. (See plan KTD1/KTD2.)
export const PHASE1_DATA_BLOCKS = [
  'provider', 'map', 'player', 'hero', 'abilities', 'items', 'wearables', 'buildings',
] as const;

export const GSI_CFG_FILENAME = 'gamestate_integration_rankup.cfg';

export type GsiCfgOptions = {
  uri: string;                 // e.g. http://127.0.0.1:3100/
  token: string;               // shared secret echoed back in every GSI POST (auth.token)
  dataBlocks?: readonly string[];
  timeout?: number;
  buffer?: number;
  throttle?: number;
  heartbeat?: number;
};

/** Render the VDF-format GSI config text Dota reads on launch. */
export function renderGsiConfig(opts: GsiCfgOptions): string {
  const {
    uri, token,
    dataBlocks = PHASE1_DATA_BLOCKS,
    timeout = 5.0, buffer = 0.1, throttle = 0.1, heartbeat = 30.0,
  } = opts;

  const data = dataBlocks.map((b) => `    "${b}"     "1"`).join('\n');
  return [
    '"Rank Up Dota Coach"',
    '{',
    `  "uri"       "${uri}"`,
    `  "timeout"   "${timeout.toFixed(1)}"`,
    `  "buffer"    "${buffer.toFixed(1)}"`,
    `  "throttle"  "${throttle.toFixed(1)}"`,
    `  "heartbeat" "${heartbeat.toFixed(1)}"`,
    '  "data"',
    '  {',
    data,
    '  }',
    '  "auth"',
    '  {',
    `    "token"   "${token}"`,
    '  }',
    '}',
    '',
  ].join('\n');
}
