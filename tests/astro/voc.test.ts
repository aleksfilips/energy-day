import { describe, expect, it } from 'vitest';
import {
  ingressesBetween,
  moonAspectsBetween,
  moonPlanetElongation,
  ASPECT_ANGLES,
  vocAt,
  vocPeriodsBetween,
  vocPlanets,
} from '../../src/astro';

const start = new Date('2026-01-01T00:00Z');
const end = new Date('2026-03-01T00:00Z');
const modern = vocPeriodsBetween(start, end, 'modern');
const classical = vocPeriodsBetween(start, end, 'classical');

describe('Луна без курса', () => {
  it('один период на каждое пребывание в знаке', () => {
    const ingresses = ingressesBetween(start, end);
    expect(modern.length).toBeGreaterThanOrEqual(ingresses.length - 1);
    expect(modern.length).toBeLessThanOrEqual(ingresses.length + 1);
  });

  it('конец периода — ингрессия, начало — точный аспект (орб < 1″·60)', () => {
    const ingressTimes = new Set(ingressesBetween(start, new Date(end.getTime() + 4 * 86_400_000)).map((i) => i.time.getTime()));
    for (const p of modern) {
      expect(ingressTimes.has(p.end.getTime())).toBe(true);
      expect(p.start < p.end).toBe(true);
      if (p.lastAspect) {
        const target = ASPECT_ANGLES[p.lastAspect.kind];
        const e = moonPlanetElongation(p.lastAspect.planet, p.start);
        const orb = Math.min(Math.abs(((e - target + 540) % 360) - 180), Math.abs(((e + target + 540) % 360) - 180));
        expect(orb * 60).toBeLessThan(1); // меньше угловой минуты
      }
    }
  });

  it('внутри периода точных аспектов больше нет', () => {
    for (const p of modern) {
      const inside = moonAspectsBetween(vocPlanets('modern'), new Date(p.start.getTime() + 60_000), p.end);
      expect(inside).toHaveLength(0);
    }
  });

  it('классический режим (Солнце…Сатурн) даёт периоды не короче современного', () => {
    for (const m of modern) {
      const c = classical.find((x) => x.end.getTime() === m.end.getTime())!;
      expect(c).toBeDefined();
      expect(c.start.getTime()).toBeLessThanOrEqual(m.start.getTime());
    }
  });

  it('vocAt согласован со списком', () => {
    const p = modern[3]!;
    const mid = new Date((p.start.getTime() + p.end.getTime()) / 2);
    expect(vocAt(mid)?.end.getTime()).toBe(p.end.getTime());
    expect(vocAt(new Date(p.start.getTime() - 60_000))).toBeNull();
  });

  it('длительность: от минут до ~2 суток', () => {
    for (const p of modern) {
      const h = (p.end.getTime() - p.start.getTime()) / 3_600_000;
      expect(h).toBeGreaterThan(0);
      expect(h).toBeLessThan(60);
    }
  });
});
