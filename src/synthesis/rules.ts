/**
 * «Энергия дня» — синтез слоёв по прозрачным правилам. Никакого чёрного ящика:
 * каждое правило ниже показывается в интерфейсе по кнопке «Почему так?».
 *
 * 1. Основа — лунные сутки, действующие большую часть светлого окна (07:00–23:00).
 * 2. Фон — фаза: растущая Луна = рост и запуск, убывающая = завершение и очищение.
 * 3. Окраска — знак Луны, преобладающий в светлом окне.
 * 4. Модификаторы — Луна без курса, коридор затмений, затмение, новолуние/полнолуние, суперлуние.
 * 5. Личная нота — число личного дня. Дополняет, но не переписывает лунную картину.
 * 6. Итог — 2–3 предложения и 3 тега. Числового «рейтинга удачи» нет.
 */
import * as A from '../astro';
import type { Content } from '../content';
import type { Tone } from '../content/schema';
import type { DayModel } from './day';

export const RULES_TEXT: readonly { title: string; text: string }[] = [
  { title: 'Основа', text: 'Лунные сутки, которые идут большую часть светлого времени (по умолчанию 07:00–23:00). Если сутки меняются днём, показываются обе части.' },
  { title: 'Фон', text: 'Фаза Луны: растущая — время роста и запуска, убывающая — завершения и очищения.' },
  { title: 'Окраска', text: 'Знак, в котором Луна стоит большую часть светлого времени: стихия и тема дня.' },
  { title: 'Модификаторы', text: 'Окна Луны без курса с точным временем, коридор затмений (это традиция), сами затмения, новолуние и полнолуние, суперлуние.' },
  { title: 'Личная нота', text: 'Число личного дня по нумерологии Л. Хей и его цвет. Это отдельный слой: он дополняет картину одной фразой.' },
  { title: 'Шкала тона', text: 'Сумма: тон суток (активная +2, переходная 0, созерцательная −1, бережная −2), фаза (растущая +1, убывающая −1, в день новолуния или полнолуния 0), Луна без курса больше трети светлого времени −1, коридор затмений −1. Итог ограничен от −3 до +3: «тише» ↔ «активнее».' },
];

export type Tag =
  | 'для старта'
  | 'для завершения'
  | 'для отдыха'
  | 'для общения'
  | 'для глубокой работы'
  | 'для действий'
  | 'для практических дел'
  | 'для чувств и дома'
  | 'для творчества'
  | 'для рутины'
  | 'для наблюдения';

export interface Modifier {
  key: 'voc' | 'eclipse' | 'corridor' | 'new' | 'full' | 'supermoon' | 'quarter' | 'ingress' | 'perigee' | 'apogee';
  title: string;
  text: string;
  /** Окно действия, если есть. */
  from?: Date;
  to?: Date;
  layer: 'fact' | 'tradition';
}

export interface ToneScale {
  value: number; // −3..+3
  label: string;
  parts: { label: string; value: number }[];
}

export interface Explanation {
  step: string;
  input: string;
  effect: string;
}

export interface EnergyCard {
  base: { day: number; tone: Tone; intensity: number; essence: string; changesAt: Date | null; next: number | null; prev: number | null };
  background: { phase: A.PhaseKey; waxing: boolean; text: string };
  coloring: { sign: A.Sign; text: string };
  modifiers: Modifier[];
  personal: { number: number; note: string; color: { name: string; hex: string } } | null;
  summary: string;
  tags: Tag[];
  tone: ToneScale;
  why: Explanation[];
}

const TONE_POINTS: Record<Tone, number> = { активная: 2, переходная: 0, созерцательная: -1, бережная: -2 };

const ELEMENT_TAG: Record<A.Element, Tag> = {
  fire: 'для действий',
  earth: 'для практических дел',
  air: 'для общения',
  water: 'для чувств и дома',
};

const TONE_TAGS: Record<Tone, Tag[]> = {
  активная: ['для старта', 'для действий'],
  переходная: ['для наблюдения', 'для завершения'],
  созерцательная: ['для глубокой работы', 'для отдыха'],
  бережная: ['для завершения', 'для отдыха'],
};

export function toneLabel(v: number): string {
  if (v <= -2) return 'тихий, бережный день';
  if (v === -1) return 'спокойный день';
  if (v === 0) return 'ровный день';
  if (v === 1) return 'деятельный день';
  return 'яркий, активный день';
}

