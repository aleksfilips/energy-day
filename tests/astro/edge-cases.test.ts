/**
 * Крайние случаи лунных суток (ТЗ, раздел 4.1 и 10).
 * Каждый случай сначала ищется в данных 2025–2027 (чтобы не зависеть от одной даты),
 * затем закрепляется конкретной датой как регрессия.
 */
import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayBounds,
  formatDateTime,
  lunarCycle,
  lunarDayLatitudeWarning,
  lunarDaysForDate,
  moonrisesBetween,
  newMoonsBetween,
  type LunarDay,
} from '../../src/astro';
import { EKB, MURMANSK, SOCHI } from './helpers';

const newMoons = newMoonsBetween(new Date('2025-01-01T00:00Z'), new Date('2028-01-01T00:00Z'));
const cycles = newMoons.slice(0, -1).map((nm) => lunarCycle(EKB, nm));
const minutes = (d: LunarDay) => (d.end.getTime() - d.start.getTime()) / 60_000;
const allDates = (() => {
  const out: string[] = [];
  let k = '2025-01-01';
  while (k < '2028-01-01') {
    out.push(k);
    k = addDays(k, 1);
  }
  return out;
})();

describe('30-е сутки', () => {
  const with30 = cycles.filter((c) => c.days.length === 30);

  it('циклы из 30 суток встречаются (≈ половина) и 30-е сутки кончаются в новолуние', () => {
    expect(with30.length).toBeGreaterThan(cycles.length * 0.3);
    for (const c of with30) {
      const d30 = c.days[29]!;
      expect(d30.number).toBe(30);
      expect(d30.endKind).toBe('new_moon');
      expect(d30.end.getTime()).toBe(c.nextNewMoon.getTime());
    }
  });

  it('очень короткие 30-е сутки: 2027-09-30, Екатеринбург, ~15 минут', () => {
    const c = cycles.find((x) => formatDateTime(x.nextNewMoon, EKB.timeZone).startsWith('2027-09-30'))!;
    const last = c.days[c.days.length - 1]!;
    expect(last.number).toBe(30);
    expect(minutes(last)).toBeLessThan(20);
  });
});

describe('очень короткие 1-е сутки (новолуние за минуты до восхода)', () => {
  it('в 2025–2027 есть 1-е сутки короче часа', () => {
    const shortest = Math.min(...cycles.map((c) => minutes(c.days[0]!)));
    expect(shortest).toBeLessThan(60);
  });

  it('2026-03-19, Екатеринбург: новолуние 06:24, восход ~06:58, 1-е сутки ~34 минуты, затем 2-е', () => {
    const segs = lunarDaysForDate(EKB, '2026-03-19');
    const first = segs.find((s) => s.day.number === 1)!;
    expect(first.startsToday && first.endsToday).toBe(true);
    expect(minutes(first.day)).toBeGreaterThan(25);
    expect(minutes(first.day)).toBeLessThan(45);
    expect(first.day.endKind).toBe('moonrise');
    expect(segs.map((s) => s.day.number)).toEqual([29, 1, 2]);
  });
});

describe('календарный день без восхода Луны', () => {
  const noRise = allDates.filter((k) => {
    const { start, end } = dayBounds(k, EKB.timeZone);
    return moonrisesBetween(EKB, start, end).length === 0;
  });

  it('такие дни бывают примерно раз в месяц', () => {
    expect(noRise.length).toBeGreaterThan(30);
    expect(noRise.length).toBeLessThan(45);
  });

  it('в такой день сутки просто продолжаются (смен нет, кроме новолуния)', () => {
    for (const k of noRise) {
      const segs = lunarDaysForDate(EKB, k);
      const changes = segs.slice(1).map((s) => s.day.startKind);
      expect(changes.every((c) => c === 'new_moon')).toBe(true);
      if (segs.length === 1) {
        expect(segs[0]!.startsToday).toBe(false);
        expect(segs[0]!.endsToday).toBe(false);
      }
    }
  });

  it('2025-01-20, Екатеринбург: весь день одни сутки длиной больше 24 часов', () => {
    const segs = lunarDaysForDate(EKB, '2025-01-20');
    expect(segs).toHaveLength(1);
    expect(minutes(segs[0]!.day)).toBeGreaterThan(24 * 60);
  });
});

describe('две смены суток в один календарный день', () => {
  const triple = allDates.filter((k) => lunarDaysForDate(EKB, k).length === 3);

  it('встречаются в дни новолуния: последние → 1-е → 2-е или 29-е → 30-е → 1-е', () => {
    expect(triple.length).toBeGreaterThan(10);
    for (const k of triple) {
      const nums = lunarDaysForDate(EKB, k).map((s) => s.day.number);
      expect(nums).toContain(1);
    }
  });

  it('2025-01-29, Екатеринбург: 29 → 30 → 1', () => {
    expect(lunarDaysForDate(EKB, '2025-01-29').map((s) => s.day.number)).toEqual([29, 30, 1]);
  });

  it('2025-02-28, Екатеринбург: 29 → 1 → 2', () => {
    expect(lunarDaysForDate(EKB, '2025-02-28').map((s) => s.day.number)).toEqual([29, 1, 2]);
  });
});

describe('высокие широты', () => {
  it('Мурманск: методика вырождается, цикл помечается нерегулярным и широта — предупреждением', () => {
    const c = lunarCycle(MURMANSK, newMoons[4]!);
    expect(c.regular).toBe(false);
    expect(lunarDayLatitudeWarning(MURMANSK)).toBe(true);
    expect(lunarDayLatitudeWarning(EKB)).toBe(false);
    expect(lunarDayLatitudeWarning(SOCHI)).toBe(false);
    // Но сутки всё равно непрерывны.
    for (let i = 1; i < c.days.length; i++) expect(c.days[i]!.start.getTime()).toBe(c.days[i - 1]!.end.getTime());
  });
});
