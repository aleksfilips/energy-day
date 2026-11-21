import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayBounds,
  describeLunarDays,
  dominantLunarDay,
  lunarCycle,
  lunarDayAt,
  lunarDaysForDate,
  newMoonsBetween,
  nextMoonrise,
  phaseInfo,
} from '../../src/astro';
import { EKB, SOCHI } from './helpers';

const start = new Date('2025-01-01T00:00Z');
const end = new Date('2028-01-01T00:00Z');
const newMoons = newMoonsBetween(start, end);

describe.each([EKB, SOCHI])('лунные сутки, $name, 2025–2027', (loc) => {
  const cycles = newMoons.slice(0, -1).map((nm) => lunarCycle(loc, nm));

  it('в каждом цикле 29 или 30 суток', () => {
    for (const c of cycles) expect([29, 30]).toContain(c.days.length);
  });

  it('1-е сутки начинаются ровно в новолуние, последние кончаются в следующее новолуние', () => {
    for (const c of cycles) {
      const first = c.days[0]!;
      const last = c.days[c.days.length - 1]!;
      expect(first.start.getTime()).toBe(c.newMoon.getTime());
      expect(first.startKind).toBe('new_moon');
      expect(last.end.getTime()).toBe(c.nextNewMoon.getTime());
      expect(last.endKind).toBe('new_moon');
      expect(phaseInfo(first.start).illuminationPct).toBeLessThan(0.5);
    }
  });

  it('1-е сутки длятся до первого восхода после новолуния', () => {
    for (const c of cycles) {
      expect(c.days[0]!.end.getTime()).toBe(nextMoonrise(loc, c.newMoon)!.getTime());
    }
  });

  it('сутки идут без дыр и наложений, номера подряд, внутренние границы — восходы', () => {
    for (const c of cycles) {
      c.days.forEach((d, i) => {
        expect(d.number).toBe(i + 1);
        expect(d.end.getTime()).toBeGreaterThan(d.start.getTime());
        if (i > 0) {
          expect(d.start.getTime()).toBe(c.days[i - 1]!.end.getTime());
          expect(d.startKind).toBe('moonrise');
        }
      });
    }
    for (let i = 1; i < cycles.length; i++) {
      expect(cycles[i]!.newMoon.getTime()).toBe(cycles[i - 1]!.nextNewMoon.getTime());
    }
  });

  it('полные (не крайние) сутки длятся 23–27 часов', () => {
    for (const c of cycles) {
      for (const d of c.days.slice(1, -1)) {
        const h = (d.end.getTime() - d.start.getTime()) / 3_600_000;
        expect(h).toBeGreaterThan(23);
        expect(h).toBeLessThan(27);
      }
    }
  });

  it('каждая дата покрыта сутками целиком, без зазоров', () => {
    let key = '2026-01-01';
    for (let i = 0; i < 366; i++) {
      const segs = lunarDaysForDate(loc, key);
      const { start: s, end: e } = dayBounds(key, loc.timeZone);
      expect(segs[0]!.from.getTime()).toBe(s.getTime());
      expect(segs[segs.length - 1]!.to.getTime()).toBe(e.getTime());
      for (let j = 1; j < segs.length; j++) expect(segs[j]!.from.getTime()).toBe(segs[j - 1]!.to.getTime());
      expect(segs.length).toBeGreaterThanOrEqual(1);
      expect(segs.length).toBeLessThanOrEqual(3);
      key = addDays(key, 1);
    }
  });

  it('lunarDayAt согласован со списком суток', () => {
    const c = cycles[5]!;
    for (const d of c.days) {
      const mid = new Date((d.start.getTime() + d.end.getTime()) / 2);
      expect(lunarDayAt(loc, mid).number).toBe(d.number);
      expect(lunarDayAt(loc, d.start).number).toBe(d.number); // начало включительно
    }
  });
});

describe('лунные сутки зависят от места', () => {
  it('Сочи и Екатеринбург: границы суток (кроме новолуния) разные', () => {
    const nm = newMoons[10]!;
    const a = lunarCycle(EKB, nm).days[5]!;
    const b = lunarCycle(SOCHI, nm).days[5]!;
    expect(a.start.getTime()).not.toBe(b.start.getTime());
  });
});

describe('представление дня', () => {
  it('формат «до HH:MM — N-е, с HH:MM — N+1-е»', () => {
    const segs = lunarDaysForDate(EKB, '2026-11-19');
    const text = describeLunarDays(segs, EKB.timeZone);
    expect(text).toMatch(/^до \d\d:\d\d — \d+-е, с \d\d:\d\d — \d+-е$/);
  });

  it('основа дня — сутки, занимающие большую часть светлого окна', () => {
    const segs = lunarDaysForDate(EKB, '2026-11-19');
    const { start: s } = dayBounds('2026-11-19', EKB.timeZone);
    const from = new Date(s.getTime() + 7 * 3_600_000);
    const to = new Date(s.getTime() + 23 * 3_600_000);
    const dom = dominantLunarDay(EKB, from, to);
    expect(segs.map((x) => x.day.number)).toContain(dom.number);
  });
});
