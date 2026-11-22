/**
 * Режим Рефлектора (D-133): лунный цикл. Луна проходит все 64 ворот примерно за 27,3 дня
 * и каждый день по-новому соединяется с висящими воротами Рефлектора. Авторитет — лунный:
 * важное решение проживается полный цикл.
 */
import type { Bodygraph } from './chart';
import { dayTransits, transitActivationsAt } from './transits';
import { CENTERS, type Center } from './graph';
import { addDays, type DateKey } from '../astro/time';

export function moonGateAt(date: Date): { gate: number; line: number } {
  const m = transitActivationsAt(date).find((a) => a.body === 'moon')!;
  return { gate: m.gate, line: m.line };
}

export interface LunarDay {
  key: DateKey;
  /** Ворота Луны за сутки (по порядку). */
  moonGates: number[];
  /** Каналы, которые замыкаются через ворота человека (с любыми планетами). */
  channels: { key: string; gates: readonly [number, number]; moon: boolean }[];
  /** Центры, которые в какой-то момент суток определены. */
  centers: Center[];
}

/** Календарь на `days` суток вперёд с даты `from` в часовом поясе `tz`. */
export function lunarMonth(chart: Bodygraph, from: DateKey, tz: string, days = 28): LunarDay[] {
  const out: LunarDay[] = [];
  for (let i = 0; i < days; i++) {
    const key = addDays(from, i);
    const t = dayTransits(chart, key, tz);
    const moonGates: number[] = [];
    for (const s of t.segments) {
      const g = s.activations.find((a) => a.body === 'moon')!.gate;
      if (moonGates[moonGates.length - 1] !== g) moonGates.push(g);
    }
    out.push({
      key,
      moonGates,
      channels: t.channels.filter((c) => c.kind === 'completes').map((c) => ({ key: c.key, gates: c.gates, moon: c.bodies.includes('moon') })),
      centers: CENTERS.filter((c) => t.centers.some((x) => x.center === c)),
    });
  }
  return out;
}

/**
 * Конец лунного цикла решения: первый момент не раньше чем через 20 дней после начала,
 * когда Луна снова входит в те же ворота, где была в начале (точность — минута).
 */
export function moonReturn(start: Date): Date {
  const gate = moonGateAt(start).gate;
  const HOUR = 3_600_000;
  let t = start.getTime() + 20 * 24 * HOUR;
  // Если в момент «+20 дней» Луна уже в этих воротах (не бывает при цикле 27 дней, но на всякий случай) — ищем вход.
  while (moonGateAt(new Date(t)).gate === gate) t -= HOUR;
  while (moonGateAt(new Date(t + HOUR)).gate !== gate) t += HOUR;
  let lo = t;
  let hi = t + HOUR;
  while (hi - lo > 30_000) {
    const mid = (lo + hi) / 2;
    if (moonGateAt(new Date(mid)).gate === gate) hi = mid;
    else lo = mid;
  }
  return new Date(hi);
}
