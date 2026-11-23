/**
 * Дополнительные сообщения бота (D-146), бот запускается каждую минуту:
 *  — голосом о смене лунного дня (текст — changeSpeech);
 *  — Луна без курса: предупреждение примерно за 15 минут;
 *  — вечерний вопрос для дневника в выбранное время;
 *  — Солнце в новых воротах (Дизайн человека): что это значит лично для человека, тексты — по курсу;
 *  — напоминание накануне о дне, выбранном в «Подобрать день».
 * Все уведомления (кроме вечернего, время которого выбирает человек) — только с 07:00 до 22:00 по местному времени.
 */
import * as A from '../astro';
import { makeContent, type Content } from '../content';
import { DEFAULT_NUMEROLOGY } from '../personal/numerology';
import { computeDay } from '../synthesis/day';
import { dayAreas } from '../synthesis/areas';
import { goodWindows, spanText, vocInDaylight } from '../synthesis/life';
import { plainText } from '../synthesis/explain';
import { bodygraphFromUtc } from '../humandesign/chart';
import { transitActivationsAt } from '../humandesign/transits';
import { CHANNELS, GATE_CENTER, channelKey, definedCenters } from '../humandesign/graph';
import hdContent from '../content/data/humandesign.json';
import type { Reminder } from './reminder';
import { esc } from './message';
import { dot, ordinalM, speak } from './speech';
import { localTime, type Subscriber } from './state';

export const DAY_FROM = 7 * 60;
export const DAY_TO = 22 * 60;
export const VOC_LEAD_MIN = 15;
export const REMIND_AT = 20 * 60;

let contentCache: Content | null = null;
const content = () => (contentCache ??= makeContent());
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WD = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

