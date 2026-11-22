/**
 * «Сегодня по-простому»: короткий план дня, сферы жизни и удачное время.
 * Строится поверх модели дня (факт) и толкований (традиция) по простым правилам:
 *
 * 1. Сферы жизни — по знаку Луны, преобладающему в светлое время (таблица life-areas.json).
 * 2. Фаза добавляет подсказку к деньгам и здоровью: растущая — копить и начинать, убывающая — отдавать и очищаться.
 * 3. Луна без курса в светлое время (от 30 минут) добавляет точное время «осторожно» к работе и деньгам.
 * 4. Затмение и коридор затмений (традиция) советуют отложить крупные решения.
 * 5. Удачное время для важного = светлое окно минус Луна без курса, отрезки от 30 минут.
 */
import * as A from '../astro';
import type { Content } from '../content';
import type { Tone } from '../content/schema';
import lifeData from '../content/data/life-areas.json';
import type { DayModel } from './day';
import type { EnergyCard } from './rules';
import { plainText } from './explain';

export type LifeAreaKey = 'work' | 'money' | 'health' | 'people' | 'home';

export const LIFE_AREAS: readonly { key: LifeAreaKey; icon: string; title: string }[] = [
  { key: 'work', icon: '💼', title: 'Работа и дела' },
  { key: 'money', icon: '💰', title: 'Деньги и покупки' },
  { key: 'health', icon: '🌿', title: 'Здоровье и тело' },
  { key: 'people', icon: '🤝', title: 'Люди и отношения' },
  { key: 'home', icon: '🏡', title: 'Дом и сад' },
];

type AreaText = { good: string; careful: string };
export const LIFE_TABLE = lifeData as Record<A.Sign, Record<LifeAreaKey, AreaText>>;

export interface LifeArea {
  key: LifeAreaKey;
  icon: string;
  title: string;
  good: string;
  careful: string;
  /** Дополнительная подсказка (фаза, точное время). */
  note: string | null;
}

export interface TimeWindow {
  from: Date;
  to: Date;
}

const MIN_WINDOW = 30 * 60_000;

/** Отрезки светлого окна без Луны без курса, каждый не короче 30 минут. */
export function goodWindows(day: DayModel): TimeWindow[] {
  let parts: TimeWindow[] = [{ from: day.window.from, to: day.window.to }];
  for (const v of day.voc) {
    const next: TimeWindow[] = [];
    for (const p of parts) {
      if (v.end <= p.from || v.start >= p.to) {
        next.push(p);
        continue;
      }
      if (v.start > p.from) next.push({ from: p.from, to: v.start });
      if (v.end < p.to) next.push({ from: v.end, to: p.to });
    }
    parts = next;
  }
  return parts.filter((p) => p.to.getTime() - p.from.getTime() >= MIN_WINDOW);
}

/** Окна Луны без курса внутри светлого окна (от 30 минут), обрезанные по нему. */
export function vocInDaylight(day: DayModel): TimeWindow[] {
  return day.voc
    .map((v) => ({ from: v.start < day.window.from ? day.window.from : v.start, to: v.end > day.window.to ? day.window.to : v.end }))
    .filter((w) => w.to.getTime() - w.from.getTime() >= MIN_WINDOW);
}

export function spanText(w: TimeWindow, tz: string): string {
  return `${A.formatTime(w.from, tz)}–${A.formatTime(w.to, tz)}`;
}

