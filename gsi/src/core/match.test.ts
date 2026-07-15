import { test } from 'node:test';
import assert from 'node:assert/strict';
import { l2, bestMatch, normalizeDescriptor, DESC_LEN, type Template } from './match.ts';

// A descriptor with structure (not a flat color, which would normalize to all-zeros).
const grad = (seed: number): number[] => Array.from({ length: DESC_LEN }, (_, i) => (i * 7 + seed * 13) % 256);

test('normalizeDescriptor: zero mean, unit variance', () => {
  const v = normalizeDescriptor(grad(1));
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const std = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  assert.ok(Math.abs(mean) < 1e-9, 'mean ~ 0');
  assert.ok(Math.abs(std - 1) < 1e-9, 'std ~ 1');
});

test('normalizeDescriptor: flat input degrades safely (no divide-by-zero)', () => {
  const v = normalizeDescriptor(Array(DESC_LEN).fill(128));
  assert.ok(v.every((x) => x === 0));
});

test('l2: identical=0, grows with difference, rejects length mismatch', () => {
  const a = normalizeDescriptor(grad(2));
  assert.equal(l2(a, a), 0);
  assert.ok(l2(a, normalizeDescriptor(grad(9))) > 0);
  assert.throws(() => l2([1, 2], [1, 2, 3]));
});

const T = (id: number, seed: number): Template => ({ heroId: id, desc: normalizeDescriptor(grad(seed)) });

test('bestMatch: returns the clear nearest template', () => {
  const templates = [T(1, 1), T(2, 50), T(3, 120)];
  const query = normalizeDescriptor(grad(1).map((x, i) => x + (i % 3))); // tiny noise on seed 1
  const r = bestMatch(query, templates, { maxDistance: 1e9, ratio: 1 });
  assert.equal(r!.heroId, 1);
});

test('bestMatch: rejects when nothing is within maxDistance', () => {
  const templates = [T(1, 1), T(2, 50)];
  assert.equal(bestMatch(normalizeDescriptor(grad(200)), templates, { maxDistance: 1, ratio: 1 }), null);
});

test('bestMatch: ratio test rejects an ambiguous near-tie (blank beats wrong)', () => {
  // Two templates almost equally distant from the query → reject.
  const q = normalizeDescriptor(grad(5));
  const a = normalizeDescriptor(grad(5).map((x, i) => x + (i % 2 ? 40 : -40)));
  const b = normalizeDescriptor(grad(5).map((x, i) => x + (i % 2 ? -40 : 40)));
  const r = bestMatch(q, [{ heroId: 1, desc: a }, { heroId: 2, desc: b }], { maxDistance: 1e9, ratio: 0.82 });
  assert.equal(r, null, 'near-tie is rejected');
});

test('bestMatch: accepts a clear winner over a distant runner-up', () => {
  const q = normalizeDescriptor(grad(5));
  const near = normalizeDescriptor(grad(5).map((x, i) => x + (i % 5)));  // very close
  const far = normalizeDescriptor(grad(180));                            // far
  const r = bestMatch(q, [{ heroId: 7, desc: near }, { heroId: 8, desc: far }], { maxDistance: 1e9, ratio: 0.82 });
  assert.equal(r!.heroId, 7);
});
