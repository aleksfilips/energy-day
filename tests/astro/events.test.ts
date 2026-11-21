import { describe, expect, it } from 'vitest';
import ref from '../../fixtures/eclipses-reference.json';
import { apsidesBetween, eclipseCorridorsBetween, eclipsesBetween, syzygiesBetween } from '../../src/astro';
import { minutesDiff } from './helpers';

const start = new Date('2025-01-01T00:00Z');
const end = new Date('2027-01-01T00:00Z');

describe('затмения', () => {
  const list = eclipsesBetween(start, end);

  it('за 2025–2026 найдено 8 затмений, как в каталоге NASA', () => {
    expect(list).toHaveLength(ref.eclipses.length);
  });

  it.each(ref.eclipses)('$body $type $peak', (e) => {
    const found = list.find((x) => x.body === e.body && minutesDiff(x.peak, new Date(e.peak)) < 60 * 24);
    expect(found).toBeDefined();
    expect(found!.type).toBe(e.type);
    expect(minutesDiff(found!.peak, new Date(e.peak))).toBeLessThanOrEqual(ref.toleranceMinutes);
  });

  it('коридор ±7 суток помечен как традиция', () => {
    const c = eclipseCorridorsBetween(new Date('2026-08-01T00:00Z'), new Date('2026-09-10T00:00Z'));
    expect(c.length).toBe(2);
    for (const x of c) {
      expect(x.layer).toBe('tradition');
      expect((x.end.getTime() - x.start.getTime()) / 86_400_000).toBe(14);
    }
  });
});

describe('перигей, апогей, суперлуние', () => {
  const aps = apsidesBetween(start, end);

  it('апсиды чередуются, расстояния в физических пределах', () => {
    for (let i = 1; i < aps.length; i++) expect(aps[i]!.type).not.toBe(aps[i - 1]!.type);
    for (const a of aps) {
      if (a.type === 'perigee') expect(a.distanceKm).toBeGreaterThan(356_000), expect(a.distanceKm).toBeLessThan(371_000);
      else expect(a.distanceKm).toBeGreaterThan(404_000), expect(a.distanceKm).toBeLessThan(407_000);
    }
  });

  it('суперлуния-полнолуния осени 2025 (7 окт, 5 ноя, 4 дек) и 24 дек 2026', () => {
    const fullSuper = syzygiesBetween(start, end)
      .filter((s) => s.type === 'full' && s.supermoon)
      .map((s) => s.time.toISOString().slice(0, 10));
    expect(fullSuper).toEqual(expect.arrayContaining(['2025-10-07', '2025-11-05', '2025-12-04', '2026-12-24']));
  });

  it('closeness в [0, 1] (с небольшим запасом), супер и микро не пересекаются', () => {
    for (const s of syzygiesBetween(start, end)) {
      expect(s.closeness).toBeGreaterThan(-0.05);
      expect(s.closeness).toBeLessThan(1.05);
      expect(s.supermoon && s.micromoon).toBe(false);
    }
  });
});
