// Builds per-hero color descriptors for enemy portrait matching (plan U7 glue). Fetches the same
// hero list + images the website uses (GET /api/heroes → { heroes: [{ id, image }] }), crops each
// CDN card to its central face region (matching the on-screen strategy-screen framing that was
// validated), and downsamples to a 10×10 RGB descriptor. Runs once at app startup; degrades to an
// empty set (no enemy detection) on any failure.
import sharp from 'sharp';
import { SPATIAL_SIDE, HIST_SIDE, buildDescriptor, type Template } from '../../core/match.ts';

type ApiHero = { id?: number; image?: string };

async function descriptorFromImage(url: string): Promise<number[] | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    const w = meta.width ?? 0, h = meta.height ?? 0;
    if (!w || !h) return null;
    // Central crop (tuned: 18%–82% width) to match the strategy-screen slot framing, then the same
    // spatial+histogram descriptor used on the on-screen crop.
    const base = sharp(buf).extract({ left: Math.round(w * 0.18), top: 0, width: Math.round(w * 0.64), height: h }).removeAlpha();
    const [spatial, hist] = await Promise.all([
      base.clone().resize(SPATIAL_SIDE, SPATIAL_SIDE, { fit: 'fill' }).raw().toBuffer(),
      base.clone().resize(HIST_SIDE, HIST_SIDE, { fit: 'fill' }).raw().toBuffer(),
    ]);
    return buildDescriptor(Array.from(spatial), Array.from(hist));
  } catch {
    return null;
  }
}

/** Fetch the hero list and build a color-descriptor template per hero. Empty on failure. */
export async function loadTemplates(siteUrl: string): Promise<Template[]> {
  try {
    const res = await fetch(`${siteUrl}/api/heroes`);
    if (!res.ok) return [];
    const heroes: ApiHero[] = (await res.json())?.heroes ?? [];
    const templates: Template[] = [];
    // Sequential to be gentle on the CDN; ~124 small images, one-time at startup.
    for (const h of heroes) {
      if (h.id == null || !h.image) continue;
      const desc = await descriptorFromImage(h.image);
      if (desc) templates.push({ heroId: h.id, desc });
    }
    return templates;
  } catch {
    return [];
  }
}
