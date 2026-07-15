// Pure portrait-matching core (plan U7). Validated against a real Dota strategy-screen capture:
// a COLOR descriptor (downsampled RGB + L2 distance) reliably identifies hero portraits, where a
// grayscale hash did not (heroes are color-distinct). IO — screen capture + image decode/resize —
// lives in the Electron glue (src/main/vision/*). This module is pure over flat RGB arrays, so it
// is fully unit-testable with synthetic data and has zero native/Electron deps.

export const DESC_SIDE = 10; // 10×10 RGB descriptor
export const DESC_LEN = DESC_SIDE * DESC_SIDE * 3;

export type Template = { heroId: number; desc: number[] }; // desc length === DESC_LEN
export type MatchResult = { heroId: number; distance: number };

/** Squared-error distance between two equal-length RGB descriptors. */
export function l2(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('l2: length mismatch');
  let d = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] - b[i]; d += x * x; }
  return d;
}

/**
 * Best template match for a portrait descriptor. Returns null when the closest template is
 * farther than `maxDistance` (prefer a MISS over a wrong hero — a wrong enemy poisons the coach
 * output, and the user can fill a blank slot manually). Ties break on lower heroId for determinism.
 */
export function bestMatch(desc: number[], templates: Template[], maxDistance: number): MatchResult | null {
  let best: MatchResult | null = null;
  for (const t of templates) {
    const distance = l2(desc, t.desc);
    if (distance > maxDistance) continue;
    if (!best || distance < best.distance || (distance === best.distance && t.heroId < best.heroId)) {
      best = { heroId: t.heroId, distance };
    }
  }
  return best;
}

/** Default confidence cut, tuned from validation: confident correct matches scored well under this. */
export const DEFAULT_MAX_DISTANCE = 620_000;
