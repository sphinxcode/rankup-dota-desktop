// Pure portrait-matching core (plan U7). Tuned empirically against a real Dota strategy-screen
// capture (see scratchpad tuning). Two findings drove the final design:
//   1. NORMALIZE each portrait (zero-mean, unit-variance per descriptor) before comparing — the
//      on-screen render and the CDN card differ in brightness/contrast, and raw RGB L2 gets fooled
//      by that (it ranked Doom over the obvious Warlock). Normalizing compares STRUCTURE/relative
//      color and fixed it (Warlock, Witch Doctor, Wraith King all became correct top-1).
//   2. RATIO TEST — accept a match only when the best candidate is clearly better than the runner
//      up. A wrong match (Legion Commander for a green dragon) had top1≈top2 (382 vs 402); the
//      correct ones had a wide gap. Rejecting near-ties gives "blank beats wrong".
// IO (screen capture, image decode/resize) lives in the Electron glue; this module is pure over
// flat RGB arrays and fully unit-testable.

export const DESC_SIDE = 12; // 12×12 RGB descriptor
export const DESC_LEN = DESC_SIDE * DESC_SIDE * 3;

export type Template = { heroId: number; desc: number[] }; // desc = normalized, length DESC_LEN
export type MatchResult = { heroId: number; distance: number };

/** Zero-mean, unit-variance normalization of a raw descriptor (brightness/contrast invariant). */
export function normalizeDescriptor(raw: number[]): number[] {
  const n = raw.length || 1;
  const mean = raw.reduce((a, b) => a + b, 0) / n;
  let variance = 0;
  for (const x of raw) { const d = x - mean; variance += d * d; }
  const std = Math.sqrt(variance / n) || 1;
  return raw.map((x) => (x - mean) / std);
}

/** Squared-error distance between two equal-length descriptors. */
export function l2(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('l2: length mismatch');
  let d = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] - b[i]; d += x * x; }
  return d;
}

export type MatchOpts = { maxDistance?: number; ratio?: number };

// Tuned on the validation capture: correct matches scored ~220–400 in normalized space with a
// clear gap to the runner-up; wrong matches were near-ties.
export const DEFAULT_MAX_DISTANCE = 470;
export const DEFAULT_RATIO = 0.82;

/**
 * Best template match for a NORMALIZED portrait descriptor. Returns null unless the closest
 * template is (a) within `maxDistance` and (b) meaningfully closer than the runner-up
 * (distance1 <= ratio × distance2) — a wrong hero poisons the coach, so a near-tie is rejected.
 */
export function bestMatch(desc: number[], templates: Template[], opts: MatchOpts = {}): MatchResult | null {
  const maxDistance = opts.maxDistance ?? DEFAULT_MAX_DISTANCE;
  const ratio = opts.ratio ?? DEFAULT_RATIO;
  let d1 = Infinity, d2 = Infinity, id1 = -1;
  for (const t of templates) {
    const d = l2(desc, t.desc);
    if (d < d1) { d2 = d1; d1 = d; id1 = t.heroId; }
    else if (d < d2) { d2 = d; }
  }
  if (id1 < 0 || d1 > maxDistance) return null;
  if (d2 !== Infinity && d1 > ratio * d2) return null; // ambiguous near-tie → reject
  return { heroId: id1, distance: d1 };
}
