// Screen capture + enemy portrait reading (plan U7 glue). Pure matching lives in
// ../../core/match.ts; this file does the IO: grab the screen, crop the 5 enemy portrait slots on
// the strategy screen, downsample each to a 10×10 RGB descriptor, and match. Requires
// `screenshot-desktop` (grab) + `sharp` (crop/resize). Everything is guarded so a capture/native
// failure never crashes the app — it just yields no detections.
import screenshot from 'screenshot-desktop';
import sharp from 'sharp';
import { bestMatch, buildDescriptor, SPATIAL_SIDE, HIST_SIDE, type Template } from '../../core/match.ts';
import type { Detection } from '../../core/normalize.ts';

// Portrait slots on the strategy-screen top bar, in 1920×1080 pixels — tuned against a real
// capture to 10/10 (both teams). Your team is the left 5, enemies the right 5; both use a 127px
// pitch. The strategy screen is identical across All Pick / Turbo / etc., so one calibration
// covers all modes. Scaled proportionally for other 16:9 resolutions at runtime.
const REF_W = 1920, REF_H = 1080;
const ALLY_SLOTS_1080 = Array.from({ length: 5 }, (_, i) => ({
  slot: 'ally' as const, left: 196 + i * 127, top: 2, width: 110, height: 76,
}));
const ENEMY_SLOTS_1080 = Array.from({ length: 5 }, (_, i) => ({
  slot: 'enemy' as const, left: 1100 + i * 127, top: 4, width: 116, height: 74,
}));
const ALL_SLOTS = [...ALLY_SLOTS_1080, ...ENEMY_SLOTS_1080];

/** Grab the primary screen as a PNG buffer. */
export async function grabScreen(): Promise<Buffer> {
  return screenshot({ format: 'png' });
}

/** Crop a region and return its full descriptor (normalized 12×12 spatial + 4³ color histogram). */
export async function regionDescriptor(png: Buffer, rect: { left: number; top: number; width: number; height: number }): Promise<number[]> {
  const base = sharp(png).extract(rect).removeAlpha();
  const [spatial, hist] = await Promise.all([
    base.clone().resize(SPATIAL_SIDE, SPATIAL_SIDE, { fit: 'fill' }).raw().toBuffer(),
    base.clone().resize(HIST_SIDE, HIST_SIDE, { fit: 'fill' }).raw().toBuffer(),
  ]);
  return buildDescriptor(Array.from(spatial), Array.from(hist));
}

/**
 * Capture the screen once and read BOTH lineups (allies + enemies) from the strategy-screen top
 * bar. `templates` are per-hero descriptors (built from data/hero-summary.json images). Returns
 * only confident matches (others are dropped — a blank slot beats a wrong hero).
 */
export async function detectDraft(templates: Template[]): Promise<Detection[]> {
  if (!templates.length) return [];
  const png = await grabScreen();
  const meta = await sharp(png).metadata();
  const sx = (meta.width ?? REF_W) / REF_W;
  const sy = (meta.height ?? REF_H) / REF_H;
  const out: Detection[] = [];
  for (const s of ALL_SLOTS) {
    const rect = {
      left: Math.round(s.left * sx), top: Math.round(s.top * sy),
      width: Math.round(s.width * sx), height: Math.round(s.height * sy),
    };
    try {
      const desc = await regionDescriptor(png, rect);
      const m = bestMatch(desc, templates); // spatial+histogram descriptor + ratio test (defaults)
      if (m) out.push({ slot: s.slot, heroId: m.heroId });
    } catch { /* skip this slot on any crop/decode error */ }
  }
  return out;
}
