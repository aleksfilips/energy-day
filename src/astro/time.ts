/**
 * Время и часовые пояса.
 *
 * Правило проекта: все внутренние вычисления идут в UTC (объекты Date),
 * а часовой пояс локации нужен только для двух вещей:
 *   1) найти границы календарного дня (местная полночь → UTC);
 *   2) показать время человеку.
 * Для этого используем Intl (IANA-зоны), без сторонних библиотек.
 */

export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

/** Календарная дата в виде 'YYYY-MM-DD'. */
export type DateKey = string;

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

export interface WallClock {
  year: number;
  month: number; // 1..12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Местные «настенные» часы в зоне для момента UTC. */
export function wallClock(date: Date, timeZone: string): WallClock {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const get = (type: string): number => {
    const p = parts.find((x) => x.type === type);
    if (!p) throw new Error(`Intl: нет поля ${type}`);
    return Number(p.value);
  };
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** Смещение зоны относительно UTC в минутах для данного момента (Екатеринбург: +300). */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const w = wallClock(date, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  const truncated = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((asUtc - truncated) / MS_PER_MINUTE);
}

function parseDateKey(key: DateKey): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) throw new Error(`Ожидалась дата YYYY-MM-DD, получено: ${key}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Момент UTC, соответствующий местному времени (с учётом перехода на летнее время). */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  // Две итерации достаточно для любых реальных зон (в т.ч. с DST).
  let guess = naive - tzOffsetMinutes(new Date(naive), timeZone) * MS_PER_MINUTE;
  guess = naive - tzOffsetMinutes(new Date(guess), timeZone) * MS_PER_MINUTE;
  return new Date(guess);
}

export interface DayBounds {
  /** Местная полночь начала дня, UTC. */
  start: Date;
  /** Местная полночь следующего дня, UTC (не включительно). */
  end: Date;
}

/** Границы календарного дня [start, end) в UTC для зоны. */
export function dayBounds(key: DateKey, timeZone: string): DayBounds {
  const [y, m, d] = parseDateKey(key);
  const start = zonedTimeToUtc(y, m, d, 0, 0, timeZone);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const end = zonedTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, timeZone);
  return { start, end };
}

/** Местная дата 'YYYY-MM-DD' для момента UTC. */
export function toDateKey(date: Date, timeZone: string): DateKey {
  const w = wallClock(date, timeZone);
  return `${w.year}-${pad2(w.month)}-${pad2(w.day)}`;
}

/** Следующая календарная дата. */
export function addDays(key: DateKey, n: number): DateKey {
  const [y, m, d] = parseDateKey(key);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

/** Все даты месяца. month: 1..12. */
export function monthDateKeys(year: number, month: number): DateKey[] {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => `${year}-${pad2(month)}-${pad2(i + 1)}`);
}

/**
 * Время 'HH:MM' в зоне, округлённое до ближайшей минуты.
 * Округляем, а не отбрасываем секунды: так принято в астрономических таблицах.
 */
export function formatTime(date: Date, timeZone: string): string {
  const rounded = roundToMinute(date);
  const w = wallClock(rounded, timeZone);
  return `${pad2(w.hour)}:${pad2(w.minute)}`;
}

/** 'YYYY-MM-DD HH:MM' в зоне (для отчётов и тестов). */
export function formatDateTime(date: Date, timeZone: string): string {
  const rounded = roundToMinute(date);
  return `${toDateKey(rounded, timeZone)} ${formatTime(rounded, timeZone)}`;
}

export function roundToMinute(date: Date): Date {
  return new Date(Math.round(date.getTime() / MS_PER_MINUTE) * MS_PER_MINUTE);
}

export function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

export function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / MS_PER_MINUTE;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
