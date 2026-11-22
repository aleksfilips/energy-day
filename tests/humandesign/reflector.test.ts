/**
 * Режим Рефлектора: сверка с независимым расчётом Swiss Ephemeris (fixtures/hd-reflector-swisseph.json,
 * синтетическая карта 31.03.1988 07:50 UTC — Рефлектор 2/4).
 */
import { describe, expect, it } from 'vitest';
import fx from '../../fixtures/hd-reflector-swisseph.json';
import { bodygraph } from '../../src/humandesign/chart';
import { lunarMonth, moonReturn } from '../../src/humandesign/reflector';
import { transitStory } from '../../src/humandesign/summary';
import { dayTransits } from '../../src/humandesign/transits';
import type { DateKey } from '../../src/astro/time';

const birth = { year: 1988, month: 3, day: 31, hour: 7, minute: 50, timeZone: 'UTC' };
const chart = bodygraph(birth);

describe('Рефлектор', () => {
  it('карта совпадает с эталоном: тип, профиль, ворота', () => {
    expect(chart.type).toBe('reflector');
    expect(chart.centers.size).toBe(0);
    expect(chart.authority).toBe('lunar');
    expect(chart.profile).toEqual(fx.profile);
    expect([...chart.gates].sort((a, b) => a - b)).toEqual(fx.gates);
  });

  it('лунный месяц (28 дней): ворота Луны, каналы и центры по дням совпадают со Swiss Ephemeris', () => {
    const m = lunarMonth(chart, fx.month[0]!.key as DateKey, fx.tz, fx.month.length);
    expect(m.map((d) => d.key)).toEqual(fx.month.map((d) => d.key));
    m.forEach((d, i) => {
      const r = fx.month[i]!;
      expect(d.moonGates, d.key).toEqual(r.moonGates);
      expect(d.channels.map((c) => c.key).sort(), d.key).toEqual(r.channels);
      expect([...d.centers].sort(), d.key).toEqual(r.centers);
    });
  });

  it('конец лунного цикла решения — возврат Луны в те же ворота (±60 с к эталону), 26–29 дней', () => {
    for (const r of fx.returns) {
      const end = moonReturn(new Date(r.start));
      expect(Math.abs(end.getTime() - new Date(r.end).getTime())).toBeLessThan(60_000);
      const days = (end.getTime() - new Date(r.start).getTime()) / 86_400_000;
      expect(days).toBeGreaterThan(26);
      expect(days).toBeLessThan(29);
    }
  });

  it('история дня знает, что это Рефлектор', () => {
    const s = transitStory(chart, dayTransits(chart, '2026-11-22' as DateKey, fx.tz), fx.tz);
    expect(s.type.isReflector).toBe(true);
    expect(s.type.name).toMatch(/Рефлектор/);
  });
});
