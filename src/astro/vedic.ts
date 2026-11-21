/**
 * Ведический слой (выключен по умолчанию): титхи и накшатры.
 */
import { MoonPhase } from 'astronomy-engine';
import { findAngleCrossings } from './search';
import { moonLongitudeIn } from './zodiac';
import { MS_PER_HOUR } from './time';

export const TITHI_NAMES: readonly string[] = [
  'Пратипада',
  'Двитья',
  'Тритья',
  'Чатуртхи',
  'Панчами',
  'Шаштхи',
  'Саптами',
  'Аштами',
  'Навами',
  'Дашами',
  'Экадаши',
  'Двадаши',
  'Трайодаши',
  'Чатурдаши',
];

export type Paksha = 'shukla' | 'krishna';

export interface TithiInfo {
  /** 1..30. 1–15 — шукла (растущая), 16–30 — кришна (убывающая). */
  number: number;
  paksha: Paksha;
  /** Номер внутри пакши, 1..15. */
  inPaksha: number;
  name: string;
  /** Элонгация Луны от Солнца, 0..360. Одинакова в тропике и сидерике. */
  elongation: number;
}

export function tithiFromElongation(elongation: number): number {
  const e = ((elongation % 360) + 360) % 360;
  return Math.min(30, Math.floor(e / 12) + 1);
}

function tithiName(number: number): string {
  if (number === 15) return 'Пурнима';
  if (number === 30) return 'Амавасья';
  return TITHI_NAMES[(number - 1) % 15] as string;
}

export function tithi(date: Date): TithiInfo {
  const elongation = MoonPhase(date);
  const number = tithiFromElongation(elongation);
  return {
    number,
    paksha: number <= 15 ? 'shukla' : 'krishna',
    inPaksha: ((number - 1) % 15) + 1,
    name: tithiName(number),
    elongation,
  };
}

export interface Transition {
  time: Date;
  /** Номер, который начинается в этот момент. */
  number: number;
}

const TITHI_BOUNDS = Array.from({ length: 30 }, (_, i) => i * 12);

/** Смены титхи в окне [start, end). */
export function tithiChangesBetween(start: Date, end: Date): Transition[] {
  return findAngleCrossings((d) => MoonPhase(d), TITHI_BOUNDS, start, end, 4 * MS_PER_HOUR).map(
    ({ time, target }) => ({ time, number: Math.round(target / 12) + 1 }),
  );
}

export const NAKSHATRA_NAMES: readonly string[] = [
  'Ашвини',
  'Бхарани',
  'Криттика',
  'Рохини',
  'Мригашира',
  'Ардра',
  'Пунарвасу',
  'Пушья',
  'Ашлеша',
  'Магха',
  'Пурва-пхалгуни',
  'Уттара-пхалгуни',
  'Хаста',
  'Читра',
  'Свати',
  'Вишакха',
  'Анурадха',
  'Джйештха',
  'Мула',
  'Пурва-ашадха',
  'Уттара-ашадха',
  'Шравана',
  'Дхаништха',
  'Шатабхиша',
  'Пурва-бхадрапада',
  'Уттара-бхадрапада',
  'Ревати',
];

export const NAKSHATRA_SPAN = 360 / 27; // 13°20′

export interface NakshatraInfo {
  /** 1..27 */
  number: number;
  name: string;
  /** Пада (четверть накшатры), 1..4. */
  pada: number;
  siderealLongitude: number;
}

export function nakshatraFromLongitude(siderealLon: number): number {
  const l = ((siderealLon % 360) + 360) % 360;
  return Math.min(27, Math.floor(l / NAKSHATRA_SPAN) + 1);
}

export function nakshatra(date: Date): NakshatraInfo {
  const siderealLongitude = moonLongitudeIn('sidereal', date);
  const number = nakshatraFromLongitude(siderealLongitude);
  const within = siderealLongitude - (number - 1) * NAKSHATRA_SPAN;
  return {
    number,
    name: NAKSHATRA_NAMES[number - 1] as string,
    pada: Math.min(4, Math.floor(within / (NAKSHATRA_SPAN / 4)) + 1),
    siderealLongitude,
  };
}

const NAKSHATRA_BOUNDS = Array.from({ length: 27 }, (_, i) => i * NAKSHATRA_SPAN);

/** Смены накшатр в окне [start, end). */
export function nakshatraChangesBetween(start: Date, end: Date): Transition[] {
  return findAngleCrossings(
    (d) => moonLongitudeIn('sidereal', d),
    NAKSHATRA_BOUNDS,
    start,
    end,
    4 * MS_PER_HOUR,
  ).map(({ time, target }) => ({ time, number: (Math.round(target / NAKSHATRA_SPAN) % 27) + 1 }));
}
