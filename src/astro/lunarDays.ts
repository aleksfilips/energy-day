/**
 * Лунные сутки — главный расчёт приложения.
 *
 * Методика (российская традиция, зафиксирована в DECISIONS.md, раздел «Лунные сутки»):
 *  - 1-е сутки начинаются в момент астрономического новолуния
 *    и длятся до первого после него восхода Луны в выбранной локации;
 *  - каждые следующие сутки длятся от восхода Луны до следующего восхода;
 *  - последние сутки цикла заканчиваются в момент следующего новолуния.
 * Количество суток в цикле = число восходов между новолуниями + 1.
 *
 * Ничего не хардкодится: новолуния и восходы считает astronomy-engine.
 */
import { locationKey, type ResolvedLocation } from './location';
import { nextNewMoon, prevNewMoon } from './phases';
import { moonrisesBetween } from './riseset';
import { dayBounds, formatTime, type DateKey } from './time';

export type BoundaryKind = 'new_moon' | 'moonrise';

export interface LunarDay {
  /** Номер суток в цикле, 1..N (обычно N = 29 или 30). */
  number: number;
  start: Date;
  end: Date;
  startKind: BoundaryKind;
  endKind: BoundaryKind;
  /** Новолуние, с которого начался цикл. */
  cycleStart: Date;
  /** Новолуние, которым цикл закончится. */
  cycleEnd: Date;
  /** Сколько всего суток в этом цикле. */
  totalInCycle: number;
}

export interface LunarCycle {
  newMoon: Date;
  nextNewMoon: Date;
  days: LunarDay[];
  /**
   * false, если в цикле не 29–30 суток. На средних широтах так не бывает;
   * за полярным кругом Луна сутками не восходит, и методика теряет смысл.
   */
  regular: boolean;
}

/**
 * Выше этой широты (по модулю) UI предупреждает, что традиционная методика
 * лунных суток ненадёжна: Луна может не восходить несколько дней подряд.
 */
export const LUNAR_DAY_LATITUDE_WARNING = 60;

export function lunarDayLatitudeWarning(loc: ResolvedLocation): boolean {
  return Math.abs(loc.latitude) > LUNAR_DAY_LATITUDE_WARNING;
}

/** Часть лунных суток, попавшая в календарный день. */
export interface LunarDaySegment {
  day: LunarDay;
  /** Начало части внутри календарного дня (≥ местной полуночи). */
  from: Date;
  /** Конец части внутри календарного дня (≤ следующей полуночи). */
  to: Date;
  /** Сутки начались в этот календарный день. */
  startsToday: boolean;
  /** Сутки закончились в этот календарный день. */
  endsToday: boolean;
}

const cycleCache = new Map<string, LunarCycle>();
const CACHE_LIMIT = 120;

/** Цикл лунных суток, начинающийся в новолуние newMoon. */
export function lunarCycle(loc: ResolvedLocation, newMoon: Date): LunarCycle {
  const key = `${locationKey(loc)}|${newMoon.getTime()}`;
  const hit = cycleCache.get(key);
  if (hit) return hit;

  const next = nextNewMoon(newMoon);
  // Восход ровно в момент новолуния не открывает 2-е сутки: берём строго после.
  const rises = moonrisesBetween(loc, new Date(newMoon.getTime() + 1000), next);

  const boundaries: { time: Date; kind: BoundaryKind }[] = [
    { time: newMoon, kind: 'new_moon' },
    ...rises.map((time) => ({ time, kind: 'moonrise' as const })),
    { time: next, kind: 'new_moon' },
  ];
  const total = boundaries.length - 1;
  const days: LunarDay[] = [];
  for (let i = 0; i < total; i++) {
    const a = boundaries[i]!;
    const b = boundaries[i + 1]!;
    days.push({
      number: i + 1,
      start: a.time,
      end: b.time,
      startKind: a.kind,
      endKind: b.kind,
      cycleStart: newMoon,
      cycleEnd: next,
      totalInCycle: total,
    });
  }
  const cycle: LunarCycle = { newMoon, nextNewMoon: next, days, regular: total === 29 || total === 30 };
  if (cycleCache.size >= CACHE_LIMIT) {
    const oldest = cycleCache.keys().next().value;
    if (oldest !== undefined) cycleCache.delete(oldest);
  }
  cycleCache.set(key, cycle);
  return cycle;
}

/** Цикл, в котором находится момент t. */
export function lunarCycleAt(loc: ResolvedLocation, t: Date): LunarCycle {
  return lunarCycle(loc, prevNewMoon(t));
}

/** Лунные сутки, действующие в момент t. Интервал суток полуоткрытый: [start, end). */
export function lunarDayAt(loc: ResolvedLocation, t: Date): LunarDay {
  const cycle = lunarCycleAt(loc, t);
  const day = cycle.days.find((d) => d.start <= t && t < d.end);
  if (!day) throw new Error(`Не найдены лунные сутки для ${t.toISOString()}`);
  return day;
}

/** Все лунные сутки, пересекающиеся с окном [start, end), по порядку. */
export function lunarDaysBetween(loc: ResolvedLocation, start: Date, end: Date): LunarDay[] {
  const out: LunarDay[] = [];
  let cycle = lunarCycleAt(loc, start);
  while (cycle.newMoon < end) {
    for (const d of cycle.days) {
      if (d.end > start && d.start < end) out.push(d);
    }
    cycle = lunarCycle(loc, cycle.nextNewMoon);
  }
  return out;
}

/**
 * Все лунные сутки, которые касаются календарной даты в часовом поясе локации,
 * с точным временем начала и конца каждой части.
 */
export function lunarDaysForDate(loc: ResolvedLocation, date: DateKey): LunarDaySegment[] {
  const { start, end } = dayBounds(date, loc.timeZone);
  return lunarDaysBetween(loc, start, end).map((day) => ({
    day,
    from: day.start > start ? day.start : start,
    to: day.end < end ? day.end : end,
    startsToday: day.start >= start,
    endsToday: day.end < end,
  }));
}

/**
 * Лунные сутки, занимающие большую часть окна [from, to) — например
 * светлого времени 07:00–23:00. Нужны синтезу «Энергии дня».
 */
export function dominantLunarDay(loc: ResolvedLocation, from: Date, to: Date): LunarDay {
  let best: LunarDay | null = null;
  let bestMs = -1;
  for (const d of lunarDaysBetween(loc, from, to)) {
    const ms = Math.min(d.end.getTime(), to.getTime()) - Math.max(d.start.getTime(), from.getTime());
    if (ms > bestMs) {
      best = d;
      bestMs = ms;
    }
  }
  if (!best) throw new Error('Пустое окно');
  return best;
}

/** «до 10:42 — 14-е, с 10:42 — 15-е» (время в зоне локации). */
export function describeLunarDays(segments: LunarDaySegment[], timeZone: string): string {
  if (segments.length === 1) return `весь день — ${segments[0]!.day.number}-е`;
  return segments
    .map((s, i) => {
      if (i === 0) return `до ${formatTime(s.to, timeZone)} — ${s.day.number}-е`;
      if (i === segments.length - 1) return `с ${formatTime(s.from, timeZone)} — ${s.day.number}-е`;
      return `${formatTime(s.from, timeZone)}–${formatTime(s.to, timeZone)} — ${s.day.number}-е`;
    })
    .join(', ');
}

/** Сброс кэша (для тестов и смены локации). */
export function clearLunarDayCache(): void {
  cycleCache.clear();
}
