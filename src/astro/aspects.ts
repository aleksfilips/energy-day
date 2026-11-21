/**
 * Точные мажорные аспекты Луны к планетам (орб 0), найденные численно.
 */
import { moonLongitude, planetLongitude, type Planet } from './bodies';
import { findAngleCrossings, norm360 } from './search';
import { MS_PER_HOUR } from './time';

export type AspectKind = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

export const ASPECT_NAMES: Record<AspectKind, string> = {
  conjunction: 'соединение',
  sextile: 'секстиль',
  square: 'квадрат',
  trine: 'трин',
  opposition: 'оппозиция',
};

export const ASPECT_ANGLES: Record<AspectKind, number> = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  opposition: 180,
};

/** Цели для разности долгот «Луна − планета» в [0, 360). */
const TARGETS: readonly { angle: number; kind: AspectKind }[] = [
  { angle: 0, kind: 'conjunction' },
  { angle: 60, kind: 'sextile' },
  { angle: 90, kind: 'square' },
  { angle: 120, kind: 'trine' },
  { angle: 180, kind: 'opposition' },
  { angle: 240, kind: 'trine' },
  { angle: 270, kind: 'square' },
  { angle: 300, kind: 'sextile' },
];

export interface AspectEvent {
  time: Date;
  planet: Planet;
  kind: AspectKind;
}

/** Разность долгот Луна − планета, 0..360. Растёт монотонно: Луна быстрее любой планеты. */
export function moonPlanetElongation(planet: Planet, date: Date): number {
  return norm360(moonLongitude(date) - planetLongitude(planet, date));
}

/** Все точные аспекты Луны к перечисленным планетам в окне [start, end). */
export function moonAspectsBetween(planets: readonly Planet[], start: Date, end: Date): AspectEvent[] {
  const out: AspectEvent[] = [];
  const angles = TARGETS.map((t) => t.angle);
  for (const planet of planets) {
    const hits = findAngleCrossings((d) => moonPlanetElongation(planet, d), angles, start, end, 3 * MS_PER_HOUR);
    for (const h of hits) {
      const kind = TARGETS.find((t) => t.angle === h.target)!.kind;
      out.push({ time: h.time, planet, kind });
    }
  }
  return out.sort((a, b) => a.time.getTime() - b.time.getTime());
}
