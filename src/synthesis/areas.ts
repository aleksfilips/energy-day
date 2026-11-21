/**
 * «Что сегодня благоприятно»: оценка 20 сфер жизни на лунный день.
 *
 * Основа — таблица оценок по лунным дням (life-moon.pp.ru, шкала 5…1), сверенная с текстом
 * того же источника: где текст строже таблицы, берётся более осторожная оценка (adjustments
 * в lunar-areas.json с причиной). Тексты пояснений — свои.
 *
 * Сверху накладываются астрономические факты дня:
 * 1. Луна без курса больше половины светлого времени — «хорошо» у деловых сфер становится «нейтрально».
 *    Если меньше — к деловым сферам добавляется точное время, когда не начинать.
 * 2. День затмения — деловые начинания, свадьба, недвижимость, смена работы: «не стоит».
 * 3. Коридор затмений (традиция) — начинания, свадьба, недвижимость, смена работы: «хорошо» → «нейтрально».
 * 4. Сад: знак Луны (плодородный или нет) добавляет пояснение. Стрижка: фаза добавляет пояснение.
 */
import * as A from '../astro';
import data from '../content/data/lunar-areas.json';
import type { DayModel } from './day';
import { spanText, vocInDaylight } from './life';

export type Verdict = 'good' | 'neutral' | 'bad';

type Col =
  | 'start' | 'talk' | 'business' | 'money' | 'boss' | 'jobChange' | 'realty' | 'creative' | 'science' | 'art' | 'study' | 'travel'
  | 'rest' | 'feast' | 'alcohol' | 'disputes' | 'love' | 'wedding' | 'conception' | 'sport' | 'home' | 'dreams' | 'hair' | 'garden';

export type AreaKey =
  | 'start' | 'business' | 'money' | 'boss' | 'jobChange' | 'realty'
  | 'study' | 'creative' | 'talk' | 'disputes'
  | 'travel' | 'rest' | 'feast'
  | 'wedding' | 'love' | 'conception'
  | 'sport' | 'hair' | 'home' | 'garden';

export interface AreaDef {
  key: AreaKey;
  icon: string;
  title: string;
  group: string;
  text: Record<Verdict, string>;
}

export const AREA_GROUPS = ['Дела и деньги', 'Ум и общение', 'Отдых и дорога', 'Любовь и семья', 'Тело, дом и сад'] as const;

