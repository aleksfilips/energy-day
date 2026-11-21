/** Этап 2: сверка с внешними эталонами (fixtures/*). Подробный отчёт — VERIFICATION.md. */
import { describe, expect, it } from 'vitest';
import * as A from '../../src/astro';
import rise from '../../fixtures/moonrise-timeanddate-ekb-2024-09.json';
import calend from '../../fixtures/lunar-days-calend-2026-11.json';
import voc from '../../fixtures/voc-cafeastrology-2026.json';

const local = (s: string, tz: string) => {
  const [d, t] = s.split(' ') as [string, string];
  const [y, m, dd] = d.split('-').map(Number) as [number, number, number];
  const [h, mi] = t.split(':').map(Number) as [number, number];
  return A.zonedTimeToUtc(y, m, dd, h, mi, tz);
};
const dmin = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 60_000;

describe('восход и заход Луны: timeanddate, Екатеринбург, сентябрь 2024 (±3 мин)', () => {
  const loc = A.requireResolved({ id: 'ekb', name: 'Екатеринбург', elevation: 0, ...rise.location });
  it.each(rise.days as [string, string | null, string | null][])('%s', (date, r, s) => {
    const { start, end } = A.dayBounds(date, loc.timeZone);
    const ev = A.moonRiseSetBetween(loc, start, end);
    const oR = ev.find((e) => e.kind === 'rise');
    const oS = ev.find((e) => e.kind === 'set');
    expect(Boolean(oR)).toBe(Boolean(r));
    expect(Boolean(oS)).toBe(Boolean(s));
    if (r && oR) expect(dmin(oR.time, local(`${date} ${r}`, loc.timeZone))).toBeLessThanOrEqual(3);
    if (s && oS) expect(dmin(oS.time, local(`${date} ${s}`, loc.timeZone))).toBeLessThanOrEqual(3);
  });
});

describe('лунные сутки: calend.ru (московское время, Москва), ноябрь 2026 (±3 мин)', () => {
  const loc = A.requireResolved({ elevation: 0, ...calend.assumedLocation, id: 'msk' });
  it.each(calend.starts)('$day-е с $at', ({ day, at }) => {
    const t = local(at, loc.timeZone);
    const found = A.lunarDaysBetween(loc, new Date(t.getTime() - 6 * 3_600_000), new Date(t.getTime() + 6 * 3_600_000)).find(
      (d) => d.number === day,
    );
    expect(found).toBeDefined();
    expect(dmin(found!.start, t)).toBeLessThanOrEqual(3);
  });
});

describe('Луна без курса и ингрессии: Cafe Astrology 2026, все 160 периодов (±5 мин)', () => {
  const periods = A.vocPeriodsBetween(new Date('2026-01-01T12:00Z'), new Date('2026-12-31T00:00Z'), 'modern');
  it.each(voc.periods as [string, string, string][])('%s → %s (%s)', (s, e, sign) => {
    const refE = local(e, voc.timeZone);
    const p = periods.find((x) => dmin(x.end, refE) < 180);
    expect(p).toBeDefined();
    expect(p!.nextSign).toBe(sign);
    expect(dmin(p!.end, refE)).toBeLessThanOrEqual(5);
    expect(dmin(p!.start, local(s, voc.timeZone))).toBeLessThanOrEqual(5);
  });
});
