import { describe, expect, it } from 'vitest';
import ref from '../../fixtures/phases-reference.json';
import { newMoonsBetween, phaseInfo, phaseKeyFromAngle, quartersBetween } from '../../src/astro';
import { minutesDiff } from './helpers';

const start = new Date('2025-01-01T00:00Z');
const end = new Date('2027-01-01T00:00Z');
const quarters = quartersBetween(start, end);

function nearest(kind: 0 | 2, t: Date): Date {
  return quarters
    .filter((q) => q.quarter === kind)
    .reduce((best, q) => (minutesDiff(q.time, t) < minutesDiff(best, t) ? q.time : best), new Date(0));
}

describe('фазы: сверка с таблицами', () => {
  it.each(ref.newMoons)('новолуние %s (±2 мин)', (s) => {
    expect(minutesDiff(nearest(0, new Date(s)), new Date(s))).toBeLessThanOrEqual(ref.toleranceMinutes);
  });
  it.each(ref.fullMoons)('полнолуние %s (±2 мин)', (s) => {
    expect(minutesDiff(nearest(2, new Date(s)), new Date(s))).toBeLessThanOrEqual(ref.toleranceMinutes);
  });
});

describe('фазы: внутренняя согласованность', () => {
  it('четверти идут по кругу 0→1→2→3 с интервалом 6–9 суток', () => {
    for (let i = 1; i < quarters.length; i++) {
      expect(quarters[i]!.quarter).toBe((quarters[i - 1]!.quarter + 1) % 4);
      const days = (quarters[i]!.time.getTime() - quarters[i - 1]!.time.getTime()) / 86_400_000;
      expect(days).toBeGreaterThan(6);
      expect(days).toBeLessThan(9);
    }
  });

  it('синодический месяц 29,2–29,9 суток', () => {
    const nm = newMoonsBetween(start, end);
    expect(nm.length).toBe(24);
    for (let i = 1; i < nm.length; i++) {
      const d = (nm[i]!.getTime() - nm[i - 1]!.getTime()) / 86_400_000;
      expect(d).toBeGreaterThan(29.2);
      expect(d).toBeLessThan(29.9);
    }
  });

  it('в точных фазах угол и освещённость правильные', () => {
    for (const q of quarters) {
      const p = phaseInfo(q.time);
      const target = q.quarter * 90;
      const diff = Math.abs(((p.angle - target + 540) % 360) - 180);
      expect(diff).toBeLessThan(0.01);
      if (q.quarter === 0) expect(p.illuminationPct).toBeLessThan(0.5);
      if (q.quarter === 2) expect(p.illuminationPct).toBeGreaterThan(99.5);
      if (q.quarter % 2 === 1) expect(Math.abs(p.illuminationPct - 50)).toBeLessThan(1.5);
    }
  });

  it('растущая до полнолуния, убывающая после', () => {
    const full = quarters.find((q) => q.quarter === 2)!.time;
    expect(phaseInfo(new Date(full.getTime() - 3_600_000)).waxing).toBe(true);
    expect(phaseInfo(new Date(full.getTime() + 3_600_000)).waxing).toBe(false);
  });

  it('8 фаз — секторы по 45°', () => {
    expect(phaseKeyFromAngle(0)).toBe('new');
    expect(phaseKeyFromAngle(44.9)).toBe('new');
    expect(phaseKeyFromAngle(45)).toBe('waxing_crescent');
    expect(phaseKeyFromAngle(90)).toBe('first_quarter');
    expect(phaseKeyFromAngle(180)).toBe('full');
    expect(phaseKeyFromAngle(270)).toBe('last_quarter');
    expect(phaseKeyFromAngle(359.9)).toBe('balsamic');
  });
});
