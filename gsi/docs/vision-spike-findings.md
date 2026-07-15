# U6 — Vision Spike Findings (Phase 2 GO / NO-GO)

**Status: PENDING — requires execution on a real machine running Dota 2.**
This spike cannot run on the headless CI/VPS (no display, no game client). Run
`node scripts/vision-spike.mjs capture` during real ranked drafts, then fill in the answers
below. Phase 2 (U7 production matcher, U8 wiring of enemy picks) is gated on a **GO** here.

## Questions to answer (with evidence)

| # | Question | Expected | Finding |
|---|----------|----------|---------|
| 1 | Do enemy/ally draft-board portraits render as **standard hero icons** regardless of the enemy's cosmetic sets? | YES — cosmetics change the 3D model/loadout, not the draft icons | _pending_ |
| 2 | Which heroes show **persona** art on the enemy side (e.g., Invoker Acolyte)? | A small finite list; add each as a template → base hero id | _pending_ |
| 3 | Can **picked** vs **dimmed/available** vs **banned** slots be distinguished reliably? | Yes via slot region + state | _pending_ |
| 4 | Stable **crop rectangles** per resolution/aspect ratio (16:9, 21:9, 16:10)? | Yes, as normalized [0..1] rects | _pending_ |
| 5 | **Match accuracy** of averageHash + bestMatch vs. the hero icon set at those crops? | Target ≥ 99% correct, <1% wrong (prefer misses) | _pending_ |

## Calibration output (fill in on GO)

```ts
// Paste into desktop-gsi/src/main/vision/capture.ts PLACEHOLDER_REGIONS once measured.
export const REGIONS_16x9: SlotRegion[] = [
  // { slot: 'enemy', index: 0, rect: { x: ?, y: ?, w: ?, h: ? } },
  // ...
];
```

Persona template list (heroId → extra icon variant):
- _pending_

## Decision

- [ ] **GO** — accuracy target met; regions calibrated; proceed to U7 production matcher + U8 wiring.
- [ ] **NO-GO** — document why (UI not stable across resolutions, accuracy too low, etc.) and fall
      back to manual enemy entry (the existing web intake) until conditions change.

## Notes

- Reading the user's own screen pixels is ToS-safe and not VAC-detectable (see plan KTD1/R8) —
  this spike carries no account risk.
- Confidence gating (`bestMatch` `maxDistance`) must prefer a miss over a wrong hero; a wrong enemy
  poisons coach output.
