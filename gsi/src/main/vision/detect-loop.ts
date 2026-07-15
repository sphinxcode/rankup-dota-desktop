// Phase 2 detection loop (plan U8, desktop side). Polls the screen during the draft, folds
// detections into a `draft` BridgeEvent, and broadcasts it. Diffing/idempotence on the web side
// (web/src/lib/gsiBridge.ts) means re-broadcasting the same picks is a no-op in the UI.
//
// DISABLED BY DEFAULT until the U6 spike returns GO and calibrates capture.ts PLACEHOLDER_REGIONS.
// Enable by passing real regions + templates from index.ts once calibrated.
import { detectDraft } from './capture.ts';
import { normalizeDraft } from '../../core/normalize.ts';
import type { Template } from '../../core/match.ts';
import type { SlotRegion } from './capture.ts';
import type { BridgeEvent } from '../../core/bridge-types.ts';

export type DetectLoop = { stop: () => void };

/** Start polling the draft board every `intervalMs`. Returns a stopper. */
export function startDetectLoop(
  templates: Template[],
  regions: SlotRegion[],
  broadcast: (evt: BridgeEvent) => void,
  intervalMs = 1500,
): DetectLoop {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    if (stopped) return;
    try {
      const detections = await detectDraft(templates, regions);
      if (detections.length) broadcast(normalizeDraft(detections));
    } catch { /* transient capture error — try again next tick */ }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };

  tick();
  return {
    stop() { stopped = true; if (timer) clearTimeout(timer); },
  };
}
