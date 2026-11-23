/**
 * Текст для голосового утреннего сообщения (D-137): тот же расклад, что в тексте, но написанный для слуха —
 * связными фразами, без значков и списков, числа дат и лунного дня словами.
 */
import * as A from '../astro';
import { makeContent, type Content } from '../content';
import { DEFAULT_NUMEROLOGY } from '../personal/numerology';
import { computeDay } from '../synthesis/day';
import { synthesize } from '../synthesis/rules';
import { dayAreas } from '../synthesis/areas';
import { dayPlan, goodWindows, vocInDaylight, type TimeWindow } from '../synthesis/life';
import { moodAbout, plainText } from '../synthesis/explain';
import type { HdStory } from '../humandesign/summary';
import type { MorningInput } from './message';

const UNITS_M = ['', 'первый', 'второй', 'третий', 'четвёртый', 'пятый', 'шестой', 'седьмой', 'восьмой', 'девятый'];
const TEENS_M = ['десятый', 'одиннадцатый', 'двенадцатый', 'тринадцатый', 'четырнадцатый', 'пятнадцатый', 'шестнадцатый', 'семнадцатый', 'восемнадцатый', 'девятнадцатый'];

/** Порядковое числительное 1–39, мужской род: «двадцать третий». */
export function ordinalM(n: number): string {
  if (n < 10) return UNITS_M[n]!;
  if (n < 20) return TEENS_M[n - 10]!;
  const tens = Math.floor(n / 10);
  const u = n % 10;
  if (u === 0) return tens === 2 ? 'двадцатый' : 'тридцатый';
  return `${tens === 2 ? 'двадцать' : 'тридцать'} ${UNITS_M[u]}`;
}

