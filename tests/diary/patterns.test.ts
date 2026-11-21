import { describe, expect, it } from 'vitest';
import { patterns, layerStats } from '../../src/diary/patterns';
import type { DiaryEntry } from '../../src/diary/types';

function entry(i: number, over: Partial<DiaryEntry['snapshot']>, energy: number): DiaryEntry {
  return {
    date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
    energy,
    mood: energy,
    sleep: 5,
    note: '',
    tags: [],
    decision: null,
    snapshot: { lunarDay: (i % 29) + 1, phase: 'new', sign: 'aries', voc: false, personalDay: (i % 9) + 1, locationId: 'k', ...over },
    updatedAt: 0,
  };
}

describe('мои закономерности', () => {
  it('меньше 30 записей — вывода нет', () => {
    const r = patterns(Array.from({ length: 20 }, (_, i) => entry(i, {}, 5)));
    expect(r.enough).toBe(false);
    expect(r.best).toBeNull();
  });

  it('находит слой, который реально совпадает с оценками', () => {
    // Энергия зависит от фазы: растущая — 8, убывающая — 3, плюс шум по личному дню.
    const es = Array.from({ length: 80 }, (_, i) => {
      const waxing = i % 2 === 0;
      return entry(i, { phase: waxing ? 'waxing_crescent' : 'waning_gibbous', sign: ['aries', 'leo', 'virgo'][i % 3]! }, (waxing ? 8 : 3) + ((i * 7) % 3) - 1);
    });
    const r = patterns(es);
    expect(r.enough).toBe(true);
    expect(r.best?.layer).toBe('phase');
    expect(r.best!.omega2!).toBeGreaterThan(0.5);
  });

  it('категории с n < 5 помечены ненадёжными', () => {
    const s = layerStats(Array.from({ length: 35 }, (_, i) => entry(i, {}, 5)), 'lunarDay', 'energy');
    expect(s.categories.every((c) => c.reliable === c.n >= 5)).toBe(true);
    expect(s.categories.some((c) => !c.reliable)).toBe(true);
  });

  it('случайные оценки не дают «победителя» с большим ω²', () => {
    const es = Array.from({ length: 120 }, (_, i) => entry(i, { phase: ['a', 'b', 'c', 'd'][i % 4]! }, ((i * 37) % 10) + 1));
    const r = patterns(es);
    for (const l of r.layers) if (l.omega2 !== null) expect(l.omega2).toBeLessThan(0.2);
  });
});
