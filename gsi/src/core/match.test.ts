import { test } from 'node:test';
import assert from 'node:assert/strict';
import { averageHash, hammingDistance, confidenceFromDistance, bestMatch, HASH_SIDE, type Template } from './match.ts';

// A 4×4 grayscale block: left half dark, right half bright → predictable aHash.
const HALF = [
  0, 0, 200, 200,
  0, 0, 200, 200,
  0, 0, 200, 200,
  0, 0, 200, 200,
];

test('averageHash: sets 1 where pixel >= mean', () => {
  const h = averageHash(HALF, 4);
  assert.equal(h, '0011001100110011');
});

test('averageHash: rejects a pixel array of the wrong length', () => {
  assert.throws(() => averageHash([1, 2, 3], 4));
});

test('hammingDistance: counts differing bits', () => {
  assert.equal(hammingDistance('0000', '0000'), 0);
  assert.equal(hammingDistance('0000', '1010'), 2);
  assert.throws(() => hammingDistance('00', '0000'));
});

test('confidenceFromDistance: 1.0 at distance 0, lower as distance grows', () => {
  assert.equal(confidenceFromDistance(0, 64), 1);
  assert.equal(confidenceFromDistance(64, 64), 0);
  assert.equal(confidenceFromDistance(6, 64), 1 - 6 / 64);
});

const templates: Template[] = [
  { heroId: 1, hash: '00000000' },
  { heroId: 2, hash: '11110000' },
  { heroId: 3, hash: '11111111' },
];

test('bestMatch: returns the closest template within maxDistance', () => {
  const r = bestMatch('11110001', templates, 3);
  assert.ok(r);
  assert.equal(r!.heroId, 2, 'closest to 11110000 (distance 1)');
  assert.equal(r!.distance, 1);
});

test('bestMatch: returns null when nothing is within maxDistance (prefer a miss)', () => {
  assert.equal(bestMatch('01010101', templates, 2), null);
});

test('bestMatch: ties break on the lower heroId for determinism', () => {
  const tied: Template[] = [
    { heroId: 9, hash: '1100' },
    { heroId: 4, hash: '0011' },
  ];
  const r = bestMatch('1001', tied, 4); // distance 2 to both
  assert.equal(r!.heroId, 4);
});

test('end-to-end: hash a crop, then match it against a template built from the same icon', () => {
  const templateHash = averageHash(HALF, 4);
  const capturedSlightlyNoisy = [
    5, 0, 190, 210,
    0, 8, 205, 200,
    0, 0, 200, 200,
    2, 0, 200, 195,
  ];
  const capturedHash = averageHash(capturedSlightlyNoisy, 4);
  const r = bestMatch(capturedHash, [{ heroId: 42, hash: templateHash }], 4);
  assert.equal(r!.heroId, 42, 'noisy re-capture of the same portrait still matches');
});

test('HASH_SIDE default produces a 64-bit hash', () => {
  const gray = new Array(HASH_SIDE * HASH_SIDE).fill(0).map((_, i) => (i % 2 ? 255 : 0));
  assert.equal(averageHash(gray).length, 64);
});
