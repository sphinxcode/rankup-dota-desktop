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
// Which SIDE is "yours" is not fixed — it depends on Radiant/Dire, so a player can be on the left
// OR the right. We detect all 10, then use the GSI-known self hero to decide which side is allied.
const LEFT_SLOTS = Array.from({ length: 5 }, (_, i) => ({
  side: 'left' as const, left: 196 + i * 127, top: 2, width: 110, height: 76,
}));
const RIGHT_SLOTS = Array.from({ length: 5 }, (_, i) => ({
  side: 'right' as const, left: 1100 + i * 127, top: 4, width: 116, height: 74,
}));
const ALL_SLOTS = [...LEFT_SLOTS, ...RIGHT_SLOTS];

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
 * Capture the screen once and read BOTH lineups from the strategy-screen top bar, then decide which
 * side is allied using the GSI-known `selfHeroId`: whichever side your own hero is detected on is
 * your team; the other side is the enemy. Falls back to left=ally only if your hero isn't matched.
 * `templates` are per-hero descriptors. Returns only confident matches (a blank beats a wrong hero).
 */
export async function detectDraft(templates: Template[], selfHeroId?: number | null): Promise<Detection[]> {
  if (!templates.length) return [];
  const png = await grabScreen();
  const meta = await sharp(png).metadata();
  const sx = (meta.width ?? REF_W) / REF_W;
  const sy = (meta.height ?? REF_H) / REF_H;

  const raw: Array<{ side: 'left' | 'right'; heroId: number }> = [];
  for (const s of ALL_SLOTS) {
    const rect = {
      left: Math.round(s.left * sx), top: Math.round(s.top * sy),
      width: Math.round(s.width * sx), height: Math.round(s.height * sy),
    };
    try {
      const desc = await regionDescriptor(png, rect);
      const m = bestMatch(desc, templates); // spatial+histogram descriptor + ratio test (defaults)
      if (m) raw.push({ side: s.side, heroId: m.heroId });
    } catch { /* skip this slot on any crop/decode error */ }
  }

  // Anchor the allied side on your own hero (GSI ground truth); default left if not found.
  let allySide: 'left' | 'right' = 'left';
  if (selfHeroId != null) {
    const mine = raw.find((r) => r.heroId === selfHeroId);
    if (mine) allySide = mine.side;
  }
  return raw.map((r) => ({ slot: r.side === allySide ? 'ally' : 'enemy', heroId: r.heroId }));
}
