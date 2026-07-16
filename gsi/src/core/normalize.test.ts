import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGsi, hasSelfHero, normalizeDraft, resolveAllySide } from './normalize.ts';

test('normalizeGsi: in-game payload with a locked hero → self event', () => {
  const evt = normalizeGsi({
    map: { game_state: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS', clock_time: 123 },
    player: { gold: 1500 },
    hero: { id: 1, name: 'npc_dota_hero_antimage' },
    items: { slot0: { name: 'item_power_treads' }, slot1: { name: 'empty' } },
  });
  assert.equal(evt.kind, 'self');
  assert.equal(evt.heroId, 1);
  assert.equal(evt.inGame, true);
  assert.equal(evt.gold, 1500);
  assert.equal(evt.clock, 123);
  assert.deepEqual(evt.items, ['item_power_treads']);
});

test('normalizeGsi: pre-hero / draft payload → heroId null, not in game', () => {
  const evt = normalizeGsi({ map: { game_state: 'DOTA_GAMERULES_STATE_HERO_SELECTION' }, hero: { id: 0 } });
  assert.equal(evt.heroId, null);
  assert.equal(evt.inGame, false);
});

test('normalizeGsi: missing blocks never throw and omit optional fields', () => {
  const evt = normalizeGsi({});
  assert.deepEqual(evt, { kind: 'self', heroId: null, inGame: false });
  assert.doesNotThrow(() => normalizeGsi(null));
  assert.doesNotThrow(() => normalizeGsi(undefined));
});

test('hasSelfHero: true only when a real hero id is present', () => {
  assert.equal(hasSelfHero({ hero: { id: 14 } }), true);
  assert.equal(hasSelfHero({ hero: { id: 0 } }), false);
  assert.equal(hasSelfHero({}), false);
});

test('normalizeDraft: folds detections into per-slot id lists, de-duped', () => {
  const evt = normalizeDraft([
    { slot: 'enemy', heroId: 2 },
    { slot: 'enemy', heroId: 14 },
    { slot: 'enemy', heroId: 2 }, // dup
    { slot: 'ban', heroId: 5 },
  ]);
  assert.deepEqual(evt, { kind: 'draft', enemy: [2, 14], ban: [5] });
});

test('normalizeDraft: empty detections → bare draft event', () => {
  assert.deepEqual(normalizeDraft([]), { kind: 'draft' });
});

test('normalizeGsi: carries player.team_name through as team', () => {
  assert.equal(normalizeGsi({ player: { team_name: 'dire' } }).team, 'dire');
  assert.equal(normalizeGsi({ player: { team_name: 'radiant' } }).team, 'radiant');
  assert.equal(normalizeGsi({ player: {} }).team, undefined);
  assert.equal(normalizeGsi({}).team, undefined);
});

// --- resolveAllySide: the bug that inverted both lineups when a persona hero went unmatched ---

const dets = [
  { side: 'left' as const, heroId: 1 },
  { side: 'left' as const, heroId: 2 },
  { side: 'right' as const, heroId: 14 },
  { side: 'right' as const, heroId: 8 },
];

test('resolveAllySide: your own hero wins — right', () => {
  assert.equal(resolveAllySide({ detections: dets, selfHeroId: 14, selfTeam: 'radiant' }), 'right',
    'a matched self hero beats team_name, since it is convention-free ground truth');
});

test('resolveAllySide: your own hero wins — left', () => {
  assert.equal(resolveAllySide({ detections: dets, selfHeroId: 2, selfTeam: 'dire' }), 'left');
});

test('resolveAllySide: falls back to team_name when your hero is unmatched (persona case)', () => {
  // Pudge (id 14) wearing an alternate persona matched as Juggernaut, so heroId 99 is absent.
  assert.equal(resolveAllySide({ detections: dets, selfHeroId: 99, selfTeam: 'dire' }), 'right',
    'dire renders on the right of Dota\'s top bar');
  assert.equal(resolveAllySide({ detections: dets, selfHeroId: 99, selfTeam: 'radiant' }), 'left');
});

test('resolveAllySide: team_name alone is enough (no hero id at all, e.g. pre-pick)', () => {
  assert.equal(resolveAllySide({ detections: [], selfHeroId: null, selfTeam: 'dire' }), 'right');
  assert.equal(resolveAllySide({ detections: [], selfHeroId: null, selfTeam: 'radiant' }), 'left');
});

test('resolveAllySide: defaults to left only when GSI gave us neither signal', () => {
  assert.equal(resolveAllySide({ detections: dets, selfHeroId: null, selfTeam: null }), 'left');
  assert.equal(resolveAllySide({ detections: dets, selfHeroId: 99, selfTeam: undefined }), 'left');
  assert.equal(resolveAllySide({ detections: [], selfHeroId: null, selfTeam: 'spectator' }), 'left');
});