export function synthesize(day: DayModel, content: Content): EnergyCard {
  const tz = day.location.timeZone;
  const t = (d: Date) => A.formatTime(d, tz);
  const ld = content.lunarDay(day.dominant.number);
  const why: Explanation[] = [];

  // 1. Основа
  const inWindow = day.lunarDays.filter((s) => s.to > day.window.from && s.from < day.window.to);
  const di = inWindow.findIndex((s) => s.day.number === day.dominant.number && s.day.start.getTime() === day.dominant.start.getTime());
  const before = di > 0 ? inWindow[di - 1]! : null;
  const after = di >= 0 && di + 1 < inWindow.length ? inWindow[di + 1]! : null;
  const base = {
    day: day.dominant.number,
    tone: ld.energy.tone,
    intensity: ld.energy.intensity,
    essence: ld.essence,
    /** Смена суток внутри светлого окна: до основы (before) или после неё (after). */
    changesAt: after ? after.from : before ? before.to : null,
    next: after ? after.day.number : null,
    prev: before ? before.day.number : null,
  };
  why.push({
    step: 'Основа',
    input: A.describeLunarDays(day.lunarDays, tz),
    effect: `Большую часть светлого времени идут ${base.day}-е сутки: тон «${base.tone}», выраженность ${base.intensity} из 3.`,
  });

  // 2. Фон
  const nearNew = day.quarters.some((q) => q.quarter === 0);
  const nearFull = day.quarters.some((q) => q.quarter === 2);
  const ph = content.phase(day.phase.phase);
  const bgText = day.phase.waxing ? 'Луна растёт: время роста и запуска.' : 'Луна убывает: время завершения и очищения.';
  why.push({ step: 'Фон', input: `${A.PHASE_NAMES[day.phase.phase]}, освещено ${Math.round(day.phase.illuminationPct)}%`, effect: bgText });

  // 3. Окраска
  const sg = content.sign(day.dominantSign);
  why.push({ step: 'Окраска', input: `Луна ${A.inSign(day.dominantSign)}`, effect: `Добавляет дню ${sg.coloring}.` });

  // 4. Модификаторы
  const mods: Modifier[] = [];
  for (const p of day.voc) {
    const from = p.start < day.bounds.start ? day.bounds.start : p.start;
    const to = p.end > day.bounds.end ? day.bounds.end : p.end;
    mods.push({
      key: 'voc',
      title: 'Луна без курса',
      text: `${p.start < day.bounds.start ? 'до' : `${t(from)}–`}${t(to)}: ${content.special('voc').short}`,
      from,
      to,
      layer: 'fact',
    });
  }
  for (const e of day.eclipses) {
    const key = e.body === 'sun' ? 'eclipse_solar' : 'eclipse_lunar';
    mods.push({ key: 'eclipse', title: `${A.ECLIPSE_TYPE_NAMES[e.type][0]!.toUpperCase()}${A.ECLIPSE_TYPE_NAMES[e.type].slice(1)} ${e.body === 'sun' ? 'солнечное' : 'лунное'} затмение`, text: `максимум в ${t(e.peak)}: ${content.special(key).short}`, from: e.peak, layer: 'fact' });
  }
  if (day.corridor && !day.eclipses.length) {
    mods.push({ key: 'corridor', title: 'Коридор затмений', text: content.special('eclipse_corridor').short, layer: 'tradition' });
  }
  for (const q of day.quarters) {
    if (q.quarter === 0) mods.push({ key: 'new', title: 'Новолуние', text: `в ${t(q.time)}: время намерений, а не громких запусков`, from: q.time, layer: 'fact' });
    else if (q.quarter === 2) mods.push({ key: 'full', title: 'Полнолуние', text: `в ${t(q.time)}: эмоции ярче, хорошо подводить итоги`, from: q.time, layer: 'fact' });
    else mods.push({ key: 'quarter', title: A.QUARTER_NAMES[q.quarter], text: `в ${t(q.time)}`, from: q.time, layer: 'fact' });
  }
  for (const s of day.syzygies) if (s.supermoon) mods.push({ key: 'supermoon', title: 'Суперлуние', text: content.special('supermoon').short, layer: 'fact' });
  for (const i of day.ingresses) mods.push({ key: 'ingress', title: `Луна входит в ${A.SIGN_NAMES[i.sign]}`, text: `в ${t(i.time)}`, from: i.time, layer: 'fact' });
  for (const a of day.apsides) mods.push({ key: a.type, title: a.type === 'perigee' ? 'Перигей' : 'Апогей', text: `в ${t(a.time)}, ${Math.round(a.distanceKm).toLocaleString('ru-RU')} км`, from: a.time, layer: 'fact' });
  if (mods.length) why.push({ step: 'Модификаторы', input: mods.map((m) => m.title).join(', '), effect: 'Уточняют картину дня, но не отменяют основу.' });

  // 5. Личная нота
  let personal: EnergyCard['personal'] = null;
  if (day.personal) {
    const pn = content.personal(day.personal.day);
    personal = { number: day.personal.day, note: pn.note, color: pn.color };
    why.push({ step: 'Личная нота', input: `личный год ${day.personal.year}, месяц ${day.personal.month}, день ${day.personal.day}`, effect: pn.note });
  }

  // Шкала тона
  const parts: ToneScale['parts'] = [{ label: `тон ${base.day}-х суток`, value: TONE_POINTS[base.tone] }];
  parts.push({ label: nearNew || nearFull ? 'день точной фазы' : day.phase.waxing ? 'растущая Луна' : 'убывающая Луна', value: nearNew || nearFull ? 0 : day.phase.waxing ? 1 : -1 });
  if (day.vocDaylightShare > 1 / 3) parts.push({ label: 'долгая Луна без курса', value: -1 });
  if (day.corridor) parts.push({ label: 'коридор затмений', value: -1 });
  const value = Math.max(-3, Math.min(3, parts.reduce((s, p) => s + p.value, 0)));
  const tone: ToneScale = { value, label: toneLabel(value), parts };

  // 6. Итог и теги
  const tags: Tag[] = [];
  const add = (x: Tag) => {
    if (!tags.includes(x) && tags.length < 3) tags.push(x);
  };
  if (day.vocDaylightShare > 0.5) add('для рутины');
  if (nearNew) add('для наблюдения');
  if (nearFull) add('для завершения');
  for (const x of TONE_TAGS[base.tone]) add(x);
  add(day.phase.waxing ? 'для старта' : 'для завершения');
  add(ELEMENT_TAG[A.SIGN_ELEMENT[day.dominantSign]]);
  add('для отдыха');

  const s1 = ld.essence.split('. ')[0]!.replace(/\.$/, '') + '.';
  const phasePart = nearFull
    ? 'Полнолуние делает эмоции ярче'
    : nearNew
      ? 'Новолуние зовёт к тишине и намерениям'
      : day.phase.waxing
        ? 'Луна растёт и поддерживает начинания'
        : 'Луна убывает и помогает завершать';
  const s2 = `${phasePart}, а Луна ${A.inSign(day.dominantSign)} добавляет дню ${sg.coloring}.`;
  const longVoc = day.voc.find((p) => p.end.getTime() - p.start.getTime() > 3 * 3_600_000 && p.end > day.window.from && p.start < day.window.to);
  let s3: string;
  if (longVoc) {
    const a = longVoc.start < day.bounds.start ? null : longVoc.start;
    const b = longVoc.end > day.bounds.end ? null : longVoc.end;
    const span = a && b ? `${t(a)}–${t(b)}` : a ? `с ${t(a)}` : b ? `до ${t(b)}` : 'весь день';
    s3 = `Важное лучше начинать вне Луны без курса (${span}).`;
  } else if (base.next !== null && base.changesAt) {
    s3 = `В ${t(base.changesAt)} начнутся ${base.next}-е сутки, и настрой сменится.`;
  } else if (base.prev !== null && base.changesAt) {
    s3 = `До ${t(base.changesAt)} ещё идут ${base.prev}-е сутки, основная часть дня — ${base.day}-е.`;
  } else {
    s3 = `Хорошо: ${ld.favorable.slice(0, 2).join(', ')}.`;
  }
  const summary = [s1, s2, s3].join(' ');

  return {
    base,
    background: { phase: day.phase.phase, waxing: day.phase.waxing, text: ph.essence },
    coloring: { sign: day.dominantSign, text: sg.coloring },
    modifiers: mods,
    personal,
    summary,
    tags,
    tone,
    why,
  };
}
