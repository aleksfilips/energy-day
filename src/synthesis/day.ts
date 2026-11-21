/**
 * Все астрономические факты одного календарного дня в выбранной локации (слой А).
 * Чистая функция: на вход локация, дата, настройки, на выход — модель дня.
 */
import * as A from '../astro';
import { personalNumbers, type Birthday, type NumerologyOptions, type PersonalNumbers } from '../personal/numerology';

export interface DayOptions {
  /** Светлое окно, часы местного времени [from, to). По умолчанию 7–23. */
  daylight: { from: number; to: number };
  vocMode: A.VocMode;
  zodiac: A.ZodiacMode;
  vedic: boolean;
  garden: boolean;
  birthday: Birthday | null;
  numerology: NumerologyOptions;
}

export interface DayModel {
  date: A.DateKey;
  location: A.ResolvedLocation;
  bounds: A.DayBounds;
  window: { from: Date; to: Date };
  /** Опорный момент дня — середина светлого окна. */
  ref: Date;
  lunarDays: A.LunarDaySegment[];
  dominant: A.LunarDay;
  cycleLength: number;
  phase: A.PhaseInfo;
  quarters: A.QuarterEvent[];
  sign: A.MoonSignInfo;
  ingresses: A.Ingress[];
  /** Знак, в котором Луна большую часть светлого окна. */
  dominantSign: A.Sign;
  voc: A.VocPeriod[];
  /** Доля светлого окна под Луной без курса, 0..1. */
  vocDaylightShare: number;
  riseSet: A.RiseSetEvent[];
  eclipses: A.Eclipse[];
  corridor: A.EclipseCorridor | null;
  apsides: A.LunarApsis[];
  syzygies: A.Syzygy[];
  tithi: A.TithiInfo | null;
  nakshatra: A.NakshatraInfo | null;
  garden: A.GardenInfo | null;
  gardenChanges: A.GardenTransition[];
  personal: PersonalNumbers | null;
  latitudeWarning: boolean;
}

export const overlapMs = (a1: Date, a2: Date, b1: Date, b2: Date) =>
  Math.max(0, Math.min(a2.getTime(), b2.getTime()) - Math.max(a1.getTime(), b1.getTime()));

export function computeDay(location: A.ResolvedLocation, date: A.DateKey, opts: DayOptions): DayModel {
  const tz = location.timeZone;
  const bounds = A.dayBounds(date, tz);
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const from = A.zonedTimeToUtc(y, m, d, opts.daylight.from, 0, tz);
  const to =
    opts.daylight.to >= 24 ? bounds.end : A.zonedTimeToUtc(y, m, d, opts.daylight.to, 0, tz);
  const ref = new Date((from.getTime() + to.getTime()) / 2);

  const lunarDays = A.lunarDaysForDate(location, date);
  const dominant = A.dominantLunarDay(location, from, to);
  const ingresses = A.ingressesBetween(bounds.start, bounds.end, opts.zodiac);

  // Знак, преобладающий в светлом окне.
  let dominantSign = A.moonSign(from, opts.zodiac).sign;
  {
    const marks = [from, ...ingresses.map((i) => i.time).filter((t) => t > from && t < to), to];
    let best = -1;
    for (let i = 0; i + 1 < marks.length; i++) {
      const ms = marks[i + 1]!.getTime() - marks[i]!.getTime();
      if (ms > best) {
        best = ms;
        dominantSign = A.moonSign(new Date(marks[i]!.getTime() + 1000), opts.zodiac).sign;
      }
    }
  }

  const voc = A.vocPeriodsBetween(bounds.start, bounds.end, opts.vocMode);
  const vocMs = voc.reduce((s, p) => s + overlapMs(p.start, p.end, from, to), 0);
  const corridors = A.eclipseCorridorsBetween(bounds.start, bounds.end);

  return {
    date,
    location,
    bounds,
    window: { from, to },
    ref,
    lunarDays,
    dominant,
    cycleLength: dominant.totalInCycle,
    phase: A.phaseInfo(ref),
    quarters: A.quartersBetween(bounds.start, bounds.end),
    sign: A.moonSign(ref, opts.zodiac),
    ingresses,
    dominantSign,
    voc,
    vocDaylightShare: vocMs / (to.getTime() - from.getTime()),
    riseSet: A.moonRiseSetBetween(location, bounds.start, bounds.end),
    eclipses: A.eclipsesBetween(bounds.start, bounds.end),
    corridor: corridors[0] ?? null,
    apsides: A.apsidesBetween(bounds.start, bounds.end),
    syzygies: A.syzygiesBetween(bounds.start, bounds.end),
    tithi: opts.vedic ? A.tithi(ref) : null,
    nakshatra: opts.vedic ? A.nakshatra(ref) : null,
    garden: opts.garden ? A.gardenInfo(ref) : null,
    gardenChanges: opts.garden ? A.gardenChangesBetween(bounds.start, bounds.end) : [],
    personal: opts.birthday ? personalNumbers(opts.birthday, { year: y, month: m, day: d }, opts.numerology) : null,
    latitudeWarning: A.lunarDayLatitudeWarning(location),
  };
}

