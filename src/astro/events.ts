/**
 * Особые события: затмения, коридор затмений, перигей/апогей, суперлуние.
 */
import {
  ApsisKind,
  EclipticGeoMoon,
  KM_PER_AU,
  NextGlobalSolarEclipse,
  NextLunarApsis,
  NextLunarEclipse,
  SearchGlobalSolarEclipse,
  SearchLunarApsis,
  SearchLunarEclipse,
} from 'astronomy-engine';
import { quartersBetween } from './phases';
import { MS_PER_DAY } from './time';

export type EclipseType = 'penumbral' | 'partial' | 'annular' | 'total';

export const ECLIPSE_TYPE_NAMES: Record<EclipseType, string> = {
  penumbral: 'полутеневое',
  partial: 'частное',
  annular: 'кольцеобразное',
  total: 'полное',
};

export interface Eclipse {
  body: 'sun' | 'moon';
  type: EclipseType;
  /** Момент максимума (для солнечного — наибольшей фазы на Земле). */
  peak: Date;
  /** Лунное: доля закрытия диска в максимуме (только для полного/частного полезна). */
  obscuration?: number;
}

/** Все затмения (солнечные и лунные) с максимумом в окне [start, end). */
export function eclipsesBetween(start: Date, end: Date): Eclipse[] {
  const out: Eclipse[] = [];
  let lunar = SearchLunarEclipse(start);
  while (lunar.peak.date < end) {
    out.push({ body: 'moon', type: lunar.kind as EclipseType, peak: lunar.peak.date, obscuration: lunar.obscuration });
    lunar = NextLunarEclipse(lunar.peak);
  }
  let solar = SearchGlobalSolarEclipse(start);
  while (solar.peak.date < end) {
    out.push({ body: 'sun', type: solar.kind as EclipseType, peak: solar.peak.date, obscuration: solar.obscuration });
    solar = NextGlobalSolarEclipse(solar.peak);
  }
  return out.sort((a, b) => a.peak.getTime() - b.peak.getTime());
}

/**
 * «Коридор затмений» ±7 суток вокруг максимума.
 * Это интерпретационная традиция, а не астрономическое понятие: в UI помечается как традиция.
 */
export const ECLIPSE_CORRIDOR_DAYS = 7;

export interface EclipseCorridor {
  eclipse: Eclipse;
  start: Date;
  end: Date;
  /** Пометка для интерфейса: источник — традиция. */
  layer: 'tradition';
}

export function eclipseCorridorsBetween(start: Date, end: Date): EclipseCorridor[] {
  const pad = ECLIPSE_CORRIDOR_DAYS * MS_PER_DAY;
  return eclipsesBetween(new Date(start.getTime() - pad), new Date(end.getTime() + pad))
    .map((eclipse) => ({
      eclipse,
      start: new Date(eclipse.peak.getTime() - pad),
      end: new Date(eclipse.peak.getTime() + pad),
      layer: 'tradition' as const,
    }))
    .filter((c) => c.end > start && c.start < end);
}

export type ApsisType = 'perigee' | 'apogee';

export interface LunarApsis {
  type: ApsisType;
  time: Date;
  distanceKm: number;
}

/** Перигеи и апогеи Луны в окне [start, end). */
export function apsidesBetween(start: Date, end: Date): LunarApsis[] {
  const out: LunarApsis[] = [];
  let a = SearchLunarApsis(start);
  while (a.time.date < end) {
    out.push({
      type: a.kind === ApsisKind.Pericenter ? 'perigee' : 'apogee',
      time: a.time.date,
      distanceKm: a.dist_km,
    });
    a = NextLunarApsis(a);
  }
  return out;
}

/** Геоцентрическое расстояние до Луны, км. */
export function moonDistanceKm(date: Date): number {
  return EclipticGeoMoon(date).dist * KM_PER_AU;
}

/**
 * Суперлуние (определение Р. Нолле, 1979): новолуние или полнолуние, когда
 * Луна находится в пределах 90% своего наибольшего сближения с Землёй
 * на текущей орбите.
 *
 * Формула: d ≤ p + 0,1 · (a − p),
 *   d — расстояние в момент сизигии,
 *   p — расстояние в ближайшем перигее, a — в ближайшем апогее.
 * Эквивалентно «близость» = (a − d) / (a − p) ≥ 0,9.
 */
export interface Syzygy {
  type: 'new' | 'full';
  time: Date;
  distanceKm: number;
  /** (a − d)/(a − p): 1 — точно в перигее, 0 — точно в апогее. */
  closeness: number;
  supermoon: boolean;
  /** Микролуние — симметрично, в пределах 10% от апогея (closeness ≤ 0,1). */
  micromoon: boolean;
}

export const SUPERMOON_THRESHOLD = 0.9;

export function syzygiesBetween(start: Date, end: Date): Syzygy[] {
  const pad = 20 * MS_PER_DAY;
  const apsides = apsidesBetween(new Date(start.getTime() - pad), new Date(end.getTime() + pad));
  const nearest = (t: Date, type: ApsisType): LunarApsis => {
    let best: LunarApsis | null = null;
    for (const a of apsides) {
      if (a.type !== type) continue;
      if (!best || Math.abs(a.time.getTime() - t.getTime()) < Math.abs(best.time.getTime() - t.getTime())) best = a;
    }
    if (!best) throw new Error('Апсида не найдена');
    return best;
  };
  return quartersBetween(start, end)
    .filter((q) => q.quarter === 0 || q.quarter === 2)
    .map((q) => {
      const d = moonDistanceKm(q.time);
      const p = nearest(q.time, 'perigee').distanceKm;
      const a = nearest(q.time, 'apogee').distanceKm;
      const closeness = (a - d) / (a - p);
      return {
        type: q.quarter === 0 ? ('new' as const) : ('full' as const),
        time: q.time,
        distanceKm: d,
        closeness,
        supermoon: closeness >= SUPERMOON_THRESHOLD,
        micromoon: closeness <= 1 - SUPERMOON_THRESHOLD,
      };
    });
}
