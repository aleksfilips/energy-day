import { Observer } from 'astronomy-engine';

export interface Location {
  id: string;
  name: string;
  /** Широта, градусы, север положительный. null — ещё не введена. */
  latitude: number | null;
  /** Долгота, градусы, восток положительный. null — ещё не введена. */
  longitude: number | null;
  /** Высота над уровнем моря, м. По умолчанию 0 (см. DECISIONS.md). */
  elevation: number;
  /** IANA-зона, например 'Asia/Yekaterinburg'. */
  timeZone: string;
  /** Уточнение для человека: район, область, страна. */
  label?: string;
}

/** Локация с введёнными координатами: только такую можно считать. */
export interface ResolvedLocation extends Location {
  latitude: number;
  longitude: number;
}

export const DEFAULT_TIME_ZONE = 'Europe/Moscow';

/**
 * Готовых мест нет: каждый человек находит своё место поиском или по геолокации
 * при первом запуске (D-120). Личных данных владельца в коде нет.
 */
export const LOCATION_PRESETS: readonly Location[] = [];

export const DEFAULT_LOCATION_ID = '';

export function isResolved(loc: Location): loc is ResolvedLocation {
  return loc.latitude !== null && loc.longitude !== null;
}

export function toObserver(loc: ResolvedLocation): Observer {
  return new Observer(loc.latitude, loc.longitude, loc.elevation);
}

/** Ключ для кэшей: всё, от чего зависят топоцентрические расчёты. */
export function locationKey(loc: ResolvedLocation): string {
  return `${loc.latitude.toFixed(5)},${loc.longitude.toFixed(5)},${loc.elevation}`;
}

export function requireResolved(loc: Location): ResolvedLocation {
  if (!isResolved(loc)) {
    throw new Error(`Для локации «${loc.name}» не заданы координаты`);
  }
  return loc;
}
