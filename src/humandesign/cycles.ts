/**
 * Циклы жизни (D-148): возвращения Сатурна, оппозиция и возвращение Урана, возвращение Хирона.
 * Точка цикла — положение планеты в момент рождения (Личность); для оппозиции Урана — точка напротив.
 * Точные даты — моменты прохождения точки (с ретро-петлями их бывает до трёх),
 * период — пока планета ближе ORB градусов к точке.
 * Хирона нет в astronomy-engine: его долготы — таблица из Swiss Ephemeris (seas_18.se1),
 * шаг 10 дней, 1900–2200, точность интерполяции лучше 0,01°.
 */
import { norm180, norm360 } from '../astro/search';
import { hdLongitude } from './positions';
import chironData from './data/chiron.json';

export const ORB = 2;
const DAY = 86400000;
const YEAR = 365.25 * DAY;

let chironTable: Uint16Array | null = null;
const C0 = Date.parse(chironData.start);
const STEP = chironData.stepDays * DAY;
function table(): Uint16Array {
  if (chironTable) return chironTable;
  const bin = atob(chironData.data);
  const u = new Uint16Array(bin.length / 2);
  for (let i = 0; i < u.length; i++) u[i] = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
  return (chironTable = u);
}

/** Геоцентрическая тропическая долгота Хирона (кубическая интерполяция Катмулла — Рома). */
export function chironLongitude(date: Date): number {
  const q = table();
  const x = (date.getTime() - C0) / STEP;
  const i = Math.floor(x);
  if (i < 1 || i + 2 >= q.length) throw new Error('Хирон: дата вне таблицы (1900–2200)');
  const t = x - i;
  const p = [q[i - 1]!, q[i]!, q[i + 1]!, q[i + 2]!].map((v) => v / 100);
  for (let k = 1; k < 4; k++) p[k] = p[k - 1]! + norm180(p[k]! - p[k - 1]!);
  const [a, b, c, d] = p as [number, number, number, number];
  return norm360(b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a))));
}

export type CyclePlanet = 'saturn' | 'uranus' | 'chiron';
const lonOf = (p: CyclePlanet, d: Date) => (p === 'chiron' ? chironLongitude(d) : hdLongitude(p, d));

export type CycleKey = 'saturn1' | 'uranusOpp' | 'chiron' | 'saturn2' | 'uranusReturn';
interface CycleDef {
  key: CycleKey;
  title: string;
  short: string;
  planet: CyclePlanet;
  offset: number;
  /** Окно поиска по возрасту, лет. */
  ages: [number, number];
}
export const CYCLE_DEFS: readonly CycleDef[] = [
  { key: 'saturn1', title: 'Возвращение Сатурна', short: 'Сатурн', planet: 'saturn', offset: 0, ages: [25, 33] },
  { key: 'uranusOpp', title: 'Оппозиция Урана', short: 'Уран ☍', planet: 'uranus', offset: 180, ages: [35, 47] },
  { key: 'chiron', title: 'Возвращение Хирона', short: 'Хирон', planet: 'chiron', offset: 0, ages: [45, 55] },
  { key: 'saturn2', title: 'Второе возвращение Сатурна', short: 'Сатурн II', planet: 'saturn', offset: 0, ages: [55, 63] },
  { key: 'uranusReturn', title: 'Возвращение Урана', short: 'Уран', planet: 'uranus', offset: 0, ages: [78, 88] },
];

export interface LifeCycle {
  key: CycleKey;
  title: string;
  short: string;
  planet: CyclePlanet;
  start: Date;
  end: Date;
  exact: Date[];
  ageExact: number;
}

function bisect(f: (t: number) => number, lo: number, hi: number): number {
  let flo = f(lo);
  while (hi - lo > 60000) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}

export function lifeCycles(birthUtc: Date): LifeCycle[] {
  const b = birthUtc.getTime();
  const out: LifeCycle[] = [];
  for (const def of CYCLE_DEFS) {
    const target = norm360(lonOf(def.planet, birthUtc) + def.offset);
    const f = (t: number) => norm180(lonOf(def.planet, new Date(t)) - target);
    const from = b + def.ages[0] * YEAR;
    const to = b + def.ages[1] * YEAR;
    const exact: number[] = [];
    // отрезки, когда планета в орбисе; берём только те, где она проходит саму точку
    const segs: [number, number][] = [];
    let segStart: number | null = null;
    const step = 2 * DAY;
    let prevT = from;
    let prev = f(from);
    if (Math.abs(prev) <= ORB) segStart = from;
    for (let t = from + step; t <= to; t += step) {
      const v = f(t);
      if (Math.sign(v) !== Math.sign(prev) && Math.abs(v - prev) < 90) exact.push(bisect(f, prevT, t));
      const inNow = Math.abs(v) <= ORB;
      const inPrev = Math.abs(prev) <= ORB;
      if (inNow && !inPrev) segStart = bisect((x) => Math.abs(f(x)) - ORB, prevT, t);
      if (!inNow && inPrev && segStart !== null) {
        segs.push([segStart, bisect((x) => Math.abs(f(x)) - ORB, prevT, t)]);
        segStart = null;
      }
      prevT = t;
      prev = v;
    }
    if (segStart !== null) segs.push([segStart, to]);
    const used = segs.filter(([s0, e0]) => exact.some((x) => x >= s0 && x <= e0));
    if (!exact.length || !used.length) continue;
    const start = used[0]![0];
    const end = used[used.length - 1]![1];
    out.push({
      key: def.key,
      title: def.title,
      short: def.short,
      planet: def.planet,
      start: new Date(start),
      end: new Date(end),
      exact: exact.map((t) => new Date(t)),
      ageExact: (exact[0]! - b) / YEAR,
    });
  }
  return out;
}

export type CycleState = { state: 'past'; progress: 1 } | { state: 'now'; progress: number } | { state: 'ahead'; progress: 0; years: number };
export function cycleState(c: LifeCycle, now: Date): CycleState {
  const t = now.getTime();
  if (t > c.end.getTime()) return { state: 'past', progress: 1 };
  if (t >= c.start.getTime()) return { state: 'now', progress: (t - c.start.getTime()) / (c.end.getTime() - c.start.getTime()) };
  return { state: 'ahead', progress: 0, years: (c.start.getTime() - t) / YEAR };
}

export const ageAt = (birthUtc: Date, now: Date) => (now.getTime() - birthUtc.getTime()) / YEAR;
