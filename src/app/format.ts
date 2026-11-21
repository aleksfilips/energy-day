import { formatTime, wallClock, type DateKey } from '../astro/time';

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function parseKey(k: DateKey): { y: number; m: number; d: number } {
  const [y, m, d] = k.split('-').map(Number) as [number, number, number];
  return { y, m, d };
}

/** «19 ноября, четверг» */
export function humanDate(k: DateKey, withWeekday = true): string {
  const { y, m, d } = parseKey(k);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${d} ${MONTHS_GEN[m - 1]}${withWeekday ? `, ${WEEKDAYS[wd]}` : ''}`;
}

/** «19 ноября, 14:38» в зоне. */
export function humanDateTime(date: Date, tz: string): string {
  const w = wallClock(date, tz);
  return `${w.day} ${MONTHS_GEN[w.month - 1]}, ${formatTime(date, tz)}`;
}

/** «через 2 ч 15 мин» */
export function humanIn(ms: number): string {
  if (ms <= 0) return 'сейчас';
  const min = Math.round(ms / 60_000);
  if (min < 60) return `через ${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 48) return `через ${h} ч${m ? ` ${m} мин` : ''}`;
  return `через ${Math.round(h / 24)} дн`;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
