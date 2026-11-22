import { describe, expect, it } from 'vitest';
import { makeContent } from '../src/content';
import { computeDay } from '../src/synthesis/day';
import { DEFAULT_NUMEROLOGY } from '../src/personal/numerology';
import { ABOUT, AREA_ABOUT, personalStory } from '../src/synthesis/explain';
import { AREAS } from '../src/synthesis/areas';

const loc = { id: 'k', name: 'тест', latitude: 57.14, longitude: 60.15, elevation: 0, timeZone: 'Asia/Yekaterinburg' };

describe('пояснения', () => {
  it('у каждой сферы есть описание «что сюда входит»', () => {
    for (const a of AREAS) expect(AREA_ABOUT[a.key]).toBeTruthy();
  });
  it('у каждого блока есть «что это»', () => {
    for (const v of Object.values(ABOUT)) expect(v.length).toBeGreaterThan(40);
  });
  it('личный день: расчёт 30.06 на 22.11.2026 → год 1, месяц 3, день 7', () => {
    const c = makeContent();
    const day = computeDay(loc, '2026-11-22', { daylight: { from: 7, to: 23 }, vocMode: 'modern', zodiac: 'tropical', vedic: false, garden: false, birthday: { day: 30, month: 6 }, numerology: DEFAULT_NUMEROLOGY });
    const st = personalStory(day, c, { day: 30, month: 6 })!;
    expect(st.number).toBe(7);
    expect(st.steps[0]).toContain('Личный год 2026: 1 (30.06 + 2026');
    expect(st.steps[1]).toContain('1 + 11 → 3');
    expect(st.steps[2]).toContain('3 + 22 → 7');
    expect(st.about).toContain('притормозить');
    expect(st.mindful.length).toBeGreaterThan(0);
  });
  it('у всех чисел личного дня есть пояснение, «не стоит» и совет', () => {
    const c = makeContent();
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22]) {
      const p = c.personal(n);
      expect(p.about.length).toBeGreaterThan(50);
      expect(p.mindful.length).toBeGreaterThan(0);
      expect(p.tip).toBeTruthy();
    }
  });
});
