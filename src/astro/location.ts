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
}

/** Локация с введёнными координатами: только такую можно считать. */
export interface ResolvedLocation extends Location {
  latitude: number;
  longitude: number;
}

export const DEFAULT_TIME_ZONE = 'Asia/Yekaterinburg';

/**
 * Пресеты. Координаты Доброграда пока не заполнены: Александр введёт их
 * при первом запуске (или по геолокации).
 * Екатеринбург взят из ТЗ (раздел 10), Сочи — центр города.
 */
export const LOCATION_PRESETS: readonly Location[] = [
  // Калиново, Невьянский ГО, Свердловская обл. Координаты — церковь Казанской иконы в посёлке (sobory.ru).
  { id: 'kalinovo', name: 'Калиново', latitude: 57.1401, longitude: 60.1476, elevation: 0, timeZone: 'Asia/Yekaterinburg' },
  { id: 'sochi', name: 'Сочи', latitude: 43.5855, longitude: 39.7231, elevation: 0, timeZone: 'Europe/Moscow' },
  { id: 'dobrograd', name: 'Доброград', latitude: null, longitude: null, elevation: 0, timeZone: 'Europe/Moscow' },
  { id: 'yekaterinburg', name: 'Екатеринбург', latitude: 56.84, longitude: 60.61, elevation: 0, timeZone: 'Asia/Yekaterinburg' },
];

export const DEFAULT_LOCATION_ID = 'kalinovo';

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
