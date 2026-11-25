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
import { moodAbout, plainText } from '../synthesis/explain';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

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
  /** Момент отправки: советы — по лунному дню, который идёт в этот момент (D-149). */
  at?: Date;
}

export function morningText({ loc, placeName, date, birthday, firstName, at }: MorningInput): string {
  const tz = loc.timeZone;
  const day = computeDay(loc, date, {
    daylight: { from: 7, to: 23 },
    vocMode: 'modern',
    zodiac: 'tropical',
    vedic: false,
    garden: false,
    birthday,
    numerology: DEFAULT_NUMEROLOGY,
    at,
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

  const ld = content.lunarDay(day.dominant.number);
  const ph = content.phase(day.phase.phase);
  const sg = content.sign(day.dominantSign);
  const bullets = (xs: string[]) => xs.map((x) => `• ${esc(cap(x))}`);
  const vocInfo = content.special('voc');

  const lines = [
    `<b>${cap(wd)}, ${d} ${MONTHS[m - 1]}</b>${placeName ? ` · ${esc(placeName)}` : ''}`,
    ...(firstName ? [`Доброе утро, ${esc(firstName)}!`] : []),
    '',
    `🌙 <b>${day.dominant.number}-й лунный день</b>${change}`,
    esc(plainText(ld.essence)),
    '',
    `<b>${esc(plan.mood.title)}.</b> ${esc(moodAbout(plan.mood))}`,
    `Луна ${day.phase.waxing ? 'растёт' : 'убывает'}: ${esc(lowerFirst(ph.essence.split('. ').slice(1).join('. ') || ph.essence))}`,
    `Луна ${esc(A.inSign(day.dominantSign))} добавляет дню ${esc(sg.coloring)}.`,
    '',
    '<b>Хорошо сегодня</b>',
    ...bullets(ld.favorable),
    '<b>Лучше поберечься</b>',
    ...bullets(ld.mindful),
    '',
    '<b>Сферы жизни</b>',
  ];
  if (names('good')) lines.push(`✅ Благоприятно: ${esc(names('good'))}`);
  if (names('neutral')) lines.push(`➖ Обычный день: ${esc(names('neutral'))}`);
  if (names('bad')) lines.push(`⛔ Лучше отложить: ${esc(names('bad'))}`);
  lines.push('', '<b>Время дня</b>');
  lines.push(`🕐 Для важных дел: ${good.length ? good.map((w) => spanText(w, tz)).join(', ') : 'сегодня лучше без важных начинаний'}`);
  if (voc.length)
    lines.push(
      `⏸ ${voc.map((w) => spanText(w, tz)).join(', ')} — Луна без курса. По традиции начатое в эти часы часто не доходит до цели. Лучше заниматься привычным, ${esc(vocInfo.mindful.join(', '))}.`,
    );
  if (day.sun.sunrise && day.sun.sunset) lines.push(`☀️ Восход ${t(day.sun.sunrise)}, закат ${t(day.sun.sunset)}`);
  const mods = card.modifiers.filter((x) => ['eclipse', 'new', 'full', 'supermoon'].includes(x.key));
  if (mods.length) lines.push('', ...mods.map((mm) => `✨ <b>${esc(mm.title)}:</b> ${esc(mm.text)}`));
  if (card.personal) {
    const pn = content.personal(card.personal.number);
    lines.push(
      '',
      `🔢 <b>Твой личный день — ${card.personal.number}</b> (цвет ${esc(pn.color.name)})`,
      esc(pn.about),
      `Хорошо: ${esc(pn.favorable.join(', '))}. Не стоит: ${esc(pn.mindful.join(', '))}.`,
      '<i>Личный день — число из нумерологии по твоей дате рождения, у каждого своё и меняется каждый день.</i>',
    );
  }
  lines.push('', `🌱 <b>Практика дня:</b> ${esc(ld.practice)}`, `💭 <i>${esc(plan.question)}</i>`);
  lines.push('', 'Подробно по каждой сфере — в приложении, кнопка «Открыть».');
  return fit(lines);
}

/** Телеграм принимает до 4096 знаков. Если вдруг длиннее — убираем второстепенные строки. */
const LIMIT = 3900;
const plain = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function fit(lines: string[]): string {
  let out = lines.join('\n');
  for (const drop of [/^➖ /, /^<i>Личный день — число/, /^Подробно по каждой/, /^🌱 /]) {
    if (plain(out).length <= LIMIT) break;
    out = out.split('\n').filter((l) => !drop.test(l)).join('\n');
  }
  return out;
}
