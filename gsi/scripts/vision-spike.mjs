#!/usr/bin/env node
// U6 VALIDATION SPIKE HARNESS — run this ON A REAL MACHINE with Dota 2.
//
// Purpose: empirically answer the questions that gate Phase 2 (screen portrait-matching) before
// any production build, and produce the calibration the matcher needs. It CANNOT run on the
// headless CI/VPS (no display, no Dota). Deliverable: fill docs/vision-spike-findings.md with a
// GO / NO-GO and the crop regions.
//
// Usage (on your gaming PC, in a real ranked draft):
//   node scripts/vision-spike.mjs capture   # saves a timestamped full-screen PNG to ./spike-out
//   node scripts/vision-spike.mjs hash <png> <x> <y> <w> <h>   # hash a normalized crop rect
//
// What to verify with the captures (record answers in the findings doc):
//   1. Do enemy/ally draft-board portraits render as STANDARD hero icons regardless of the
//      enemy's cosmetic sets? (Expected YES — cosmetics change the 3D model, not draft icons.)
//   2. Which heroes show PERSONA art on the enemy side? (Add each as a template → base hero id.)
//   3. Picked vs. dimmed/available vs. banned slot appearance — can they be distinguished?
//   4. Stable crop rectangles per resolution / aspect ratio (16:9, 21:9, 16:10).
//   5. Match accuracy of averageHash+bestMatch against the hero icon set at those crops.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'capture') {
    const { default: screenshot } = await import('screenshot-desktop');
    mkdirSync('spike-out', { recursive: true });
    const png = await screenshot({ format: 'png' });
    const file = path.join('spike-out', `draft-${Date.now()}.png`);
    writeFileSync(file, png);
    console.log('saved', file, `(${png.length} bytes)`);
    console.log('Open it and eyeball the draft board. Note enemy portrait positions + cosmetics.');
    return;
  }
  if (cmd === 'hash') {
    const [png, x, y, w, h] = args;
    if (!png) { console.error('usage: hash <png> <x> <y> <w> <h>  (x/y/w/h are 0..1 of screen)'); process.exit(1); }
    const sharp = (await import('sharp')).default;
    const { averageHash, HASH_SIDE } = await import('../src/core/match.ts');
    const meta = await sharp(png).metadata();
    const W = meta.width, H = meta.height;
    const gray = await sharp(png)
      .extract({ left: Math.round(+x * W), top: Math.round(+y * H), width: Math.round(+w * W), height: Math.round(+h * H) })
      .greyscale().resize(HASH_SIDE, HASH_SIDE, { fit: 'fill' }).raw().toBuffer();
    console.log('hash:', averageHash(Array.from(gray), HASH_SIDE));
    return;
  }
  console.log('commands: capture | hash <png> <x> <y> <w> <h>');
}

main().catch((e) => { console.error(e); process.exit(1); });
