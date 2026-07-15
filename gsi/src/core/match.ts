// Pure perceptual-hash matching core for screen portrait-matching (plan U7). The IO — capturing
// the screen and decoding PNGs to pixels — lives in the Electron glue (src/main/vision/capture.ts).
// This module works on plain grayscale pixel arrays, so it is fully unit-testable with synthetic
// data and has zero native/Electron dependencies.
//
// Approach: average-hash (aHash). Downscale a portrait crop to N×N grayscale, then set each bit
// to 1 where the pixel is >= the mean. Two portraits match when their hashes are within a small
// Hamming distance. Robust to minor scaling/compression; the reference templates are built from
// the same canonical hero icons the website uses (data/hero-summary.json CDN images), plus persona
// variants (each mapped to its base hero id) discovered by the U6 validation spike.

export const HASH_SIDE = 8; // 8×8 → 64-bit hash

export type Template = { heroId: number; hash: string };
export type MatchResult = { heroId: number; confidence: number; distance: number };

/**
 * Average-hash a grayscale pixel array already downscaled to `side`×`side`.
 * Returns a bit string of length side*side ('1' where pixel >= mean).
 */
export function averageHash(gray: number[], side = HASH_SIDE): string {
  const n = side * side;
  if (gray.length !== n) throw new Error(`averageHash: expected ${n} pixels, got ${gray.length}`);
  const mean = gray.reduce((a, b) => a + b, 0) / n;
  let bits = '';
  for (let i = 0; i < n; i++) bits += gray[i] >= mean ? '1' : '0';
  return bits;
}

/** Hamming distance between two equal-length bit strings. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) throw new Error('hammingDistance: length mismatch');
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

/** Confidence in [0,1] from a Hamming distance over an n-bit hash. */
export function confidenceFromDistance(distance: number, bits: number): number {
  return 1 - distance / bits;
}

/**
 * Best template match for a portrait hash. Returns null when the closest template is farther
 * than `maxDistance` (prefer a miss over a wrong hero — a wrong enemy poisons coach output).
 * Ties break on the lower heroId for determinism.
 */
export function bestMatch(hash: string, templates: Template[], maxDistance = 10): MatchResult | null {
  const bits = hash.length;
  let best: MatchResult | null = null;
  for (const t of templates) {
    const distance = hammingDistance(hash, t.hash);
    if (distance > maxDistance) continue;
    if (
      !best ||
      distance < best.distance ||
      (distance === best.distance && t.heroId < best.heroId)
    ) {
      best = { heroId: t.heroId, confidence: confidenceFromDistance(distance, bits), distance };
    }
  }
  return best;
}
