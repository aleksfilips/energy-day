import { EKB } from '../tests/astro/helpers';
/**
 * Сверка с эталонами (этап 2). Запуск: npx tsx scripts/verify.ts
 * Печатает сводку и пишет fixtures/verification-results.json — из него собран VERIFICATION.md.
 */
import { writeFileSync } from 'node:fs';
import * as A from '../src/astro';
import phases from '../fixtures/phases-reference.json';
import eclipses from '../fixtures/eclipses-reference.json';
import rise from '../fixtures/moonrise-timeanddate-ekb-2024-09.json';
import calend from '../fixtures/lunar-days-calend-2026-11.json';
import voc from '../fixtures/voc-cafeastrology-2026.json';

const local = (s: string, tz: string) => {
  const [d, t] = s.split(' ') as [string, string];
  const [y, m, dd] = d.split('-').map(Number) as [number, number, number];
  const [h, mi] = t.split(':').map(Number) as [number, number];
  return A.zonedTimeToUtc(y, m, dd, h, mi, tz);
};
const diffMin = (a: Date, b: Date) => (a.getTime() - b.getTime()) / 60_000;
const stats = (xs: number[]) => {
  const abs = xs.map(Math.abs);
  return {
    n: xs.length,
    maxAbs: +Math.max(...abs).toFixed(2),
    meanAbs: +(abs.reduce((s, x) => s + x, 0) / abs.length).toFixed(2),
    mean: +(xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(2),
  };
};
const results: Record<string, unknown> = {};

// 1. Фазы
{
  const q = A.quartersBetween(new Date('2025-01-01Z'), new Date('2027-01-01Z'));
  const near = (k: number, t: Date) =>
    q.filter((x) => x.quarter === k).reduce((b, x) => (Math.abs(diffMin(x.time, t)) < Math.abs(diffMin(b, t)) ? x.time : b), new Date(0));
  const d = [
    ...phases.newMoons.map((s) => diffMin(near(0, new Date(s)), new Date(s))),
    ...phases.fullMoons.map((s) => diffMin(near(2, new Date(s)), new Date(s))),
  ];
  results.phases = stats(d);
}

// 2. Восходы/заходы, timeanddate, Екатеринбург, сентябрь 2024
{
  const loc = A.requireResolved({ id: 'ekb', name: 'Екатеринбург', elevation: 0, ...rise.location });
  const dr: number[] = [];
  const ds: number[] = [];
  const rows: string[] = [];
  for (const [date, r, s] of rise.days as [string, string | null, string | null][]) {
    const { start, end } = A.dayBounds(date, loc.timeZone);
    const ours = A.moonRiseSetBetween(loc, start, end);
    const oR = ours.find((e) => e.kind === 'rise');
    const oS = ours.find((e) => e.kind === 'set');
    if (r && oR) dr.push(diffMin(oR.time, local(`${date} ${r}`, loc.timeZone)));
    if (s && oS) ds.push(diffMin(oS.time, local(`${date} ${s}`, loc.timeZone)));
    if (!r !== !oR || !s !== !oS) rows.push(`${date}: наличие событий различается`);
  }
  results.moonrise = { rise: stats(dr), set: stats(ds), mismatches: rows };
}

// 3. Лунные сутки, calend.ru (Москва)
{
  const loc = A.requireResolved({ elevation: 0, ...calend.assumedLocation, id: 'msk' });
  const rows = calend.starts.map((s) => {
    const t = local(s.at, loc.timeZone);
    const ours = A.lunarDayAt(loc, new Date(t.getTime() + 30 * 60_000));
    const oursStart = A.lunarDaysBetween(loc, new Date(t.getTime() - 6 * 3_600_000), new Date(t.getTime() + 6 * 3_600_000)).find(
      (d) => d.number === s.day,
    );
    return {
      day: s.day,
      calend: s.at,
      ours: oursStart ? A.formatDateTime(oursStart.start, loc.timeZone) : null,
      diffMin: oursStart ? +diffMin(oursStart.start, t).toFixed(1) : null,
      numberAt30min: ours.number,
    };
  });
  // То же для Екатеринбурга — чтобы показать, насколько важна локация.
  const ekb = EKB;
  const ekbRows = calend.starts.map((s) => {
    const t = local(s.at, 'Europe/Moscow');
    const d = A.lunarDaysBetween(ekb, new Date(t.getTime() - 12 * 3_600_000), new Date(t.getTime() + 12 * 3_600_000)).find(
      (x) => x.number === s.day,
    );
    return { day: s.day, ekbStartMsk: d ? A.formatDateTime(d.start, 'Europe/Moscow') : null, diffMin: d ? +diffMin(d.start, t).toFixed(1) : null };
  });
  results.lunarDays = { moscow: rows, yekaterinburg: ekbRows };
}

// 4. VOC и ингрессии, Cafe Astrology 2026
{
  const tz = voc.timeZone;
  const periods = A.vocPeriodsBetween(new Date('2026-01-01T12:00Z'), new Date('2026-12-31T00:00Z'), 'modern');
  const dStart: number[] = [];
  const dEnd: number[] = [];
  const outliers: string[] = [];
  for (const [s, e, sign] of voc.periods as [string, string, string][]) {
    const refS = local(s, tz);
    const refE = local(e, tz);
    const p = periods.find((x) => Math.abs(diffMin(x.end, refE)) < 180);
    if (!p) {
      outliers.push(`${e} → ${sign}: у нас нет такого периода`);
      continue;
    }
    if (p.nextSign !== sign) outliers.push(`${e}: знак ${p.nextSign} вместо ${sign}`);
    const de = diffMin(p.end, refE);
    const ds = diffMin(p.start, refS);
    dEnd.push(de);
    dStart.push(ds);
    if (Math.abs(ds) > voc.toleranceMinutes || Math.abs(de) > voc.toleranceMinutes) {
      const asp = p.lastAspect ? `${A.ASPECT_NAMES[p.lastAspect.kind]} ${A.PLANET_NAMES[p.lastAspect.planet]}` : '—';
      outliers.push(
        `${s} → ${e} (${sign}): у нас ${A.formatDateTime(p.start, tz)} → ${A.formatDateTime(p.end, tz)}, Δначала ${ds.toFixed(1)} мин, Δконца ${de.toFixed(1)} мин, последний аспект у нас: ${asp}`,
      );
    }
  }
  const within = dStart.filter((x, i) => Math.abs(x) <= voc.toleranceMinutes && Math.abs(dEnd[i]!) <= voc.toleranceMinutes).length;
  results.voc = { ingress: stats(dEnd), start: stats(dStart), withinTolerance: within, total: voc.periods.length, outliers };
}

// 5. Затмения
{
  const list = A.eclipsesBetween(new Date('2025-01-01Z'), new Date('2027-01-01Z'));
  const d = eclipses.eclipses.map((e) => {
    const f = list.find((x) => x.body === e.body && Math.abs(diffMin(x.peak, new Date(e.peak))) < 1440)!;
    return { ...e, ours: f.peak.toISOString().slice(0, 16), typeOk: f.type === e.type, diffMin: +diffMin(f.peak, new Date(e.peak)).toFixed(1) };
  });
  results.eclipses = d;
}

writeFileSync('fixtures/verification-results.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