export const AREAS: readonly AreaDef[] = [
  { key: 'start', icon: '🚀', title: 'Новые дела', group: 'Дела и деньги', text: { good: 'Хороший день, чтобы начать задуманное', neutral: 'Начинать можно, но без спешки и с запасом времени', bad: 'Новое лучше не начинать, займись текущим' } },
  { key: 'business', icon: '💼', title: 'Работа и бизнес', group: 'Дела и деньги', text: { good: 'Дела идут легко, хорошо для переговоров и планов', neutral: 'Обычный рабочий день, без больших решений', bad: 'Важные решения и сделки лучше отложить' } },
  { key: 'money', icon: '💰', title: 'Деньги и покупки', group: 'Дела и деньги', text: { good: 'Удачно для покупок, оплат и денежных дел', neutral: 'Покупай только то, что запланировал', bad: 'Крупные траты, займы и вложения лучше отложить' } },
  { key: 'boss', icon: '📄', title: 'Начальство и документы', group: 'Дела и деньги', text: { good: 'Хорошо идти с просьбой, подавать документы, решать с налогами', neutral: 'Документы можно, просьбы к начальству лучше в другой день', bad: 'С начальством и госорганами сегодня лучше не связываться' } },
  { key: 'jobChange', icon: '🔄', title: 'Смена работы', group: 'Дела и деньги', text: { good: 'Удачно искать работу, ходить на собеседования', neutral: 'Можно присматриваться, но не решать окончательно', bad: 'Увольняться и менять работу сегодня не стоит' } },
  { key: 'realty', icon: '🏠', title: 'Недвижимость и переезд', group: 'Дела и деньги', text: { good: 'Хорошо смотреть, покупать, продавать, переезжать', neutral: 'Смотреть варианты можно, подписывать лучше позже', bad: 'Сделки с жильём и переезд лучше перенести' } },
  { key: 'study', icon: '📚', title: 'Учёба и экзамены', group: 'Ум и общение', text: { good: 'Голова ясная: учёба и экзамены даются легко', neutral: 'Учиться можно, но без перегрузки', bad: 'Экзамены и сложная учёба сегодня тяжелее обычного' } },
  { key: 'creative', icon: '🎨', title: 'Творчество', group: 'Ум и общение', text: { good: 'Вдохновение рядом: твори, придумывай, пиши', neutral: 'Хорошо продолжать начатое', bad: 'Вдохновения мало, лучше подготовка и рутина' } },
  { key: 'talk', icon: '💬', title: 'Общение', group: 'Ум и общение', text: { good: 'Хорошо встречаться, знакомиться, договариваться', neutral: 'Общение ровное, без долгих разговоров', bad: 'Лучше побыть в тишине, люди сегодня утомляют' } },
  { key: 'disputes', icon: '⚖️', title: 'Выяснять отношения', group: 'Ум и общение', text: { good: 'Можно спокойно обсудить трудный вопрос', neutral: 'Трудный разговор возможен, если без упрёков', bad: 'Споры и разборки сегодня только навредят' } },
  { key: 'travel', icon: '✈️', title: 'Поездки', group: 'Отдых и дорога', text: { good: 'Удачный день для дороги и поездок', neutral: 'Короткие поездки нормально, дальние лучше спланировать на другой день', bad: 'В дальнюю дорогу лучше не отправляться' } },
  { key: 'rest', icon: '🌿', title: 'Отдых', group: 'Отдых и дорога', text: { good: 'Отдых восстанавливает: природа, баня, хобби', neutral: 'Отдыхай спокойно, без больших планов', bad: 'Отдых не приносит радости, лучше заняться делом' } },
  { key: 'feast', icon: '🍽', title: 'Застолье и еда', group: 'Отдых и дорога', text: { good: 'Хорошо собрать гостей за столом', neutral: 'Ешь просто, без излишеств', bad: 'Тяжёлая еда и застолья сегодня во вред, хорошо для лёгкой еды и поста' } },
  { key: 'wedding', icon: '💍', title: 'Свадьба и помолвка', group: 'Любовь и семья', text: { good: 'Благоприятный день для свадьбы и помолвки', neutral: 'Подойдёт, если оба уверены друг в друге', bad: 'Свадьбу лучше назначить на другой день' } },
  { key: 'love', icon: '❤️', title: 'Любовь и близость', group: 'Любовь и семья', text: { good: 'Тепло и близость сегодня особенно в радость', neutral: 'Обычный день для отношений, главное — бережность', bad: 'Лучше нежность и забота, чем страсть' } },
  { key: 'conception', icon: '👶', title: 'Зачатие', group: 'Любовь и семья', text: { good: 'По традиции удачный день для зачатия', neutral: 'По традиции нейтральный день', bad: 'По традиции зачатие лучше отложить' } },
  { key: 'sport', icon: '🏃', title: 'Спорт и нагрузки', group: 'Тело, дом и сад', text: { good: 'Сил много: тренировки и физическая работа в радость', neutral: 'Умеренная нагрузка, без рекордов', bad: 'Сил мало: лучше прогулка и растяжка' } },
  { key: 'hair', icon: '✂️', title: 'Стрижка и окраска', group: 'Тело, дом и сад', text: { good: 'Удачный день для стрижки, окраски и ухода', neutral: 'Подровнять можно, большие перемены лучше в другой день', bad: 'Стричься и краситься сегодня не стоит' } },
  { key: 'home', icon: '🧹', title: 'Уборка и ремонт', group: 'Тело, дом и сад', text: { good: 'Хорошо убираться, чинить, затевать ремонт', neutral: 'Обычные домашние дела', bad: 'Ремонт и большую уборку лучше перенести' } },
  { key: 'garden', icon: '🌱', title: 'Сад и огород', group: 'Тело, дом и сад', text: { good: 'Хорошо для работы с растениями и землёй', neutral: 'Обычный уход: полив, рыхление', bad: 'Растения лучше не трогать, только полив' } },
];

