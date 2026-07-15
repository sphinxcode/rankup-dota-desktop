import { test } from 'node:test';
import assert from 'node:assert/strict';
import { l2, bestMatch, DESC_LEN, type Template } from './match.ts';

const solid = (r: number, g: number, b: number): number[] => Array.from({ length: DESC_LEN }, (_, i) => [r, g, b][i % 3]);

test('l2: 0 for identical, grows with difference, rejects length mismatch', () => {
  assert.equal(l2(solid(10, 20, 30), solid(10, 20, 30)), 0);
  assert.ok(l2(solid(0, 0, 0), solid(10, 0, 0)) > 0);
  assert.throws(() => l2([1, 2, 3], [1, 2]));
});

const templates: Template[] = [
  { heroId: 1, desc: solid(200, 0, 0) },   // red hero
  { heroId: 2, desc: solid(0, 200, 0) },   // green hero
  { heroId: 3, desc: solid(0, 0, 200) },   // blue hero
];

test('bestMatch: picks the nearest template within maxDistance', () => {
  const r = bestMatch(solid(190, 10, 10), templates, 1_000_000);
  assert.equal(r!.heroId, 1, 'closest to the red template');
});

test('bestMatch: returns null when nothing is within maxDistance (prefer a miss)', () => {
  // a grey portrait is far from every solid primary; tighten the cut so none qualify
  assert.equal(bestMatch(solid(128, 128, 128), templates, 1_000), null);
});

test('bestMatch: ties break on the lower heroId', () => {
  const tied: Template[] = [
    { heroId: 9, desc: solid(100, 0, 0) },
    { heroId: 4, desc: solid(100, 0, 0) },
  ];
  assert.equal(bestMatch(solid(100, 0, 0), tied, 10)!.heroId, 4);
});

test('end-to-end: a noisy re-capture of the same portrait still matches it', () => {
  const template = solid(180, 40, 60);
  const noisy = template.map((v, i) => v + (i % 5) - 2); // small per-channel noise
  const r = bestMatch(noisy, [{ heroId: 42, desc: template }], 620_000);
  assert.equal(r!.heroId, 42);
});
