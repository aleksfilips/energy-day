/**
 * Луна в знаке и ингрессии.
 * Тропический зодиак по умолчанию: знак = floor(λ / 30°), λ — долгота
 * относительно истинного равноденствия даты. Сидерический режим — айанамша Лахири.
 */
import { moonLongitude } from './bodies';
import { findAngleCrossings, norm360 } from './search';
import { MS_PER_DAY, MS_PER_HOUR } from './time';

export type ZodiacMode = 'tropical' | 'sidereal';

export const SIGNS = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
] as const;
export type Sign = (typeof SIGNS)[number];

export const SIGN_NAMES: Record<Sign, string> = {
  aries: 'Овен',
  taurus: 'Телец',
  gemini: 'Близнецы',
  cancer: 'Рак',
  leo: 'Лев',
  virgo: 'Дева',
  libra: 'Весы',
  scorpio: 'Скорпион',
  sagittarius: 'Стрелец',
  capricorn: 'Козерог',
  aquarius: 'Водолей',
  pisces: 'Рыбы',
};

/** «Луна в Тельце» и т. п. — предложный падеж. */
export const SIGN_NAMES_PREP: Record<Sign, string> = {
  aries: 'Овне',
  taurus: 'Тельце',
  gemini: 'Близнецах',
  cancer: 'Раке',
  leo: 'Льве',
  virgo: 'Деве',
  libra: 'Весах',
  scorpio: 'Скорпионе',
  sagittarius: 'Стрельце',
  capricorn: 'Козероге',
  aquarius: 'Водолее',
  pisces: 'Рыбах',
};

/** «в Тельце», «во Льве». */
export function inSign(sign: Sign): string {
  return `${sign === 'leo' ? 'во' : 'в'} ${SIGN_NAMES_PREP[sign]}`;
}

export type Element = 'fire' | 'earth' | 'air' | 'water';
export const SIGN_ELEMENT: Record<Sign, Element> = {
  aries: 'fire',
  leo: 'fire',
  sagittarius: 'fire',
  taurus: 'earth',
  virgo: 'earth',
  capricorn: 'earth',
  gemini: 'air',
  libra: 'air',
  aquarius: 'air',
  cancer: 'water',
  scorpio: 'water',
  pisces: 'water',
};

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

/**
 * Айанамша Лахири (средняя), градусы.
 * Значение на J2000 принято 23.857092° (≈23°51′25″, ориентир — Swiss Ephemeris SIDM_LAHIRI;
 * сверяется на этапе 2), далее — общая прецессия по долготе IAU 2006:
 * 5028.796195″·T + 1.1054348″·T². Нутация (до 17″) не учитывается. См. DECISIONS.md.
 */
export function lahiriAyanamsa(date: Date): number {
  const T = (date.getTime() - J2000_MS) / (36525 * MS_PER_DAY);
  return 23.857092 + (5028.796195 * T + 1.1054348 * T * T) / 3600;
}

export function moonLongitudeIn(mode: ZodiacMode, date: Date): number {
  const tropical = moonLongitude(date);
  return mode === 'tropical' ? tropical : norm360(tropical - lahiriAyanamsa(date));
}

export function signFromLongitude(lon: number): Sign {
  return SIGNS[Math.floor(norm360(lon) / 30) % 12] as Sign;
}

export interface MoonSignInfo {
  sign: Sign;
  /** Долгота в выбранной системе, 0..360. */
  longitude: number;
  /** Градус внутри знака, 0..30. */
  degreeInSign: number;
}

export function moonSign(date: Date, mode: ZodiacMode = 'tropical'): MoonSignInfo {
  const longitude = moonLongitudeIn(mode, date);
  return { sign: signFromLongitude(longitude), longitude, degreeInSign: longitude % 30 };
}

export interface Ingress {
  time: Date;
  /** Знак, в который входит Луна. */
  sign: Sign;
  /** Знак, из которого выходит. */
  from: Sign;
}

const SIGN_CUSPS = Array.from({ length: 12 }, (_, i) => i * 30);

/** Все ингрессии Луны в окне [start, end), точность поиска ~1 с. */
export function ingressesBetween(start: Date, end: Date, mode: ZodiacMode = 'tropical'): Ingress[] {
  return findAngleCrossings((d) => moonLongitudeIn(mode, d), SIGN_CUSPS, start, end, 6 * MS_PER_HOUR).map(
    ({ time, target }) => {
      const sign = SIGNS[Math.round(target / 30) % 12] as Sign;
      const from = SIGNS[(Math.round(target / 30) + 11) % 12] as Sign;
      return { time, sign, from };
    },
  );
}

/** Ближайшая ингрессия строго после момента. Луна проходит знак максимум за ~2,7 суток. */
export function nextIngress(after: Date, mode: ZodiacMode = 'tropical'): Ingress {
  const start = new Date(after.getTime() + 1000);
  const found = ingressesBetween(start, new Date(start.getTime() + 3.5 * MS_PER_DAY), mode)[0];
  if (!found) throw new Error('Ингрессия не найдена');
  return found;
}

/** Последняя ингрессия в момент или до момента. */
export function prevIngress(atOrBefore: Date, mode: ZodiacMode = 'tropical'): Ingress {
  const end = new Date(atOrBefore.getTime() + 1000);
  const list = ingressesBetween(new Date(end.getTime() - 3.5 * MS_PER_DAY), end, mode);
  const found = list[list.length - 1];
  if (!found) throw new Error('Ингрессия не найдена');
  return found;
}