/** Сны: оценка источника по шкале 5…1. */
export const DREAMS_TEXT: Record<Verdict, string> = {
  good: 'Сны этой ночи по традиции значимые: запомни и запиши их',
  neutral: 'Обычные сны, особого значения не имеют',
  bad: 'Сны могут быть тревожными или пустыми, не принимай их близко к сердцу',
};

interface AreasData {
  columns: Col[];
  days: Record<string, Record<Col, number>>;
  adjustments: { day: number; area: Col; to: number; reason: string }[];
}
const D = data as AreasData;

/** Оценка 1…5 на лунный день с учётом поправок по тексту источника. */
export function rawScore(day: number, col: Col): number {
  const n = day > 30 ? 30 : day;
  const adj = D.adjustments.find((a) => a.day === n && a.area === col);
  return adj ? adj.to : D.days[String(n)]![col];
}

export const verdictOf = (score: number): Verdict => (score >= 4 ? 'good' : score === 3 ? 'neutral' : 'bad');

function score(day: number, key: AreaKey): number {
  if (key === 'creative') return Math.round((rawScore(day, 'creative') + rawScore(day, 'art')) / 2);
  return rawScore(day, key);
}

export interface AreaVerdict {
  key: AreaKey;
  icon: string;
  title: string;
  group: string;
  verdict: Verdict;
  text: string;
  /** Уточнение по фактам дня. */
  note: string | null;
}

const BUSINESS: AreaKey[] = ['start', 'business', 'money', 'boss', 'jobChange', 'realty', 'wedding'];
const ECLIPSE_SENSITIVE: AreaKey[] = ['start', 'business', 'jobChange', 'realty', 'wedding'];
const FERTILE: A.Sign[] = ['cancer', 'scorpio', 'pisces', 'taurus', 'libra', 'capricorn'];

export function dayAreas(day: DayModel): AreaVerdict[] {
  const n = day.dominant.number;
  const tz = day.location.timeZone;
  const voc = vocInDaylight(day);
  const vocSpan = voc.map((w) => spanText(w, tz)).join(', ');
  const mostlyVoc = day.vocDaylightShare > 0.5;
  return AREAS.map((a) => {
    let v = verdictOf(score(n, a.key));
    let note: string | null = null;
    if (BUSINESS.includes(a.key) && voc.length) {
      if (mostlyVoc && v === 'good') {
        v = 'neutral';
        note = `Большую часть дня Луна без курса (${vocSpan}): начатое может не сложиться.`;
      } else if (v !== 'bad') note = `Только не в ${vocSpan}: Луна без курса.`;
    }
    if (ECLIPSE_SENSITIVE.includes(a.key) && day.eclipses.length) {
      v = 'bad';
      note = 'Сегодня затмение: крупные шаги лучше отложить на пару недель.';
    } else if (ECLIPSE_SENSITIVE.includes(a.key) && day.corridor && a.key !== 'business' && v === 'good') {
      v = 'neutral';
      note = 'Коридор затмений: по традиции с крупными шагами лучше не спешить.';
    }
    if (a.key === 'feast' && rawScore(n, 'alcohol') <= 2 && v !== 'bad') note = 'Алкоголь сегодня лучше исключить.';
    if (a.key === 'garden' && v !== 'bad') {
      note = FERTILE.includes(day.dominantSign)
        ? `Луна ${A.inSign(day.dominantSign)}: подходит для посева и пересадки.`
        : `Луна ${A.inSign(day.dominantSign)}: лучше полоть, обрезать, собирать, а не сеять.`;
    }
    if (a.key === 'hair' && v !== 'bad') note = day.phase.waxing ? 'Луна растёт: волосы будут расти быстрее.' : 'Луна убывает: стрижка дольше сохранит форму.';
    return { key: a.key, icon: a.icon, title: a.title, group: a.group, verdict: v, text: a.text[v], note };
  });
}

export function dreamsVerdict(lunarDay: number): { verdict: Verdict; text: string } {
  const v = verdictOf(rawScore(lunarDay, 'dreams'));
  return { verdict: v, text: DREAMS_TEXT[v] };
}

export const AREAS_SOURCE = 'Оценки сфер — по таблицам лунных дней life-moon.pp.ru, сверенным с текстом источника (где текст строже, взята осторожная оценка), с поправкой на Луну без курса и затмения.';
