import {
  Body,
  Illumination,
  MoonPhase,
  NextMoonQuarter,
  SearchMoonPhase,
  SearchMoonQuarter,
} from 'astronomy-engine';
import { MS_PER_DAY } from './time';

/** 0 — новолуние, 1 — первая четверть, 2 — полнолуние, 3 — последняя четверть. */
export type QuarterIndex = 0 | 1 | 2 | 3;

export const QUARTER_NAMES: Record<QuarterIndex, string> = {
  0: 'Новолуние',
  1: 'Первая четверть',
  2: 'Полнолуние',
  3: 'Последняя четверть',
};

export interface QuarterEvent {
  quarter: QuarterIndex;
  time: Date;
}

/**
 * 8 фаз для интерпретации. Границы — секторы по 45° угла фазы,
 * начиная от точной фазы (схема лунного цикла Д. Радьяра, принятая
 * в западной астрологии). См. DECISIONS.md.
 */
export type PhaseKey =
  | 'new'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full'
  | 'waning_gibbous'
  | 'last_quarter'
  | 'balsamic';

export const PHASE_ORDER: readonly PhaseKey[] = [
  'new',
  'waxing_crescent',
  'first_quarter',
  'waxing_gibbous',
  'full',
  'waning_gibbous',
  'last_quarter',
  'balsamic',
];

export const PHASE_NAMES: Record<PhaseKey, string> = {
  new: 'Новолуние',
  waxing_crescent: 'Молодая Луна',
  first_quarter: 'Первая четверть',
  waxing_gibbous: 'Растущая выпуклая',
  full: 'Полнолуние',
  waning_gibbous: 'Убывающая выпуклая',
  last_quarter: 'Последняя четверть',
  balsamic: 'Старая (бальзамическая) Луна',
};

export interface PhaseInfo {
  /** Угол фазы: разность эклиптических долгот Луны и Солнца, 0..360°. */
  angle: number;
  /** Освещённая доля диска, 0..100 %. */
  illuminationPct: number;
  waxing: boolean;
  phase: PhaseKey;
}

export function phaseAngle(date: Date): number {
  return MoonPhase(date);
}

export function phaseKeyFromAngle(angle: number): PhaseKey {
  const idx = Math.floor((((angle % 360) + 360) % 360) / 45);
  return PHASE_ORDER[idx] as PhaseKey;
}

export function phaseInfo(date: Date): PhaseInfo {
  const angle = phaseAngle(date);
  const ill = Illumination(Body.Moon, date);
  return {
    angle,
    illuminationPct: ill.phase_fraction * 100,
    waxing: angle < 180,
    phase: phaseKeyFromAngle(angle),
  };
}

/** Ближайшее новолуние строго после момента. */
export function nextNewMoon(after: Date): Date {
  // +1 секунда, чтобы не найти то же самое новолуние повторно.
  const t = SearchMoonPhase(0, new Date(after.getTime() + 1000), 40);
  if (!t) throw new Error('Новолуние не найдено за 40 дней');
  return t.date;
}

/** Последнее новолуние в момент или до момента. */
export function prevNewMoon(atOrBefore: Date): Date {
  const t = SearchMoonPhase(0, new Date(atOrBefore.getTime() + 1000), -40);
  if (!t) throw new Error('Новолуние не найдено за 40 дней назад');
  return t.date;
}

/** Все новолуния в окне [start, end). */
export function newMoonsBetween(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  let t = SearchMoonPhase(0, start, 40);
  while (t && t.date < end) {
    out.push(t.date);
    t = SearchMoonPhase(0, new Date(t.date.getTime() + MS_PER_DAY), 40);
  }
  return out;
}

/** Все четверти (новолуние, I четверть, полнолуние, III четверть) в окне [start, end). */
export function quartersBetween(start: Date, end: Date): QuarterEvent[] {
  const out: QuarterEvent[] = [];
  let mq = SearchMoonQuarter(start);
  while (mq.time.date < end) {
    out.push({ quarter: mq.quarter as QuarterIndex, time: mq.time.date });
    mq = NextMoonQuarter(mq);
  }
  return out;
}

/** Ближайшее событие заданной четверти после момента. */
export function nextQuarter(quarter: QuarterIndex, after: Date): Date {
  const t = SearchMoonPhase(quarter * 90, new Date(after.getTime() + 1000), 40);
  if (!t) throw new Error('Фаза не найдена');
  return t.date;
}
