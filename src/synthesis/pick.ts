/**
 * «Подобрать день» (D-138): лучшие дни на ближайшие недели для выбранного дела.
 * Основа — те же оценки 20 сфер, что на «Сегодня» (D-113, с поправками на Луну без курса и затмения),
 * плюс бережные уточнения для выбора между хорошими днями:
 *  — для начинаний (новые дела, деньги, работа, сделки, свадьба) растущая Луна лучше убывающей;
 *  — чем меньше Луны без курса в светлое время, тем лучше;
 *  — день с удачным окном для важного лучше дня без него.
 */
import * as A from '../astro';
import { DEFAULT_NUMEROLOGY } from '../personal/numerology';
import { AREAS, dayAreas, type AreaKey, type Verdict } from './areas';
import { computeDay, type DayOptions } from './day';
import { goodWindows, vocInDaylight } from './life';

export interface PickSpan {
  from: number;
  to: number;
}

export interface PickDay {
  date: A.DateKey;
  lunarDay: number;
  waxing: boolean;
  verdicts: Record<AreaKey, Verdict>;
  good: PickSpan[];
  voc: PickSpan[];
  /** Доля светлого времени под Луной без курса, 0…1. */
  vocShare: number;
  /** Характер лунного дня (активная, переходная, созерцательная, бережная). */
  tone: string;
  /** Новолуние, полнолуние, четверть или затмение в этот день — угол фазы для значка. */
  moon: { angle: number; label: string } | null;
}

const QUARTER = ['новолуние', 'первая четверть', 'полнолуние', 'последняя четверть'] as const;
const span = (w: { from: Date; to: Date }): PickSpan => ({ from: w.from.getTime(), to: w.to.getTime() });

export function pickDays(
  loc: A.ResolvedLocation,
  from: A.DateKey,
  days: number,
  opts: Pick<DayOptions, 'daylight' | 'zodiac' | 'vocMode'>,
  toneOf: (lunarDay: number) => string = () => '',
): PickDay[] {
  const out: PickDay[] = [];
  let key = from;
  for (let i = 0; i < days; i++) {
    const day = computeDay(loc, key, { ...opts, vedic: false, garden: false, birthday: null, numerology: DEFAULT_NUMEROLOGY });
    const verdicts = Object.fromEntries(dayAreas(day).map((a) => [a.key, a.verdict])) as Record<AreaKey, Verdict>;
    const voc = vocInDaylight(day);
    const tz = loc.timeZone;
    const [y, m, d] = key.split('-').map(Number) as [number, number, number];
    const light = (A.zonedTimeToUtc(y, m, d, Math.min(opts.daylight.to, 24), 0, tz).getTime() - A.zonedTimeToUtc(y, m, d, opts.daylight.from, 0, tz).getTime()) || 1;
    const vocMs = voc.reduce((s, w) => s + (w.to.getTime() - w.from.getTime()), 0);
    const q = day.quarters[0];
    const moon = day.eclipses.length ? { angle: day.phase.angle, label: 'затмение' } : q ? { angle: day.phase.angle, label: QUARTER[q.quarter] } : null;
    out.push({ date: key, lunarDay: day.dominant.number, waxing: day.phase.waxing, verdicts, good: goodWindows(day).map(span), voc: voc.map(span), vocShare: Math.min(1, vocMs / light), tone: toneOf(day.dominant.number), moon });
    key = A.addDays(key, 1);
  }
  return out;
}

/** Дела-начинания: для них растущая Луна по традиции лучше. */
export const STARTS: ReadonlySet<AreaKey> = new Set(['start', 'business', 'money', 'boss', 'jobChange', 'realty', 'wedding', 'study']);

export interface Ranked {
  day: PickDay;
  verdict: Verdict;
  score: number;
  /** Почему день хорош — короткие пояснения. */
  why: string[];
}

const BASE: Record<Verdict, number> = { good: 100, neutral: 40, bad: 0 };

export function rankDays(days: PickDay[], area: AreaKey): Ranked[] {
  return days.map((day) => {
    const verdict = day.verdicts[area];
    let score = BASE[verdict];
    const why: string[] = [];
    if (verdict === 'good') why.push(`${day.lunarDay}-й лунный день хорош для этого`);
    if (STARTS.has(area)) {
      if (day.waxing) {
        score += 12;
        if (verdict !== 'bad') why.push('Луна растёт — хорошо для начала');
      } else score -= 4;
    }
    score -= Math.round(day.vocShare * 30);
    if (day.vocShare === 0 && verdict !== 'bad') why.push('весь день без Луны без курса');
    if (!day.good.length) score -= 15;
    return { day, verdict, score, why };
  });
}

/** Лучшие дни: сначала «хорошо», внутри — по баллам, при равенстве — раньше. */
export function bestDays(days: PickDay[], area: AreaKey, n = 3): Ranked[] {
  return rankDays(days, area)
    .filter((r) => r.verdict !== 'bad')
    .sort((a, b) => b.score - a.score || a.day.date.localeCompare(b.day.date))
    .slice(0, n);
}

export const AREA_BY_KEY = Object.fromEntries(AREAS.map((a) => [a.key, a])) as Record<AreaKey, (typeof AREAS)[number]>;
