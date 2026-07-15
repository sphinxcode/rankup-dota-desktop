// Screen capture + portrait hashing (plan U7 glue). Pure matching lives in ../../core/match.ts;
// this file does the IO: grab the screen, crop the calibrated draft-board slots, downscale each
// to grayscale, and hash. Requires `screenshot-desktop` (grab) + `sharp` (crop/resize/grayscale).
//
// CROP REGIONS ARE PLACEHOLDERS. They must be filled from the U6 validation spike
// (scripts/vision-spike.mjs → docs/vision-spike-findings.md) with real per-resolution
// coordinates before this is trusted. Ship behind the spike's GO decision.
import screenshot from 'screenshot-desktop';
import sharp from 'sharp';
import { averageHash, bestMatch, HASH_SIDE, type Template } from '../../core/match.ts';
import type { Detection } from '../../core/normalize.ts';

// Normalized [0..1] rectangles relative to screen width/height, per slot index. PLACEHOLDER —
// replace with U6-calibrated values (likely keyed by aspect ratio). See findings doc.
export type Rect = { x: number; y: number; w: number; h: number };
export type SlotRegion = { slot: Detection['slot']; index: number; rect: Rect };

export const PLACEHOLDER_REGIONS: SlotRegion[] = [
  // e.g. { slot: 'enemy', index: 0, rect: { x: 0.62, y: 0.08, w: 0.05, h: 0.09 } }, ...
];

/** Grab the primary screen as a PNG buffer. */
export async function grabScreen(): Promise<Buffer> {
  return screenshot({ format: 'png' });
}

/** Crop one region from a full-screen PNG and return its average-hash. */
export async function hashRegion(png: Buffer, rect: Rect, meta: { width: number; height: number }): Promise<string> {
  const left = Math.round(rect.x * meta.width);
  const top = Math.round(rect.y * meta.height);
  const width = Math.round(rect.w * meta.width);
  const height = Math.round(rect.h * meta.height);
  const gray = await sharp(png)
    .extract({ left, top, width, height })
    .greyscale()
    .resize(HASH_SIDE, HASH_SIDE, { fit: 'fill' })
    .raw()
    .toBuffer();
  return averageHash(Array.from(gray), HASH_SIDE);
}

/**
 * Capture the screen once and detect heroes in every calibrated slot.
 * `templates` are the hero/persona reference hashes (built from data/hero-summary.json icons).
 */
export async function detectDraft(
  templates: Template[],
  regions: SlotRegion[] = PLACEHOLDER_REGIONS,
  maxDistance = 10,
): Promise<Detection[]> {
  if (!regions.length) return [];
  const png = await grabScreen();
  const meta = await sharp(png).metadata();
  const dims = { width: meta.width ?? 0, height: meta.height ?? 0 };
  const out: Detection[] = [];
  for (const r of regions) {
    const hash = await hashRegion(png, r.rect, dims);
    const match = bestMatch(hash, templates, maxDistance);
    if (match) out.push({ slot: r.slot, heroId: match.heroId });
  }
  return out;
}