/** Облегчённая модель для сетки месяца: только то, что нужно ячейке. */
export interface DayBrief {
  date: A.DateKey;
  lunarDays: number[];
  dominant: number;
  /** Вторые сутки светлого окна, если они занимают больше 35% его. */
  secondary: number | null;
  dominantTone: string | null;
  phase: A.PhaseInfo;
  quarter: A.QuarterIndex | null;
  sign: A.Sign;
  /** Луна без курса больше 4 часов в светлое время. */
  hasVoc: boolean;
  eclipse: A.Eclipse | null;
  supermoon: boolean;
  attention: boolean;
}

/** Сетка месяца: все тяжёлые поиски делаются один раз на весь месяц. */
export function computeMonth(
  location: A.ResolvedLocation,
  year: number,
  month: number,
  opts: Pick<DayOptions, 'daylight' | 'zodiac' | 'vocMode'>,
  toneOf: (lunarDay: number) => { tone: string; attention: boolean } = () => ({ tone: '', attention: false }),
): DayBrief[] {
  const tz = location.timeZone;
  const keys = A.monthDateKeys(year, month);
  const start = A.dayBounds(keys[0]!, tz).start;
  const end = A.dayBounds(keys[keys.length - 1]!, tz).end;
  const quarters = A.quartersBetween(start, end);
  const voc = A.vocPeriodsBetween(start, end, opts.vocMode);
  const eclipses = A.eclipsesBetween(start, end);
  const syz = A.syzygiesBetween(start, end).filter((s) => s.supermoon);
  const lunar = A.lunarDaysBetween(location, start, end);
  return keys.map((date) => {
    const b = A.dayBounds(date, tz);
    const [y, m, d] = date.split('-').map(Number) as [number, number, number];
    const from = A.zonedTimeToUtc(y, m, d, opts.daylight.from, 0, tz);
    const to = opts.daylight.to >= 24 ? b.end : A.zonedTimeToUtc(y, m, d, opts.daylight.to, 0, tz);
    const ref = new Date((from.getTime() + to.getTime()) / 2);
    const inDay = (t: Date) => t >= b.start && t < b.end;
    const todays = lunar.filter((x) => x.end > b.start && x.start < b.end);
    let dom = todays[0]!;
    let best = -1;
    const winMs = to.getTime() - from.getTime();
    const shares = todays.map((x) => ({ x, ms: Math.min(x.end.getTime(), to.getTime()) - Math.max(x.start.getTime(), from.getTime()) }));
    for (const { x, ms } of shares) {
      if (ms > best) {
        best = ms;
        dom = x;
      }
    }
    const sec = shares.find((s) => s.x !== dom && s.ms > 0.35 * winMs)?.x ?? null;
    const q = quarters.find((x) => inDay(x.time));
    const meta = toneOf(dom.number);
    return {
      date,
      lunarDays: todays.map((x) => x.number),
      dominant: dom.number,
      secondary: sec ? sec.number : null,
      dominantTone: meta.tone || null,
      phase: A.phaseInfo(ref),
      quarter: q ? q.quarter : null,
      sign: A.moonSign(ref, opts.zodiac).sign,
      hasVoc: voc.some((p) => overlapMs(p.start, p.end, from, to) > 4 * 3_600_000),
      eclipse: eclipses.find((e) => inDay(e.peak)) ?? null,
      supermoon: syz.some((s) => inDay(s.time)),
      attention: meta.attention,
    };
  });
}

export interface UpcomingEvent {
  kind: 'new' | 'first_quarter' | 'full' | 'last_quarter' | 'eclipse' | 'voc' | 'supermoon' | 'perigee' | 'apogee';
  time: Date;
  end?: Date;
  title: string;
  detail: string;
}

/** «Ближайшее»: следующие фазы, затмения, суперлуния, длинные периоды Луны без курса. */
export function computeUpcoming(from: Date, days: number, vocMode: A.VocMode, minVocHours = 12): UpcomingEvent[] {
  const to = new Date(from.getTime() + days * A.MS_PER_DAY);
  const out: UpcomingEvent[] = [];
  const qk = ['new', 'first_quarter', 'full', 'last_quarter'] as const;
  for (const q of A.quartersBetween(from, to)) out.push({ kind: qk[q.quarter], time: q.time, title: A.QUARTER_NAMES[q.quarter], detail: '' });
  for (const e of A.eclipsesBetween(from, new Date(from.getTime() + 400 * A.MS_PER_DAY)).slice(0, 4)) {
    out.push({ kind: 'eclipse', time: e.peak, title: `${e.body === 'sun' ? 'Солнечное' : 'Лунное'} затмение`, detail: A.ECLIPSE_TYPE_NAMES[e.type] });
  }
  for (const s of A.syzygiesBetween(from, new Date(from.getTime() + 200 * A.MS_PER_DAY))) {
    if (s.supermoon) out.push({ kind: 'supermoon', time: s.time, title: s.type === 'full' ? 'Суперлуние (полнолуние)' : 'Суперлуние (новолуние)', detail: `${Math.round(s.distanceKm).toLocaleString('ru-RU')} км` });
  }
  for (const p of A.vocPeriodsBetween(from, to, vocMode)) {
    const h = A.vocHours(p);
    if (h >= minVocHours && p.end > from) out.push({ kind: 'voc', time: p.start, end: p.end, title: 'Долгая Луна без курса', detail: `${Math.round(h)} ч, до входа в ${A.SIGN_NAMES[p.nextSign]}` });
  }
  return out.sort((a, b) => a.time.getTime() - b.time.getTime());
}
