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
export type BaseLayer = 'lunarDay' | 'phase' | 'sign' | 'voc' | 'personalDay';
/** Слой Дизайна человека: открытый центр, который транзит то определяет, то нет (D-140). */
export type HdLayer = `hd:${string}`;
export type LayerKey = BaseLayer | HdLayer;

export const LAYER_NAMES: Record<BaseLayer, string> = {
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

export const HD_CENTER_NAMES: Record<string, string> = {
  head: 'Теменной центр',
  ajna: 'Аджна',
  throat: 'Горловой центр',
  g: 'Джи-центр',
  heart: 'Сердечный центр (Эго)',
  spleen: 'Селезёнка',
  solar: 'Солнечное сплетение',
  sacral: 'Сакральный центр',
  root: 'Корневой центр',
};

export function layerName(l: LayerKey): string {
  if (l.startsWith('hd:')) return `ДЧ: ${HD_CENTER_NAMES[l.slice(3)] ?? l.slice(3)} от транзита`;
  return LAYER_NAMES[l as BaseLayer];
}

function categoryOf(e: DiaryEntry, layer: LayerKey): string | null {
  const s = e.snapshot;
  if (layer.startsWith('hd:')) {
    const c = layer.slice(3);
    if (!s.hdOpen || !s.hdOwnOpen?.includes(c)) return null;
    return s.hdOpen.includes(c) ? 'определён' : 'открыт';
  }
  switch (layer as BaseLayer) {
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

/** Вывод словами: где оценка заметно выше или ниже обычного. */
export interface Insight {
  layer: LayerKey;
  high: CategoryStat;
  low: CategoryStat;
  diff: number;
  omega2: number;
}

/**
 * Простые выводы: слой с заметной связью (ω² ≥ 4%), разница между лучшей и худшей надёжной категорией ≥ 1 балла.
 * Сортировка по силе связи; не больше трёх.
 */
export function insights(layers: LayerStat[], max = 3): Insight[] {
  const out: Insight[] = [];
  for (const l of layers) {
    if (l.omega2 === null || l.omega2 < 0.04) continue;
    const ok = l.categories.filter((c) => c.reliable);
    if (ok.length < 2) continue;
    const high = ok.reduce((a, b) => (b.mean > a.mean ? b : a));
    const low = ok.reduce((a, b) => (b.mean < a.mean ? b : a));
    if (high.mean - low.mean < 1) continue;
    out.push({ layer: l.layer, high, low, diff: high.mean - low.mean, omega2: l.omega2 });
  }
  return out.sort((a, b) => b.omega2 - a.omega2).slice(0, max);
}

export interface PatternsReport {
  total: number;
  enough: boolean;
  layers: LayerStat[];
  best: LayerStat | null;
  decisions: { n: number; byVoc: { voc: boolean; n: number; mean: number }[] };
}

export function patterns(entries: DiaryEntry[], metric: Metric = 'overall'): PatternsReport {
  const hdCenters = [...new Set(entries.flatMap((e) => e.snapshot.hdOwnOpen ?? []))].filter((c) => c in HD_CENTER_NAMES);
  const layers = ([...(['lunarDay', 'phase', 'sign', 'voc', 'personalDay'] as LayerKey[]), ...hdCenters.map((c) => `hd:${c}` as HdLayer)])
    .map((l) => layerStats(entries, l, metric))
    .filter((l) => !l.layer.startsWith('hd:') || l.categories.length >= 2);
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
