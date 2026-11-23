import { describe, expect, it } from 'vitest';
import { insights, layerName, patterns } from '../../src/diary/patterns';
import type { DiaryEntry } from '../../src/diary/types';

function entry(i: number, energy: number, solarDefined: boolean, waxing: boolean): DiaryEntry {
  return {
    date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
    energy,
    mood: energy,
    sleep: null,
    note: '',
    tags: [],
    decision: null,
    updatedAt: 0,
    snapshot: { lunarDay: (i % 29) + 1, phase: waxing ? 'waxing_crescent' : 'waning_gibbous', sign: 'aries', voc: false, personalDay: null, locationId: 'x', hdOpen: solarDefined ? ['solar'] : [], hdOwnOpen: ['solar', 'sacral'] },
  } as DiaryEntry;
}

describe('закономерности: Дизайн человека и выводы словами (D-140)', () => {
  // 40 записей: когда транзит определяет открытое Солнечное сплетение — энергия ниже.
  const es = Array.from({ length: 40 }, (_, i) => entry(i, i % 2 ? 4 + (i % 3) * 0.3 : 7 + (i % 3) * 0.3, i % 2 === 1, i % 4 < 2));
  const r = patterns(es, 'energy');
  it('появляется слой открытого центра, у которого есть обе категории', () => {
    const l = r.layers.find((x) => x.layer === 'hd:solar');
    expect(l).toBeDefined();
    expect(l!.categories.map((c) => c.category).sort()).toEqual(['определён', 'открыт']);
    expect(r.layers.find((x) => x.layer === 'hd:sacral')).toBeUndefined(); // всегда «открыт» — одна категория
    expect(layerName('hd:solar')).toContain('Солнечное сплетение');
  });
  it('вывод словами находит сильную связь', () => {
    const ins = insights(r.layers);
    expect(ins[0]!.layer).toBe('hd:solar');
    expect(ins[0]!.high.category).toBe('открыт');
    expect(ins[0]!.diff).toBeGreaterThan(2);
  });
  it('старые записи без данных Дизайна человека не ломают расчёт', () => {
    const old = es.map((e) => ({ ...e, snapshot: { ...e.snapshot, hdOpen: undefined, hdOwnOpen: undefined } }));
    expect(patterns(old, 'energy').layers.some((l) => l.layer.startsWith('hd:'))).toBe(false);
  });
});
