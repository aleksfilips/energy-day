/**
 * Геоцентрические видимые эклиптические долготы тел.
 * Система отсчёта у всех одна: истинная эклиптика и истинное равноденствие даты (ECT).
 */
import { Body, Ecliptic, EclipticGeoMoon, GeoVector, SunPosition } from 'astronomy-engine';

export type Planet =
  | 'Sun'
  | 'Mercury'
  | 'Venus'
  | 'Mars'
  | 'Jupiter'
  | 'Saturn'
  | 'Uranus'
  | 'Neptune'
  | 'Pluto';

export const CLASSICAL_PLANETS: readonly Planet[] = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
export const MODERN_PLANETS: readonly Planet[] = [...CLASSICAL_PLANETS, 'Uranus', 'Neptune', 'Pluto'];

export const PLANET_NAMES: Record<Planet, string> = {
  Sun: 'Солнце',
  Mercury: 'Меркурий',
  Venus: 'Венера',
  Mars: 'Марс',
  Jupiter: 'Юпитер',
  Saturn: 'Сатурн',
  Uranus: 'Уран',
  Neptune: 'Нептун',
  Pluto: 'Плутон',
};

/** Тропическая долгота Луны (истинное равноденствие даты), 0..360°. */
export function moonLongitude(date: Date): number {
  return EclipticGeoMoon(date).lon;
}

/** Эклиптическая широта Луны, градусы. */
export function moonLatitude(date: Date): number {
  return EclipticGeoMoon(date).lat;
}

/** Тропическая видимая долгота тела (с поправкой на время света и аберрацию). */
export function planetLongitude(planet: Planet, date: Date): number {
  if (planet === 'Sun') return SunPosition(date).elon;
  return Ecliptic(GeoVector(Body[planet], date, true)).elon;
}
