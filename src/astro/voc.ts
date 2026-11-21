/**
 * Луна без курса (Void of Course).
 *
 * Основное (современное) определение: период от последнего точного мажорного
 * аспекта Луны (0°, 60°, 90°, 120°, 180°) к Солнцу…Плутону, пока Луна в текущем
 * знаке, до входа Луны в следующий знак.
 * Классический режим — только Солнце…Сатурн.
 * Определения Лилли (орбы) и эллинистическое (окно 30°) не реализованы, только справка.
 */
import { CLASSICAL_PLANETS, MODERN_PLANETS, type Planet } from './bodies';
import { moonAspectsBetween, type AspectEvent } from './aspects';
import { ingressesBetween, type Sign } from './zodiac';
import { MS_PER_DAY } from './time';

export type VocMode = 'modern' | 'classical';

export function vocPlanets(mode: VocMode): readonly Planet[] {
  return mode === 'modern' ? MODERN_PLANETS : CLASSICAL_PLANETS;
}

export interface VocPeriod {
  start: Date;
  end: Date;
  /** Знак, в котором Луна без курса. */
  sign: Sign;
  /** Знак, в который Луна войдёт в конце периода. */
  nextSign: Sign;
  /** Аспект, после которого начался период; null — в этом знаке аспектов не было вовсе. */
  lastAspect: AspectEvent | null;
}

/**
 * Все периоды Луны без курса, пересекающиеся с окном [start, end).
 * VOC всегда считается в тропическом зодиаке (западная школа).
 */
export function vocPeriodsBetween(start: Date, end: Date, mode: VocMode = 'modern'): VocPeriod[] {
  const planets = vocPlanets(mode);
  const pad = 3.5 * MS_PER_DAY;
  const ingresses = ingressesBetween(new Date(start.getTime() - pad), new Date(end.getTime() + pad), 'tropical');
  const out: VocPeriod[] = [];
  for (let i = 0; i + 1 < ingresses.length; i++) {
    const enter = ingresses[i]!;
    const leave = ingresses[i + 1]!;
    if (leave.time <= start || enter.time >= end) continue;
    const aspects = moonAspectsBetween(planets, enter.time, leave.time);
    const last = aspects[aspects.length - 1] ?? null;
    const vocStart = last ? last.time : enter.time;
    if (leave.time > start && vocStart < end) {
      out.push({ start: vocStart, end: leave.time, sign: enter.sign, nextSign: leave.sign, lastAspect: last });
    }
  }
  return out;
}

/** Период VOC, действующий в момент t, или null. */
export function vocAt(t: Date, mode: VocMode = 'modern'): VocPeriod | null {
  const list = vocPeriodsBetween(t, new Date(t.getTime() + 1000), mode);
  return list.find((p) => p.start <= t && t < p.end) ?? null;
}

/** Длительность периода в часах. */
export function vocHours(p: VocPeriod): number {
  return (p.end.getTime() - p.start.getTime()) / 3_600_000;
}
