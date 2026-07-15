import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  l2, bestMatch, normalizeDescriptor, histogram, buildDescriptor,
  SPATIAL_LEN, HIST_BINS, HIST_WEIGHT, type Template,
} from './match.ts';

const grad = (seed: number, len = SPATIAL_LEN): number[] => Array.from({ length: len }, (_, i) => (i * 7 + seed * 13) % 256);

test('normalizeDescriptor: zero mean, unit variance; flat input safe', () => {
  const v = normalizeDescriptor(grad(1));
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  assert.ok(Math.abs(mean) < 1e-9);
  assert.ok(normalizeDescriptor(Array(SPATIAL_LEN).fill(128)).every((x) => x === 0));
});

test('histogram: right length, sums to weight, buckets by color', () => {
  const h = histogram(grad(3, 24 * 24 * 3));
  assert.equal(h.length, HIST_BINS ** 3);
  assert.ok(Math.abs(h.reduce((a, b) => a + b, 0) - HIST_WEIGHT) < 1e-6, 'sums to the weight');
  // all-red 24×24 → mass in the top-red bin only
  const red = histogram(Array.from({ length: 24 * 24 * 3 }, (_, i) => (i % 3 === 0 ? 255 : 0)));
  const nonzero = red.filter((x) => x > 0);
  assert.equal(nonzero.length, 1);
});

test('buildDescriptor: concatenates normalized spatial + histogram', () => {
  const d = buildDescriptor(grad(1), grad(2, 24 * 24 * 3));
  assert.equal(d.length, SPATIAL_LEN + HIST_BINS ** 3);
});

test('l2: identical=0, rejects length mismatch', () => {
  const a = buildDescriptor(grad(2), grad(2, 24 * 24 * 3));
  assert.equal(l2(a, a), 0);
  assert.throws(() => l2([1, 2], [1, 2, 3]));
});

const T = (id: number, seed: number): Template => ({ heroId: id, desc: buildDescriptor(grad(seed), grad(seed, 24 * 24 * 3)) });

test('bestMatch: returns the clear nearest template', () => {
  const templates = [T(1, 1), T(2, 60), T(3, 130)];
  const q = buildDescriptor(grad(1).map((x, i) => x + (i % 3)), grad(1, 24 * 24 * 3));
  assert.equal(bestMatch(q, templates, { maxDistance: 1e12, ratio: 1 })!.heroId, 1);
});

test('bestMatch: rejects when outside maxDistance', () => {
  assert.equal(bestMatch(T(1, 1).desc, [T(2, 90)], { maxDistance: 1, ratio: 1 }), null);
});

test('bestMatch: ratio test rejects an ambiguous near-tie (blank beats wrong)', () => {
  const q = buildDescriptor(grad(5), grad(5, 24 * 24 * 3));
  const a = { heroId: 1, desc: buildDescriptor(grad(5).map((x, i) => x + (i % 2 ? 40 : -40)), grad(5, 24 * 24 * 3)) };
  const b = { heroId: 2, desc: buildDescriptor(grad(5).map((x, i) => x + (i % 2 ? -40 : 40)), grad(5, 24 * 24 * 3)) };
  assert.equal(bestMatch(q, [a, b], { maxDistance: 1e12, ratio: 0.9 }), null);
});
