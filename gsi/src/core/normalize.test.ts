import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGsi, hasSelfHero, normalizeDraft } from './normalize.ts';

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
