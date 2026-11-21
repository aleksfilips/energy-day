/**
 * Загрузка контента слоя Б и наложение правок пользователя (overrides).
 * Правки хранятся в IndexedDB поверх базы и никогда не меняют исходные JSON.
 */
import lunarDays from './data/lunar-days.json';
import phases from './data/phases.json';
import signs from './data/signs.json';
import special from './data/special.json';
import tithis from './data/tithis.json';
import nakshatras from './data/nakshatras.json';
import personalNumbers from './data/personal-numbers.json';
import garden from './data/garden.json';
import {
  COLLECTIONS,
  type CollectionName,
  type GardenEntry,
  type LunarDayEntry,
  type NakshatraEntry,
  type PersonalNumberEntry,
  type PhaseEntry,
  type SignEntry,
  type SpecialEntry,
  type TithiEntry,
} from './schema';

export interface ContentBase {
  'lunar-days': LunarDayEntry[];
  phases: PhaseEntry[];
  signs: SignEntry[];
  special: SpecialEntry[];
  tithis: TithiEntry[];
  nakshatras: NakshatraEntry[];
  'personal-numbers': PersonalNumberEntry[];
  garden: GardenEntry[];
}

export const BASE: ContentBase = {
  'lunar-days': lunarDays as LunarDayEntry[],
  phases: phases as PhaseEntry[],
  signs: signs as SignEntry[],
  special: special as SpecialEntry[],
  tithis: tithis as TithiEntry[],
  nakshatras: nakshatras as NakshatraEntry[],
  'personal-numbers': personalNumbers as PersonalNumberEntry[],
  garden: garden as GardenEntry[],
};

/** Правка пользователя: частичная запись поверх базовой. */
export interface ContentOverride {
  key: string; // `${collection}:${id}`
  collection: CollectionName;
  id: string;
  patch: Record<string, unknown>;
  updatedAt: number;
}

export function entryId<C extends CollectionName>(collection: C, entry: ContentBase[C][number]): string {
  return (COLLECTIONS[collection].id as (e: unknown) => string)(entry);
}

/** База + правки. Невалидная после правки запись откатывается к базе. */
export function applyOverrides(overrides: ContentOverride[], base: ContentBase = BASE): ContentBase {
  const out = { ...base } as Record<CollectionName, unknown[]>;
  for (const name of Object.keys(COLLECTIONS) as CollectionName[]) {
    const mine = overrides.filter((o) => o.collection === name);
    if (!mine.length) continue;
    const schema = COLLECTIONS[name].schema;
    out[name] = (base[name] as unknown[]).map((entry) => {
      const id = entryId(name, entry as never);
      const o = mine.find((x) => x.id === id);
      if (!o) return entry;
      const merged = { ...(entry as object), ...o.patch };
      return schema.safeParse(merged).success ? merged : entry;
    });
  }
  return out as unknown as ContentBase;
}

export interface Content {
  lunarDay(n: number): LunarDayEntry;
  phase(key: PhaseEntry['key']): PhaseEntry;
  sign(key: SignEntry['sign']): SignEntry;
  special(key: SpecialEntry['key']): SpecialEntry;
  tithi(n: number): TithiEntry;
  nakshatra(n: number): NakshatraEntry;
  personal(n: number): PersonalNumberEntry;
  garden(key: GardenEntry['key']): GardenEntry;
  all: ContentBase;
}

export function makeContent(c: ContentBase = BASE): Content {
  const need = <T>(x: T | undefined, what: string): T => {
    if (x === undefined) throw new Error(`Нет записи контента: ${what}`);
    return x;
  };
  return {
    all: c,
    // 31-е и далее (высокие широты) показываем как 30-е.
    lunarDay: (n) => need(c['lunar-days'].find((e) => e.day === Math.min(30, n)), `сутки ${n}`),
    phase: (k) => need(c.phases.find((e) => e.key === k), `фаза ${k}`),
    sign: (k) => need(c.signs.find((e) => e.sign === k), `знак ${k}`),
    special: (k) => need(c.special.find((e) => e.key === k), `событие ${k}`),
    tithi: (n) => need(c.tithis.find((e) => e.number === n), `титхи ${n}`),
    nakshatra: (n) => need(c.nakshatras.find((e) => e.number === n), `накшатра ${n}`),
    personal: (n) => need(c['personal-numbers'].find((e) => e.number === n), `число ${n}`),
    garden: (k) => need(c.garden.find((e) => e.key === k), `сад ${k}`),
  };
}

export { COLLECTIONS };
export type { CollectionName };
