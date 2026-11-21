/// <reference lib="webworker" />
import type { ResolvedLocation } from '../astro/location';
import type { VocMode } from '../astro/voc';
import type { ZodiacMode } from '../astro/zodiac';
import { BASE, makeContent } from '../content';
import { computeMonth, computeUpcoming } from '../synthesis/day';

export type WorkerRequest =
  | { id: number; type: 'month'; loc: ResolvedLocation; year: number; month: number; daylight: { from: number; to: number }; zodiac: ZodiacMode; vocMode: VocMode }
  | { id: number; type: 'upcoming'; from: number; days: number; vocMode: VocMode };

const content = makeContent(BASE);

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const r = ev.data;
  try {
    let result: unknown;
    if (r.type === 'month') {
      result = computeMonth(r.loc, r.year, r.month, r, (n) => {
        const e = content.lunarDay(n);
        return { tone: e.energy.tone, attention: e.attention };
      });
    } else {
      result = computeUpcoming(new Date(r.from), r.days, r.vocMode);
    }
    (self as unknown as Worker).postMessage({ id: r.id, ok: true, result });
  } catch (e) {
    (self as unknown as Worker).postMessage({ id: r.id, ok: false, error: String(e) });
  }
};
