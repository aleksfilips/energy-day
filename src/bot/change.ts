/**
 * Уведомление о смене лунного дня (D-145). Бот запускается каждую минуту; когда начинается новый лунный день,
 * присылает короткое сообщение: на что сменилась энергия и главное о новом дне.
 * Чтобы не дублировать утро и не будить ночью, сообщаем только о смене:
 *  — в спокойное время по местному времени (с 07:00 до 22:00);
 *  — на лунный день, который НЕ описан в утреннем сообщении этих суток (утро описывает день,
 *    идущий большую часть 07:00–23:00, как и morningText).
 */
import * as A from '../astro';
import { makeContent, type Content } from '../content';
import { plainText } from '../synthesis/explain';
import { esc } from './message';
import { localTime, type Subscriber } from './state';

/** Сколько минут после смены ещё можно догнать, если запуск задержался. */
export const CHANGE_CATCH_UP_MIN = 90;
export const QUIET_FROM = 22 * 60;
export const QUIET_TO = 7 * 60;

let contentCache: Content | null = null;

const locOf = (s: Subscriber): A.ResolvedLocation => ({ id: 'bot', name: '', latitude: s.sub.latitude, longitude: s.sub.longitude, elevation: 0, timeZone: s.sub.timeZone });

/** О каком лунном дне пора сообщить (или null). */
export function changeDue(s: Subscriber, now: Date): A.LunarDay | null {
  if (s.sub.changes === false) return null;
  const loc = locOf(s);
  const cur = A.lunarDayAt(loc, now);
  const key = cur.start.toISOString();
  if (s.lastChange === key) return null;
  const ago = now.getTime() - cur.start.getTime();
  if (ago < 0 || ago > CHANGE_CATCH_UP_MIN * 60000) return null;
  const { date, minutes } = localTime(s.sub, cur.start);
  if (minutes < QUIET_TO || minutes >= QUIET_FROM) return null;
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const tz = s.sub.timeZone;
  const dominant = A.dominantLunarDay(loc, A.zonedTimeToUtc(y, m, d, 7, 0, tz), A.zonedTimeToUtc(y, m, d, 23, 0, tz));
  if (dominant.start.getTime() === cur.start.getTime()) return null;
  return cur;
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/** Текст уведомления: что началось, главное о дне, до какого времени. */
export function changeText(day: A.LunarDay, timeZone: string): string {
  const content = (contentCache ??= makeContent());
  const ld = content.lunarDay(day.number);
  const t = (x: Date) => A.formatTime(x, timeZone);
  const tomorrow = A.toDateKey(day.end, timeZone) !== A.toDateKey(day.start, timeZone);
  const lines = [
    `🌙 <b>Энергия сменилась</b>`,
    `С ${t(day.start)} идёт <b>${day.number}-й лунный день</b> — до ${t(day.end)}${tomorrow ? ' завтра' : ''}.`,
    '',
    esc(plainText(ld.essence)),
    '',
    '<b>Хорошо сейчас</b>',
    ...ld.favorable.slice(0, 3).map((x) => `• ${esc(cap(x))}`),
    '<b>Лучше поберечься</b>',
    ...ld.mindful.slice(0, 3).map((x) => `• ${esc(cap(x))}`),
    '',
    `🌱 ${esc(ld.practice)}`,
  ];
  return lines.join('\n');
}
