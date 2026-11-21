/**
 * «Мои закономерности»: средние оценки по слоям и какой слой лучше совпадает с оценками.
 * Мера совпадения — ω² (омега-квадрат) однофакторного дисперсионного анализа:
 * какая доля разброса оценок объясняется категорией слоя, с поправкой на число категорий
 * (иначе слой с 30 категориями всегда «выигрывал бы» случайно).
 */
import type { DiaryEntry } from './types';

export const MIN_ENTRIES = 30;
export const MIN_PER_CATEGORY = 5;

export type Metric = 'energy' | 'mood' | 'sleep' | 'overall';
export type LayerKey = 'lunarDay' | 'phase' | 'sign' | 'voc' | 'personalDay';

export const LAYER_NAMES: Record<LayerKey, string> = {
  lunarDay: 'Лунные сутки',
  phase: 'Фаза',
  sign: 'Знак Луны',
  voc: 'Луна без курса',
  personalDay: 'Личный день',
};

export interface CategoryStat {
  category: string;
  n: number;
  mean: number;
  reliable: boolean;
}

export interface LayerStat {
  layer: LayerKey;
  categories: CategoryStat[];
  /** ω², 0..1 (отрицательные значения обрезаются до 0). null — данных мало. */
  omega2: number | null;
  n: number;
}

export function metricValue(e: DiaryEntry, m: Metric): number | null {
  if (m === 'overall') {
    const xs = [e.energy, e.mood].filter((x): x is number => x !== null);
    return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
  }
  return e[m];
}

function categoryOf(e: DiaryEntry, layer: LayerKey): string | null {
  const s = e.snapshot;
  switch (layer) {
    case 'lunarDay':
      return String(s.lunarDay);
    case 'phase':
      return s.phase;
    case 'sign':
      return s.sign;
    case 'voc':
      return s.voc ? 'да' : 'нет';
    case 'personalDay':
      return s.personalDay === null ? null : String(s.personalDay);
  }
}

export function layerStats(entries: DiaryEntry[], layer: LayerKey, metric: Metric): LayerStat {
  const groups = new Map<string, number[]>();
  for (const e of entries) {
    const v = metricValue(e, metric);
    const c = categoryOf(e, layer);
    if (v === null || c === null) continue;
    (groups.get(c) ?? groups.set(c, []).get(c)!).push(v);
  }
  const all = [...groups.values()].flat();
  const n = all.length;
  const categories: CategoryStat[] = [...groups.entries()]
    .map(([category, xs]) => ({
      category,
      n: xs.length,
      mean: xs.reduce((s, x) => s + x, 0) / xs.length,
      reliable: xs.length >= MIN_PER_CATEGORY,
    }))
    .sort((a, b) => (isNaN(Number(a.category)) ? a.category.localeCompare(b.category) : Number(a.category) - Number(b.category)));

  let omega2: number | null = null;
  const k = groups.size;
  if (n >= MIN_ENTRIES && k >= 2 && n > k) {
    const grand = all.reduce((s, x) => s + x, 0) / n;
    let ssb = 0;
    let ssw = 0;
    for (const xs of groups.values()) {
      const m = xs.reduce((s, x) => s + x, 0) / xs.length;
      ssb += xs.length * (m - grand) ** 2;
      for (const x of xs) ssw += (x - m) ** 2;
    }
    const sst = ssb + ssw;
    const msw = ssw / (n - k);
    omega2 = sst + msw > 0 ? Math.max(0, (ssb - (k - 1) * msw) / (sst + msw)) : 0;
  }
  return { layer, categories, omega2, n };
}

export interface PatternsReport {
  total: number;
  enough: boolean;
  layers: LayerStat[];
  best: LayerStat | null;
  decisions: { n: number; byVoc: { voc: boolean; n: number; mean: number }[] };
}

export function patterns(entries: DiaryEntry[], metric: Metric = 'overall'): PatternsReport {
  const layers = (['lunarDay', 'phase', 'sign', 'voc', 'personalDay'] as LayerKey[]).map((l) => layerStats(entries, l, metric));
  const ranked = layers.filter((l) => l.omega2 !== null).sort((a, b) => b.omega2! - a.omega2!);
  const dec = entries.filter((e) => e.decision?.outcome != null);
  const byVoc = [true, false].map((voc) => {
    const xs = dec.filter((e) => e.snapshot.voc === voc).map((e) => e.decision!.outcome!);
    return { voc, n: xs.length, mean: xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN };
  });
  return {
    total: entries.length,
    enough: entries.length >= MIN_ENTRIES,
    layers,
    best: ranked[0] && ranked[0].omega2! > 0 ? ranked[0] : null,
    decisions: { n: dec.length, byVoc },
  };
}