/** Средний род: «двадцать третье» (для числа месяца). */
export function ordinalN(n: number): string {
  return ordinalM(n).replace(/третий$/, 'третье').replace(/(ый|ой)$/, 'ое');
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WD = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
export const dot = (s: string) => (/[.!?…»]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
/** Для слуха: убрать скобки, тире между числами читать как «и», кавычки не нужны. */
export const speak = (s: string) =>
  s
    .replace(/(\d+)–(\d+)/g, '$1 и $2')
    .replace(/\s*\(([^)]*)\)/g, ', $1,')
    .replace(/,\s*([.:;!?])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/[«»"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

let contentCache: Content | null = null;

function spans(ws: TimeWindow[], tz: string): string {
  return ws.map((w) => `с ${A.formatTime(w.from, tz)} до ${A.formatTime(w.to, tz)}`).join(', и ещё ');
}

/** Абзацы голосового сообщения. hd — разбор Дизайна человека (если подключён). */
export function morningSpeech({ loc, date, birthday, firstName }: MorningInput, hd?: HdStory): string[] {
  const tz = loc.timeZone;
  const day = computeDay(loc, date, { daylight: { from: 7, to: 23 }, vocMode: 'modern', zodiac: 'tropical', vedic: false, garden: false, birthday, numerology: DEFAULT_NUMEROLOGY });
  const content = (contentCache ??= makeContent());
  const card = synthesize(day, content);
  const plan = dayPlan(day, card, content);
  const areas = dayAreas(day);
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const wd = WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]!;
  const ld = content.lunarDay(day.dominant.number);
  const ph = content.phase(day.phase.phase);
  const sg = content.sign(day.dominantSign);
  const good = goodWindows(day);
  const voc = vocInDaylight(day);
  const names = (v: string) => areas.filter((a) => a.verdict === v).map((a) => a.title.toLowerCase());

  const out: string[] = [];
  out.push(`${firstName ? `Доброе утро, ${firstName}!` : 'Доброе утро!'} Сегодня ${wd}, ${ordinalN(d)} ${MONTHS[m - 1]}. Вот твой расклад на день.`);

  let lunar = `Идёт ${ordinalM(day.dominant.number)} лунный день.`;
  if (card.base.prev !== null && card.base.changesAt) lunar = `${cap(ordinalM(day.dominant.number))} лунный день начинается в ${A.formatTime(card.base.changesAt, tz)}, а до этого продолжается ${ordinalM(card.base.prev)}.`;
  else if (card.base.next !== null && card.base.changesAt) lunar += ` В ${A.formatTime(card.base.changesAt, tz)} начнётся ${ordinalM(card.base.next)}.`;
  out.push(`${lunar} ${dot(plainText(ld.essence))}`);

  out.push(
    `${dot(plan.mood.title)} ${moodAbout(plan.mood)} Луна ${day.phase.waxing ? 'растёт' : 'убывает'}: ${dot(lowerFirst(ph.essence.split('. ').slice(1).join('. ') || ph.essence))} Луна ${A.inSign(day.dominantSign)} добавляет дню ${dot(sg.coloring)}`,
  );

  out.push(`Что хорошо сегодня: ${dot(ld.favorable.join('; '))} А поберечься лучше вот от чего: ${dot(ld.mindful.join('; '))}`);

  const g = names('good');
  const b = names('bad');
  if (g.length || b.length) out.push([g.length ? `Благоприятные сферы: ${g.join(', ')}.` : '', b.length ? `Лучше отложить: ${b.join(', ')}.` : ''].filter(Boolean).join(' '));

  const t: string[] = [];
  t.push(good.length ? `Время для важных дел — ${spans(good, tz)}.` : 'Сегодня лучше обойтись без важных начинаний.');
  if (voc.length) t.push(`${cap(spans(voc, tz))} Луна без курса: в эти часы лучше заниматься привычными делами и ничего нового не начинать.`);
  if (day.sun.sunrise && day.sun.sunset) t.push(`Солнце встаёт в ${A.formatTime(day.sun.sunrise, tz)}, а садится в ${A.formatTime(day.sun.sunset, tz)}.`);
  out.push(t.join(' '));

  const mods = card.modifiers.filter((x) => ['eclipse', 'new', 'full', 'supermoon'].includes(x.key));
  for (const mm of mods) out.push(`${dot(mm.title)} ${dot(mm.text)}`);

  if (card.personal) {
    const pn = content.personal(card.personal.number);
    out.push(`Твой личный день по нумерологии — ${card.personal.number}. ${dot(pn.about)} Хорошо: ${pn.favorable.join(', ')}. Не стоит: ${dot(pn.mindful.join(', '))}`);
  }

  if (hd) out.push(...hdSpeech(hd));

  out.push(`Практика дня: ${dot(lowerFirst(ld.practice))} И вопрос себе на сегодня: ${plan.question}`);
  out.push('Хорошего тебе дня!');
  return out.map(speak);
}

/** Дизайн человека для слуха: тема, главное в тебе, открытые центры, стратегия. */
export function hdSpeech(s: HdStory): string[] {
  const out: string[] = [];
  out.push(`Теперь Дизайн человека. Тема дня для всех — ворота ${s.theme.gate}, ${s.theme.name}: ${dot(s.theme.gist)}${s.theme.mine ? ' Это твои ворота, поэтому тема звучит в тебе особенно ярко.' : ''}`);
  const mine = s.mine.slice(0, 4);
  if (mine.length) {
    out.push(
      'Что сегодня включается в тебе. ' +
        mine.map((i) => `${i.when === 'Весь день' ? 'Весь день' : i.when} — ${lowerFirst(i.title)}. ${dot(i.text)}`).join(' ') +
        (s.mine.length > mine.length ? ` И ещё ${s.mine.length - mine.length} — в приложении.` : ''),
    );
  }
  const open = s.open.slice(0, 3);
  if (open.length) {
    out.push(
      'Что приходит извне, через открытые центры. ' +
        open.map((i) => `${i.when === 'Весь день' ? 'Весь день' : i.when} — ${i.title.replace(/\s*\(.*\)$/, '')}. ${dot(i.text)}`).join(' '),
    );
  }
  const ty = s.type;
  out.push(`И главное: ты ${lowerFirst(ty.name)}. Твоя стратегия — ${dot(ty.strategy)} Авторитет — ${dot(ty.authority)} Если день идёт верно, будет ${ty.signature}.`);
  return out;
}
