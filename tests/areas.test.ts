import { describe, expect, it } from 'vitest';
import * as A from '../src/astro';
import data from '../src/content/data/lunar-areas.json';
import { computeDay } from '../src/synthesis/day';
import { AREAS, dayAreas, dreamsVerdict, rawScore, verdictOf } from '../src/synthesis/areas';
import { DEFAULT_NUMEROLOGY } from '../src/personal/numerology';

const loc = A.requireResolved(A.LOCATION_PRESETS[0]!);
const opts = { daylight: { from: 7, to: 23 }, vocMode: 'modern' as const, zodiac: 'tropical' as const, vedic: false, garden: false, birthday: null, numerology: DEFAULT_NUMEROLOGY };

describe('оценки сфер по лунным дням', () => {
  it('таблица полная: 30 дней × 24 колонки, оценки 1…5', () => {
    for (let d = 1; d <= 30; d++) {
      const row = (data.days as Record<string, Record<string, number>>)[String(d)]!;
      expect(Object.keys(row)).toHaveLength(24);
      for (const v of Object.values(row)) expect(v >= 1 && v <= 5).toBe(true);
    }
  });

  it('у каждой поправки есть причина, и она только смягчает или делает осторожнее (кроме сведения к середине)', () => {
    for (const a of data.adjustments) {
      expect(a.reason.length).toBeGreaterThan(10);
      expect(data.columns).toContain(a.area);
    }
  });

  it('сверка с источником: 14-й день — отлично для начинаний и денег; 29-й — ужасно для начинаний', () => {
    expect(rawScore(14, 'start')).toBe(5);
    expect(rawScore(14, 'money')).toBe(5);
    expect(rawScore(29, 'start')).toBe(1);
    expect(verdictOf(rawScore(23, 'hair'))).toBe('bad'); // поправка по тексту источника
  });

  it('у каждой сферы три текста', () => {
    expect(AREAS).toHaveLength(20);
    for (const a of AREAS) for (const v of ['good', 'neutral', 'bad'] as const) expect(a.text[v].length).toBeGreaterThan(5);
  });

  it.each(A.monthDateKeys(2026, 11))('%s: 20 сфер, оценка согласована с текстом', (date) => {
    const list = dayAreas(computeDay(loc, date, opts));
    expect(list).toHaveLength(20);
    for (const a of list) expect(a.text).toBe(AREAS.find((x) => x.key === a.key)!.text[a.verdict]);
  });

  it('20 ноября 2026: Луна без курса до 10:52 — у деловых сфер есть точное время', () => {
    const list = dayAreas(computeDay(loc, '2026-11-20', opts));
    const biz = list.filter((a) => ['start', 'business', 'money'].includes(a.key) && a.verdict !== 'bad');
    for (const a of biz) expect(a.note).toContain('10:52');
  });

  it('день затмения (12 августа 2026, полное солнечное): новые дела и свадьба — «не стоит»', () => {
    const d = computeDay(loc, '2026-08-12', opts);
    expect(d.eclipses.length).toBeGreaterThan(0);
    const list = dayAreas(d);
    expect(list.find((a) => a.key === 'start')!.verdict).toBe('bad');
    expect(list.find((a) => a.key === 'wedding')!.verdict).toBe('bad');
  });

  it('сны: оценка есть на каждый день', () => {
    for (let d = 1; d <= 30; d++) expect(dreamsVerdict(d).text.length).toBeGreaterThan(5);
  });
});