export function lifeAreas(day: DayModel): LifeArea[] {
  const tz = day.location.timeZone;
  const table = LIFE_TABLE[day.dominantSign];
  const voc = vocInDaylight(day);
  const vocSpan = voc.map((w) => spanText(w, tz)).join(', ');
  const nearNew = day.quarters.some((q) => q.quarter === 0);
  const nearFull = day.quarters.some((q) => q.quarter === 2);
  const bigEvent = day.eclipses.length > 0 || day.corridor !== null;

  return LIFE_AREAS.map(({ key, icon, title }) => {
    const t = table[key];
    let note: string | null = null;
    if (key === 'work') {
      if (voc.length) note = `${vocSpan} Луна без курса: в это время не начинай важное и не подписывай договоры.`;
      else if (bigEvent) note = 'Время затмений: крупные решения лучше отложить на пару недель.';
    }
    if (key === 'money') {
      if (voc.length) note = `Крупные покупки — не в ${vocSpan}.`;
      else if (nearFull) note = 'Полнолуние: эмоции сильнее, поэтому крупные траты лучше обдумать до завтра.';
      else note = day.phase.waxing ? 'Луна растёт: хорошо откладывать деньги и начинать.' : 'Луна убывает: хорошо отдавать долги и избавляться от лишнего.';
    }
    if (key === 'health') {
      if (nearNew) note = 'Новолуние: сил меньше обычного, не перегружай себя.';
      else if (nearFull) note = 'Полнолуние: сон может быть беспокойным, ложись пораньше.';
      else note = day.phase.waxing ? 'Луна растёт: хорошо начинать полезные привычки.' : 'Луна убывает: хорошо отказываться от вредного и очищаться.';
    }
    return { key, icon, title, good: t.good, careful: t.careful, note };
  });
}

export interface DayMood {
  title: string;
  hint: string;
  /** Цветовой ключ: active | even | calm. */
  kind: 'active' | 'even' | 'calm';
}

export function dayMood(toneValue: number): DayMood {
  if (toneValue >= 2) return { title: 'Активный день', hint: 'Хорошо действовать и начинать', kind: 'active' };
  if (toneValue === 1) return { title: 'Деятельный день', hint: 'Хорошо для дел и решений', kind: 'active' };
  if (toneValue === 0) return { title: 'Ровный день', hint: 'Обычные дела без спешки', kind: 'even' };
  if (toneValue === -1) return { title: 'Спокойный день', hint: 'Лучше завершать, чем начинать', kind: 'calm' };
  return { title: 'Тихий день', hint: 'Береги силы, отдыхай', kind: 'calm' };
}

export interface DayPlan {
  mood: DayMood;
  /** Лунный день, по которому составлен план (идёт большую часть светлого времени). */
  lunarDay: number;
  /** Одна-две простые фразы о дне. */
  headline: string;
  doList: string[];
  avoidList: string[];
  practice: string;
  question: string;
}

const PHASE_SIMPLE = (day: DayModel): string => {
  if (day.quarters.some((q) => q.quarter === 0)) return 'Сегодня новолуние: время загадать и спланировать, а не громко начинать.';
  if (day.quarters.some((q) => q.quarter === 2)) return 'Сегодня полнолуние: эмоции ярче, хорошо подводить итоги.';
  return day.phase.waxing ? 'Луна растёт — хорошо начинать и наращивать.' : 'Луна убывает — хорошо завершать и освобождаться от лишнего.';
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function dayPlan(day: DayModel, card: EnergyCard, content: Content): DayPlan {
  const ld = content.lunarDay(day.dominant.number);
  // Весь смысл лунного дня (обычно две фразы): одной фразы вроде «День призыва» мало, чтобы понять день.
  // Фаза добавляется только в дни новолуния и полнолуния, в остальные она видна рядом («Луна растёт»).
  const special = day.quarters.some((q) => q.quarter === 0 || q.quarter === 2);
  return {
    mood: dayMood(card.tone.value),
    lunarDay: day.dominant.number,
    headline: special ? `${plainText(ld.essence)} ${PHASE_SIMPLE(day)}` : plainText(ld.essence),
    doList: ld.favorable.slice(0, 3).map(cap),
    avoidList: ld.mindful.slice(0, 2).map(cap),
    practice: ld.practice,
    question: ld.reflection,
  };
}

/** Тон суток → простой цвет на шкале дня. */
export const TONE_KIND: Record<Tone, DayMood['kind']> = { активная: 'active', переходная: 'even', созерцательная: 'calm', бережная: 'calm' };
