import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/personal-day.json';
import { DEFAULT_NUMEROLOGY, digitSum, personalDay, personalNumbers, reduce } from '../../src/personal/numerology';

describe('нумерология: сведение', () => {
  it('сумма цифр до одной цифры', () => {
    expect(digitSum(2026)).toBe(10);
    expect(reduce(2026)).toBe(1);
    expect(reduce(38)).toBe(2);
    expect(reduce(9)).toBe(9);
  });
  it('мастер-числа — только по настройке', () => {
    expect(reduce(29)).toBe(2);
    expect(reduce(29, true)).toBe(11);
    expect(reduce(22, true)).toBe(22);
    expect(reduce(22, false)).toBe(4);
  });
});

describe('личный год, месяц, день (ручной пример)', () => {
  // Рождение 5 марта, дата 19.11.2026:
  // год: 3 + 5 + (2+0+2+6=10) = 18 → 9; месяц: 9 + 11 = 20 → 2; день: 2 + 19 = 21 → 3.
  it('5 марта → 19.11.2026 = день 3', () => {
    expect(personalNumbers({ day: 5, month: 3 }, { year: 2026, month: 11, day: 19 })).toEqual({ year: 9, month: 2, day: 3 });
  });

  it('без мастер-чисел вариант сложения года не влияет на результат', () => {
    const b = { day: 29, month: 11 };
    for (let d = 1; d <= 28; d++) {
      const date = { year: 2026, month: 2, day: d };
      expect(personalDay(b, date, { ...DEFAULT_NUMEROLOGY, yearMode: 'whole' })).toBe(personalDay(b, date));
    }
  });

  it('смена личного года в день рождения (опция)', () => {
    const b = { day: 5, month: 3 };
    const before = { year: 2026, month: 3, day: 4 };
    expect(personalNumbers(b, before, { ...DEFAULT_NUMEROLOGY, yearSwitch: 'birthday' }).year).toBe(
      personalNumbers(b, { year: 2025, month: 3, day: 4 }).year,
    );
  });
});

describe('сверка с astromeridian.ru (fixtures/personal-day.json)', () => {
  const cases = fixture.cases as { date: string; personalDay: number }[];
  const birthday = fixture.birthday as { day: number; month: number } | null;
  it.skipIf(!birthday || cases.length === 0)('100% совпадение', () => {
    for (const c of cases) {
      const [y, m, d] = c.date.split('-').map(Number) as [number, number, number];
      expect(personalDay(birthday!, { year: y, month: m, day: d })).toBe(c.personalDay);
    }
  });
});
