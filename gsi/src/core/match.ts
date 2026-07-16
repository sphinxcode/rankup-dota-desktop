// Pure portrait-matching core (plan U7). Tuned empirically against a real Dota strategy-screen
// capture with full ground truth (Faceless Void/Dragon Knight/Death Prophet/Zeus/Lion +
// Warlock/Witch Doctor/Sven/Wraith King/Viper). Three findings drove the final descriptor, each
// verified to lift accuracy on that data:
//   1. NORMALIZED SPATIAL — a 12×12 RGB grid, zero-mean/unit-variance per portrait (brightness/
//      contrast invariant), so the live 3D render and the 2D CDN card compare on structure.
//   2. COLOR HISTOGRAM — a 4×4×4 RGB histogram (weight-80) concatenated on. Normalization scrubs
//      absolute color, which made a green Viper match a red Legion Commander; the histogram
//      restores palette discrimination. This took enemy accuracy from 4/5 to 5/5 (Viper 11th→1st).
//   3. RATIO + ABS gate — accept only a clear-enough winner within an absolute distance; a wrong
//      hero poisons the coach, so ambiguous slots stay blank.
// IO (screen capture, decode/resize) lives in the Electron glue; this module is pure and tested.

export const SPATIAL_SIDE = 12;     // 12×12 RGB spatial grid
export const HIST_SIDE = 24;        // histogram sampled from a 24×24 crop
export const HIST_BINS = 4;         // 4×4×4 = 64-bin RGB histogram
// CROSS-VALIDATED over 30 labeled heroes across 3 real games (not one screenshot — an earlier
// single-sample tune scored a meaningless "10/10" and generalized at only ~60%). Sweeping the
// histogram weight against all 3 games: 40 → 87% at zero offset, 80 → ~77%, 160 → 46%.
export const HIST_WEIGHT = 40;
export const SPATIAL_LEN = SPATIAL_SIDE * SPATIAL_SIDE * 3;

export type Template = { heroId: number; desc: number[] };
export type MatchResult = { heroId: number; distance: number };

/** Zero-mean, unit-variance normalization (brightness/contrast invariant). */
export function normalizeDescriptor(raw: number[]): number[] {
  const n = raw.length || 1;
  const mean = raw.reduce((a, b) => a + b, 0) / n;
  let variance = 0;
  for (const x of raw) { const d = x - mean; variance += d * d; }
  const std = Math.sqrt(variance / n) || 1;
  return raw.map((x) => (x - mean) / std);
}

/** Weighted 4×4×4 RGB histogram (fractions × weight) from a flat RGB byte array. */
export function histogram(raw: number[], bins = HIST_BINS, weight = HIST_WEIGHT): number[] {
  const h = new Array(bins ** 3).fill(0);
  const pixels = raw.length / 3;
  for (let i = 0; i + 2 < raw.length; i += 3) {
    const rb = Math.min(bins - 1, Math.floor((raw[i] * bins) / 256));
    const gb = Math.min(bins - 1, Math.floor((raw[i + 1] * bins) / 256));
    const bb = Math.min(bins - 1, Math.floor((raw[i + 2] * bins) / 256));
    h[rb * bins * bins + gb * bins + bb]++;
  }
  const denom = pixels || 1;
  return h.map((x) => (x / denom) * weight);
}

/**
 * Build the full descriptor from two raw RGB byte arrays produced by the glue:
 * `spatialRaw` = a 12×12 crop, `histRaw` = a 24×24 crop. Same for templates and on-screen slots.
 */
export function buildDescriptor(spatialRaw: number[], histRaw: number[]): number[] {
  return normalizeDescriptor(spatialRaw).concat(histogram(histRaw));
}

/** Squared-error distance between two equal-length descriptors. */
export function l2(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('l2: length mismatch');
  let d = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] - b[i]; d += x * x; }
  return d;
}

export type MatchOpts = { maxDistance?: number; ratio?: number };

// Cross-validated over 3 games / 30 heroes: correct matches scored 211–583 (ratios ≤0.97), wrong
// ones 483–566 — they OVERLAP, so no threshold separates them cleanly. This pair is the best
// precision/recall balance measured: shows 24 correct vs only 2 wrong, blanking the rest.
export const DEFAULT_MAX_DISTANCE = 600;
export const DEFAULT_RATIO = 0.94;

/**
 * Best template match for a full descriptor. Returns null unless the closest template is within
 * `maxDistance` and meaningfully closer than the runner-up (d1 ≤ ratio × d2) — a near-tie is
 * rejected so a blank slot beats a wrong hero.
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
  if (d2 !== Infinity && d1 > ratio * d2) return null;
  return { heroId: id1, distance: d1 };
}
