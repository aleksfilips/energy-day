import { Body, SearchRiseSet } from 'astronomy-engine';
import { toObserver, type ResolvedLocation } from './location';
import { MS_PER_DAY } from './time';

export type RiseSetKind = 'rise' | 'set';

export interface RiseSetEvent {
  kind: RiseSetKind;
  time: Date;
}

/**
 * Восход или заход Луны.
 *
 * Методика astronomy-engine SearchRiseSet: момент касания горизонта верхним
 * краем диска, стандартная рефракция 34′, топоцентрическая позиция
 * (с учётом параллакса). Высота над уровнем моря — из локации.
 */
function searchMoon(loc: ResolvedLocation, direction: 1 | -1, start: Date, limitDays: number): Date | null {
  const t = SearchRiseSet(Body.Moon, toObserver(loc), direction, start, limitDays);
  return t ? t.date : null;
}

/** Ближайший восход Луны строго после момента. */
export function nextMoonrise(loc: ResolvedLocation, after: Date, limitDays = 40): Date | null {
  return searchMoon(loc, 1, new Date(after.getTime() + 1000), limitDays);
}

/** Все восходы Луны в окне [start, end). */
export function moonrisesBetween(loc: ResolvedLocation, start: Date, end: Date): Date[] {
  return eventsBetween(loc, 1, start, end);
}

/** Все заходы Луны в окне [start, end). */
export function moonsetsBetween(loc: ResolvedLocation, start: Date, end: Date): Date[] {
  return eventsBetween(loc, -1, start, end);
}

/** Восходы и заходы в окне [start, end), по времени. */
export function moonRiseSetBetween(loc: ResolvedLocation, start: Date, end: Date): RiseSetEvent[] {
  const rises = moonrisesBetween(loc, start, end).map((time) => ({ kind: 'rise' as const, time }));
  const sets = moonsetsBetween(loc, start, end).map((time) => ({ kind: 'set' as const, time }));
  return [...rises, ...sets].sort((a, b) => a.time.getTime() - b.time.getTime());
}

function eventsBetween(loc: ResolvedLocation, direction: 1 | -1, start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const spanDays = (end.getTime() - start.getTime()) / MS_PER_DAY;
  let cursor = start;
  for (;;) {
    const remaining = (end.getTime() - cursor.getTime()) / MS_PER_DAY;
    if (remaining <= 0) break;
    const t = searchMoon(loc, direction, cursor, Math.min(remaining, spanDays));
    if (!t || t >= end) break;
    if (t >= start) out.push(t);
    cursor = new Date(t.getTime() + 60_000);
  }
  return out;
}

export interface SunDay {
  /** Восход Солнца в этот календарный день, если есть. */
  sunrise: Date | null;
  /** Заход Солнца в этот календарный день, если есть. */
  sunset: Date | null;
  /** Длина светового дня в минутах (от восхода до захода); null, если одного из моментов нет. */
  dayLengthMin: number | null;
}

/**
 * Восход и заход Солнца за календарный день [start, end).
 * Та же методика, что для Луны: верхний край диска, рефракция 34′.
 */
export function sunDay(loc: ResolvedLocation, start: Date, end: Date): SunDay {
  const days = (end.getTime() - start.getTime()) / MS_PER_DAY;
  const rise = SearchRiseSet(Body.Sun, toObserver(loc), 1, start, days);
  const set = SearchRiseSet(Body.Sun, toObserver(loc), -1, start, days);
  const sunrise = rise && rise.date < end ? rise.date : null;
  const sunset = set && set.date < end ? set.date : null;
  const dayLengthMin = sunrise && sunset && sunset > sunrise ? Math.round((sunset.getTime() - sunrise.getTime()) / 60_000) : null;
  return { sunrise, sunset, dayLengthMin };
}
