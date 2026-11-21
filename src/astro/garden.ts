/**
 * Садовый слой по Марии Тун (выключен по умолчанию).
 *
 * У Тун — реальные астрономические созвездия неравного размера, а не знаки.
 * Здесь это реализовано через Constellation() из astronomy-engine (границы IAU 1930),
 * поэтому результат — ПРИБЛИЖЕНИЕ: у Тун свои границы созвездий.
 *
 * Если Луна стоит в незодиакальном созвездии (Змееносец, Орион, Кит, Секстант…),
 * берём зодиакальное созвездие той же эклиптической долготы, а участок эклиптики
 * в Змееносце делим пополам между Скорпионом и Стрельцом. См. DECISIONS.md.
 */
import {
  Body,
  Constellation,
  EquatorFromVector,
  GeoVector,
  MakeTime,
  RotateVector,
  Rotation_ECL_EQJ,
  Rotation_EQJ_ECL,
  SphereFromVector,
  Spherical,
  VectorFromSphere,
} from 'astronomy-engine';
import { bisectChange } from './search';
import { MS_PER_HOUR } from './time';

export type ZodiacConstellation =
  | 'Ari'
  | 'Tau'
  | 'Gem'
  | 'Cnc'
  | 'Leo'
  | 'Vir'
  | 'Lib'
  | 'Sco'
  | 'Sgr'
  | 'Cap'
  | 'Aqr'
  | 'Psc';

export type GardenDay = 'root' | 'leaf' | 'flower' | 'fruit';

export const GARDEN_DAY_NAMES: Record<GardenDay, string> = {
  root: 'день корня',
  leaf: 'день листа',
  flower: 'день цветка',
  fruit: 'день плода',
};

export const CONSTELLATION_GARDEN: Record<ZodiacConstellation, GardenDay> = {
  Tau: 'root',
  Vir: 'root',
  Cap: 'root',
  Cnc: 'leaf',
  Sco: 'leaf',
  Psc: 'leaf',
  Gem: 'flower',
  Lib: 'flower',
  Aqr: 'flower',
  Ari: 'fruit',
  Leo: 'fruit',
  Sgr: 'fruit',
};

export const CONSTELLATION_NAMES: Record<ZodiacConstellation, string> = {
  Ari: 'Овен',
  Tau: 'Телец',
  Gem: 'Близнецы',
  Cnc: 'Рак',
  Leo: 'Лев',
  Vir: 'Дева',
  Lib: 'Весы',
  Sco: 'Скорпион',
  Sgr: 'Стрелец',
  Cap: 'Козерог',
  Aqr: 'Водолей',
  Psc: 'Рыбы',
};

const ZODIAC = new Set<string>(Object.keys(CONSTELLATION_GARDEN));

function isZodiac(symbol: string): symbol is ZodiacConstellation {
  return ZODIAC.has(symbol);
}

/** Таблица «долгота на эклиптике J2000 → зодиакальное созвездие», шаг 0,05°. */
const STEP = 0.05;
let eclipticTable: ZodiacConstellation[] | null = null;

function buildEclipticTable(): ZodiacConstellation[] {
  const t = MakeTime(new Date(Date.UTC(2000, 0, 1, 12)));
  const rot = Rotation_ECL_EQJ();
  const n = Math.round(360 / STEP);
  const raw: (ZodiacConstellation | null)[] = [];
  for (let i = 0; i < n; i++) {
    const ecl = VectorFromSphere(new Spherical(0, i * STEP, 1), t);
    const eq = EquatorFromVector(RotateVector(rot, ecl));
    const sym = Constellation(eq.ra, eq.dec).symbol;
    raw.push(isZodiac(sym) ? sym : null);
  }
  // Незодиакальные участки (Змееносец) — к ближайшему зодиакальному соседу по долготе.
  const out: ZodiacConstellation[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const v = raw[i];
    if (v) {
      out[i] = v;
      continue;
    }
    for (let k = 1; k < n; k++) {
      const back = raw[(i - k + n) % n];
      const fwd = raw[(i + k) % n];
      // При равном расстоянии — предыдущее созвездие, чтобы деление было детерминированным.
      if (back) {
        out[i] = back;
        break;
      }
      if (fwd) {
        out[i] = fwd;
        break;
      }
    }
  }
  return out;
}

export interface GardenInfo {
  /** Созвездие IAU, где реально стоит Луна (может быть незодиакальным). */
  actualConstellation: string;
  /** Зодиакальное созвездие, используемое для типа дня. */
  constellation: ZodiacConstellation;
  day: GardenDay;
  /** Всегда true: границы у Тун свои. */
  approximate: true;
}

export function gardenInfo(date: Date): GardenInfo {
  const vec = GeoVector(Body.Moon, date, true); // EQJ
  const eq = EquatorFromVector(vec);
  const actual = Constellation(eq.ra, eq.dec).symbol;
  let constellation: ZodiacConstellation;
  if (isZodiac(actual)) {
    constellation = actual;
  } else {
    eclipticTable ??= buildEclipticTable();
    const lon = SphereFromVector(RotateVector(Rotation_EQJ_ECL(), vec)).lon;
    const idx = Math.floor((((lon % 360) + 360) % 360) / STEP) % eclipticTable.length;
    constellation = eclipticTable[idx]!;
  }
  return { actualConstellation: actual, constellation, day: CONSTELLATION_GARDEN[constellation], approximate: true };
}

export interface GardenTransition {
  time: Date;
  day: GardenDay;
  constellation: ZodiacConstellation;
}

/** Смены типа дня (корень/лист/цветок/плод) в окне [start, end), точность ~1 с. */
export function gardenChangesBetween(start: Date, end: Date): GardenTransition[] {
  const step = 2 * MS_PER_HOUR;
  const out: GardenTransition[] = [];
  const key = (d: Date) => gardenInfo(d).constellation;
  let a = new Date(Math.floor(start.getTime() / step) * step);
  let ka = key(a);
  while (a < end) {
    const b = new Date(a.getTime() + step);
    const kb = key(b);
    if (kb !== ka) {
      const t = bisectChange(key, a, b);
      if (t >= start && t < end) {
        const info = gardenInfo(t);
        out.push({ time: t, day: info.day, constellation: info.constellation });
      }
    }
    a = b;
    ka = kb;
  }
  return out;
}
