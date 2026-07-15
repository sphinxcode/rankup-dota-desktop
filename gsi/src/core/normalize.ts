// Pure normalization of raw GSI payloads (and vision detections) into BridgeEvents (plan U2/U8).
// No IO — the HTTP listener parses JSON and hands the object here. Never throws on partial/odd
// payloads: GSI blocks come and go depending on game phase and the cfg's data toggles.
import type { BridgeSelfEvent, BridgeDraftEvent } from './bridge-types.ts';

// Dota reports this game_state string once the match is actually in progress.
const IN_PROGRESS = 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS';

type RawGsi = {
  map?: { game_state?: string; clock_time?: number } | null;
  player?: { gold?: number } | null;
  hero?: { id?: number; name?: string } | null;
  items?: Record<string, { name?: string }> | null;
};

/** Normalize a GSI POST body into a `self` BridgeEvent (the local player's own state). */
export function normalizeGsi(raw: RawGsi | null | undefined): BridgeSelfEvent {
  const hero = raw?.hero ?? null;
  // GSI uses hero.id === 0 / name 'npc_dota_hero_' for "no hero picked yet"; treat as null.
  const rawId = typeof hero?.id === 'number' ? hero.id : null;
  const heroId = rawId && rawId > 0 ? rawId : null;
  const inGame = raw?.map?.game_state === IN_PROGRESS;

  const evt: BridgeSelfEvent = { kind: 'self', heroId, inGame };
  if (typeof raw?.player?.gold === 'number') evt.gold = raw.player.gold;
  if (typeof raw?.map?.clock_time === 'number') evt.clock = raw.map.clock_time;
  const items = raw?.items
    ? Object.values(raw.items).map((i) => i?.name).filter((n): n is string => typeof n === 'string' && n !== 'empty')
    : [];
  if (items.length) evt.items = items;
  return evt;
}

/** Whether a GSI payload carries the local player's locked-in hero (worth pushing). */
export function hasSelfHero(raw: RawGsi | null | undefined): boolean {
  return normalizeGsi(raw).heroId != null;
}

export type Detection = { slot: 'enemy' | 'ally' | 'ban'; heroId: number };

/** Fold vision detections into a `draft` BridgeEvent (Phase 2). */
export function normalizeDraft(detections: Detection[]): BridgeDraftEvent {
  const evt: BridgeDraftEvent = { kind: 'draft' };
  for (const d of detections) {
    const list = (evt[d.slot] ??= []);
    if (!list.includes(d.heroId)) list.push(d.heroId);
  }
  return evt;
}