export const locOf = (s: Subscriber): A.ResolvedLocation => ({ id: 'bot', name: '', latitude: s.sub.latitude, longitude: s.sub.longitude, elevation: 0, timeZone: s.sub.timeZone });
const inDay = (s: Subscriber, t: Date) => {
  const m = localTime(s.sub, t).minutes;
  return m >= DAY_FROM && m < DAY_TO;
};
function dateText(key: A.DateKey): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]} (${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}

// ---------- 1. Голосом о смене лунного дня ----------

export function changeSpeech(day: A.LunarDay, timeZone: string): string[] {
  const ld = content().lunarDay(day.number);
  const tomorrow = A.toDateKey(day.end, timeZone) !== A.toDateKey(day.start, timeZone);
  return [
    `Энергия сменилась. Начался ${ordinalM(day.number)} лунный день, он продлится до ${A.formatTime(day.end, timeZone)}${tomorrow ? ' завтра' : ''}. ${dot(plainText(ld.essence))}`,
    `Сейчас хорошо: ${ld.favorable.slice(0, 3).join(', ')}. Лучше поберечься: ${ld.mindful.slice(0, 3).join(', ')}.`,
    `Практика: ${dot(ld.practice)}`,
  ].map(speak);
}

// ---------- 3. Луна без курса ----------

/** Начинается ли скоро Луна без курса, о которой ещё не предупреждали. */
export function vocDue(s: Subscriber, now: Date): A.VocPeriod | null {
  if (!s.sub.voc) return null;
  const ps = A.vocPeriodsBetween(new Date(now.getTime() - 5 * 60000), new Date(now.getTime() + (VOC_LEAD_MIN + 1) * 60000), 'modern');
  for (const p of ps) {
    const lead = (p.start.getTime() - now.getTime()) / 60000;
    if (lead < -2 || lead > VOC_LEAD_MIN + 1) continue;
    if (s.lastVoc === p.start.toISOString()) continue;
    if (!inDay(s, p.start)) continue;
    return p;
  }
  return null;
}

export function vocText(p: A.VocPeriod, now: Date, timeZone: string): string {
  const v = content().special('voc');
  const t = (d: Date) => A.formatTime(d, timeZone);
  const sameDay = A.toDateKey(p.end, timeZone) === A.toDateKey(p.start, timeZone);
  const mins = Math.max(0, Math.round((p.start.getTime() - now.getTime()) / 60000));
  return [
    `⏸ <b>${mins > 1 ? `Через ${mins} мин` : 'Сейчас'} Луна без курса</b>`,
    `С ${t(p.start)} до ${sameDay ? t(p.end) : `${dateText(A.toDateKey(p.end, timeZone)).replace(/ \(.*/, '')}, ${t(p.end)}`}.`,
    '',
    `По традиции начатое в эти часы часто не доходит до цели. Важное лучше начать до ${t(p.start)} или после окончания.`,
    `<b>Хорошо:</b> ${esc(v.favorable.join(', '))}.`,
    `<b>Поберечься:</b> ${esc(v.mindful.join(', '))}.`,
  ].join('\n');
}

// ---------- 4. Вечер с дневником ----------

export function eveningDue(s: Subscriber, now: Date): boolean {
  if (s.sub.evening === undefined) return false;
  const { date, minutes } = localTime(s.sub, now);
  if (s.lastEvening === date) return false;
  return minutes >= s.sub.evening && minutes < s.sub.evening + 120;
}

export function eveningText(s: Subscriber, now: Date): string {
  const { date } = localTime(s.sub, now);
  const day = A.lunarDayAt(locOf(s), now);
  const ld = content().lunarDay(day.number);
  return [
    `🌙 <b>Вечер, ${dateText(date)}</b>`,
    '',
    `Вопрос ${day.number}-го лунного дня:`,
    `<i>${esc(ld.reflection)}</i>`,
    '',
    'Как прошёл день? Запиши пару слов о самочувствии и настроении. Чем больше записей, тем точнее приложение подскажет, как на тебя влияют Луна и транзиты.',
  ].join('\n');
}

// ---------- 5. Солнце в новых воротах ----------

type HdC = typeof hdContent;
const H: HdC = hdContent;
const gateInfo = (g: number) => H.gates[String(g) as keyof HdC['gates']];
const channelInfo = (k: string) => H.channels[k as keyof HdC['channels']];

export function sunGateAt(t: Date): number {
  return transitActivationsAt(t).find((a) => a.body === 'sun')!.gate;
}

/** Ворота Солнца сменились, и время подходящее: вернуть новые ворота. Первый раз — только запомнить. */
export function sunGateDue(s: Subscriber, now: Date): { gate: number; silent: boolean } | null {
  if (!s.sub.sunGate || s.sub.birthUtc === undefined) return null;
  const g = sunGateAt(now);
  if (s.lastSunGate === g) return null;
  if (s.lastSunGate === undefined) return { gate: g, silent: true };
  if (!inDay(s, now)) return null;
  return { gate: g, silent: false };
}

/** Когда Солнце уйдёт из этих ворот (поиск по часам, потом по минутам). */
export function sunGateEnd(now: Date, gate: number): Date {
  let t = now.getTime();
  const H1 = 3600000;
  for (let i = 0; i < 24 * 8 && sunGateAt(new Date(t + H1)) === gate; i++) t += H1;
  let lo = t;
  let hi = t + H1;
  while (hi - lo > 60000) {
    const mid = (lo + hi) / 2;
    if (sunGateAt(new Date(mid)) === gate) lo = mid;
    else hi = mid;
  }
  return new Date(hi);
}

export function sunGateText(s: Subscriber, gate: number, now: Date): string {
  const me = bodygraphFromUtc(new Date(s.sub.birthUtc!));
  const gi = gateInfo(gate);
  const tz = s.sub.timeZone;
  const end = sunGateEnd(now, gate);
  const lines = [
    `☀️ <b>Солнце вошло в ворота ${gate} «${esc(gi.name)}»</b>`,
    `До ${dateText(A.toDateKey(end, tz)).replace(/ \(.*/, '')}, ${A.formatTime(end, tz)} — главная тема транзита для всех: ${esc(gi.gist)}.`,
  ];
  if (me.gates.has(gate)) lines.push('', `✨ Это твои ворота с рождения: их тема в эти дни звучит у тебя особенно сильно.`);
  const natal = new Set(me.channels.map(channelKey));
  for (const ch of CHANNELS) {
    if (!ch.includes(gate)) continue;
    const other = ch[0] === gate ? ch[1] : ch[0];
    const key = channelKey(ch);
    if (!me.gates.has(other) || natal.has(key)) continue;
    const info = channelInfo(key)!;
    const opened = [...definedCenters([ch])].filter((c) => !me.centers.has(c));
    lines.push(
      '',
      `🔗 <b>Канал ${ch[0]}–${ch[1]} «${esc(info.name)}»</b>`,
      `Твои ворота ${other} соединяются с воротами ${gate}, и на эти дни канал работает у тебя как свой: ${esc(info.text)}.`,
    );
    for (const c of opened) {
      const ci = H.centers[c];
      lines.push(`${esc(ci.name)} у тебя открыт, сейчас он определён извне. ${esc(ci.transit)}`);
    }
  }
  if (lines.length === 2) {
    const c = GATE_CENTER[gate]!;
    const ci = H.centers[c];
    lines.push('', `Эти ворота в ${me.centers.has(c) ? 'твоём определённом' : 'твоём открытом'} центре: ${esc(ci.name)} (${esc(ci.short)}).`);
  }
  return lines.join('\n');
}

// ---------- 2. Напоминание о выбранном дне ----------

/** Напоминания, которые пора прислать (накануне выбранного дня, с 20:00), и чистка прошедших. */
export function remindersDue(s: Subscriber, now: Date): Reminder[] {
  if (!s.reminders?.length) return [];
  const { date, minutes } = localTime(s.sub, now);
  s.reminders = s.reminders.filter((r) => r.date > date);
  const tomorrow = A.addDays(date, 1);
  if (minutes < REMIND_AT || minutes >= REMIND_AT + 180) return [];
  return s.reminders.filter((r) => r.date === tomorrow) as Reminder[];
}

const VERDICT_TEXT = { good: '✅ благоприятно', neutral: '➖ обычный день', bad: '⛔ по традиции лучше отложить' } as const;

export function reminderText(s: Subscriber, r: Reminder): string {
  const loc = locOf(s);
  const day = computeDay(loc, r.date, { daylight: { from: 7, to: 23 }, vocMode: 'modern', zodiac: 'tropical', vedic: false, garden: false, birthday: null, numerology: DEFAULT_NUMEROLOGY });
  const area = dayAreas(day).find((a) => a.key === r.area)!;
  const ld = content().lunarDay(day.dominant.number);
  const tz = loc.timeZone;
  const good = goodWindows(day);
  const voc = vocInDaylight(day);
  return [
    `📅 <b>Завтра, ${dateText(r.date)}</b>`,
    `Этот день выбран для дела «${esc(area.title)}». Оценка: ${VERDICT_TEXT[area.verdict]}.`,
    '',
    `🌙 ${day.dominant.number}-й лунный день: ${esc(plainText(ld.essence))}`,
    `🕐 Лучшее время: ${good.length ? good.map((w) => spanText(w, tz)).join(', ') : 'завтра без удачного окна'}`,
    ...(voc.length ? [`⏸ Луна без курса: ${voc.map((w) => spanText(w, tz)).join(', ')} — в эти часы важное лучше не начинать.`] : []),
    '',
    `Хорошо: ${esc(ld.favorable.join(", "))}.`,
  ].join('\n');
}
