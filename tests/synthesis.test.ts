import { describe, expect, it } from 'vitest';
import * as A from '../src/astro';
import { makeContent } from '../src/content';
import { computeDay, computeMonth } from '../src/synthesis/day';
import { synthesize, RULES_TEXT } from '../src/synthesis/rules';
import { DEFAULT_NUMEROLOGY } from '../src/personal/numerology';

const loc = A.requireResolved(A.LOCATION_PRESETS[0]!);
const opts = { daylight: { from: 7, to: 23 }, vocMode: 'modern' as const, zodiac: 'tropical' as const, vedic: true, garden: true, birthday: { day: 30, month: 6 }, numerology: DEFAULT_NUMEROLOGY };
const content = makeContent();

describe('синтез «Энергии дня»', () => {
  const dates = A.monthDateKeys(2026, 11);

  it.each(dates)('%s: карточка собирается, 3 тега, 2–3 предложения, тон −3..3', (date) => {
    const c = synthesize(computeDay(loc, date, opts), content);
    expect(c.tags).toHaveLength(3);
    expect(new Set(c.tags).size).toBe(3);
    const sentences = c.summary.split(/(?<=[.!?])\s+/).filter(Boolean);
    expect(sentences.length).toBeGreaterThanOrEqual(2);
    expect(sentences.length).toBeLessThanOrEqual(3);
    expect(c.tone.value).toBeGreaterThanOrEqual(-3);
    expect(c.tone.value).toBeLessThanOrEqual(3);
    expect(Math.max(-3, Math.min(3, c.tone.parts.reduce((s, p) => s + p.value, 0)))).toBe(c.tone.value);
    expect(c.why.length).toBeGreaterThanOrEqual(3);
    expect(c.personal?.number).toBeGreaterThan(0);
  });

  it('основа — сутки, занимающие большую часть светлого окна', () => {
    const d = computeDay(loc, '2026-11-19', opts);
    expect(d.dominant.number).toBe(11);
    expect(synthesize(d, content).summary).toContain('До 14:38 ещё идут 10-е сутки');
  });

  it('в день Луны без курса есть окно с точным временем', () => {
    // Cafe Astrology: VOC 19.11 20:46 ET → 20.11 00:52 ET, то есть до 10:52 по Екатеринбургу.
    const d = computeDay(loc, '2026-11-20', opts);
    const c = synthesize(d, content);
    const v = c.modifiers.find((m) => m.key === 'voc' && m.to)!;
    expect(A.formatTime(v.to!, loc.timeZone)).toBe('10:52');
  });

  it('правила синтеза описаны для экрана «Почему так?»', () => {
    expect(RULES_TEXT.map((r) => r.title)).toEqual(['Основа', 'Фон', 'Окраска', 'Модификаторы', 'Личная нота', 'Шкала тона']);
  });

  it('месяц: доминирующие сутки совпадают с подробным расчётом', () => {
    const m = computeMonth(loc, 2026, 11, opts);
    for (const b of m.filter((_, i) => i % 5 === 0)) expect(b.dominant).toBe(computeDay(loc, b.date, opts).dominant.number);
  });
});
