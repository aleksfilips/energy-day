/**
 * Текст утреннего сообщения «Энергия дня» для одного человека.
 * Используется ботом (scripts/bot.ts). Те же расчёты и тексты, что в приложении.
 */
import * as A from '../astro';
import { makeContent, type Content } from '../content';
import { DEFAULT_NUMEROLOGY } from '../personal/numerology';
import { computeDay } from '../synthesis/day';
import { synthesize } from '../synthesis/rules';
import { dayAreas } from '../synthesis/areas';
import { dayPlan, goodWindows, spanText, vocInDaylight } from '../synthesis/life';

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WD = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let contentCache: Content | null = null;

export interface MorningInput {
  loc: A.ResolvedLocation;
  /** Подпись места в заголовке; пусто — без подписи. */
  placeName?: string;
  date: A.DateKey;
  birthday: { day: number; month: number } | null;
  /** Обращение по имени (из Telegram). */
  firstName?: string;
}

export function morningText({ loc, placeName, date, birthday, firstName }: MorningInput): string {
  const tz = loc.timeZone;
  const day = computeDay(loc, date, {
    daylight: { from: 7, to: 23 },
    vocMode: 'modern',
    zodiac: 'tropical',
    vedic: false,
    garden: false,
    birthday,
    numerology: DEFAULT_NUMEROLOGY,
  });
  const content = (contentCache ??= makeContent());
  const card = synthesize(day, content);
  const t = (d: Date) => A.formatTime(d, tz);
  const [, m, d] = date.split('-').map(Number) as [number, number, number];
  const plan = dayPlan(day, card, content);
  const areas = dayAreas(day);
  const wd = WD[new Date(Date.UTC(Number(date.slice(0, 4)), m - 1, d)).getUTCDay()]!;
  const names = (v: string) => areas.filter((a) => a.verdict === v).map((a) => a.title.toLowerCase()).join(', ');
  const change =
    card.base.prev !== null && card.base.changesAt
      ? ` (с ${t(card.base.changesAt)}, до этого ${card.base.prev}-й)`
      : card.base.next !== null && card.base.changesAt
        ? ` (в ${t(card.base.changesAt)} начнётся ${card.base.next}-й)`
        : '';
  const good = goodWindows(day);
  const voc = vocInDaylight(day);

  const lines = [
    `<b>${wd[0]!.toUpperCase() + wd.slice(1)}, ${d} ${MONTHS[m - 1]}</b>${placeName ? ` · ${esc(placeName)}` : ''}`,
    ...(firstName ? [`Доброе утро, ${esc(firstName)}!`] : []),
    `🌙 ${day.dominant.number}-й лунный день${change}`,
    `Луна ${day.phase.waxing ? 'растёт' : 'убывает'}, ${esc(A.inSign(day.dominantSign))}`,
    '',
    `<b>${esc(plan.mood.title)}.</b> ${esc(plan.headline)}`,
    '',
  ];
  if (names('good')) lines.push(`✅ <b>Хорошо:</b> ${esc(names('good'))}`);
  if (names('bad')) lines.push(`⛔ <b>Лучше не стоит:</b> ${esc(names('bad'))}`);
  lines.push('');
  lines.push(`🕐 Для важных дел: ${good.length ? good.map((w) => spanText(w, tz)).join(', ') : 'сегодня лучше без важных начинаний'}`);
  if (voc.length) lines.push(`⏸ Луна без курса: ${voc.map((w) => spanText(w, tz)).join(', ')} — новое не начинать`);
  if (day.sun.sunrise && day.sun.sunset) lines.push(`☀️ Восход ${t(day.sun.sunrise)}, закат ${t(day.sun.sunset)}`);
  for (const mm of card.modifiers.filter((x) => ['eclipse', 'new', 'full', 'supermoon'].includes(x.key))) lines.push(`✨ ${esc(mm.title)}: ${esc(mm.text)}`);
  if (card.personal) {
    const pn = content.personal(card.personal.number);
    lines.push('', `🔢 Твой личный день: <b>${card.personal.number}</b>, цвет ${esc(pn.color.name)}. ${esc(pn.essence)}`);
  }
  lines.push('', `💭 <i>${esc(plan.question)}</i>`);
  return lines.join('\n');
}
