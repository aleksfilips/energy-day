/**
 * Положения 13 «активаций» Дизайна человека:
 * Солнце, Земля, Луна, Северный и Южный узлы, Меркурий … Плутон.
 * Все долготы — геоцентрические, тропические, видимые (истинное равноденствие даты),
 * как в Swiss Ephemeris, которой пользуются эталонные калькуляторы.
 */
import { GeoMoonState, Rotation_EQJ_ECT, RotateState, MakeTime } from 'astronomy-engine';
import { moonLongitude, planetLongitude, type Planet } from '../astro/bodies';
import { norm360, norm180 } from '../astro/search';

export type HdBody =
  | 'sun'
  | 'earth'
  | 'moon'
  | 'northNode'
  | 'southNode'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto';

export const HD_BODIES: readonly HdBody[] = [
  'sun', 'earth', 'moon', 'northNode', 'southNode', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
];

export const HD_BODY_NAMES: Record<HdBody, string> = {
  sun: 'Солнце',
  earth: 'Земля',
  moon: 'Луна',
  northNode: 'Северный узел',
  southNode: 'Южный узел',
  mercury: 'Меркурий',
  venus: 'Венера',
  mars: 'Марс',
  jupiter: 'Юпитер',
  saturn: 'Сатурн',
  uranus: 'Уран',
  neptune: 'Нептун',
  pluto: 'Плутон',
};

const PLANET_OF: Partial<Record<HdBody, Planet>> = {
  sun: 'Sun', mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter',
  saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluto',
};

/**
 * Истинный (оскулирующий) восходящий узел Луны: линия пересечения мгновенной
 * плоскости лунной орбиты с эклиптикой даты. Так же считает Swiss Ephemeris («True Node»).
 */
export function trueNodeLongitude(date: Date): number {
  const t = MakeTime(date);
  const rot = Rotation_EQJ_ECT(t);
  const s = RotateState(rot, GeoMoonState(t));
  // Момент импульса h = r × v; узел лежит в направлении (z × h).
  const hx = s.y * s.vz - s.z * s.vy;
  const hy = s.z * s.vx - s.x * s.vz;
  return norm360((Math.atan2(hx, -hy) * 180) / Math.PI);
}

/** Средний узел по Миусу (для сравнения; в расчётах не используется). */
export function meanNodeLongitude(date: Date): number {
  const T = (date.getTime() / 86400000 + 2440587.5 - 2451545.0) / 36525;
  return norm360(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + (T * T * T) / 467441 - (T ** 4) / 60616000);
}

export function hdLongitude(body: HdBody, date: Date): number {
  switch (body) {
    case 'earth':
      return norm360(planetLongitude('Sun', date) + 180);
    case 'moon':
      return moonLongitude(date);
    case 'northNode':
      return trueNodeLongitude(date);
    case 'southNode':
      return norm360(trueNodeLongitude(date) + 180);
    default:
      return planetLongitude(PLANET_OF[body]!, date);
  }
}

export function allLongitudes(date: Date): Record<HdBody, number> {
  return Object.fromEntries(HD_BODIES.map((b) => [b, hdLongitude(b, date)])) as Record<HdBody, number>;
}

/**
 * Момент «Дизайна»: когда Солнце было ровно на 88° дуги раньше, чем в момент рождения
 * (примерно за 88–92 дня до рождения). Ищется с точностью до секунды.
 */
export function designMoment(birthUtc: Date): Date {
  const target = norm360(planetLongitude('Sun', birthUtc) - 88);
  const f = (d: Date) => norm180(planetLongitude('Sun', d) - target);
  const DAY = 86400000;
  let lo = birthUtc.getTime() - 96 * DAY; // Солнце здесь ещё не дошло до цели (f < 0)
  let hi = birthUtc.getTime() - 84 * DAY; // а здесь уже прошло её (f > 0)
  if (!(f(new Date(lo)) < 0 && f(new Date(hi)) > 0)) throw new Error('Не удалось найти момент Дизайна');
  while (hi - lo > 500) {
    const mid = (lo + hi) / 2;
    if (f(new Date(mid)) < 0) lo = mid;
    else hi = mid;
  }
  return new Date(Math.round((lo + hi) / 2));
}
