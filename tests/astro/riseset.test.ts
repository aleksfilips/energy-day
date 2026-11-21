import { Body, Equator, Horizon } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { dayBounds, moonrisesBetween, moonsetsBetween, toObserver } from '../../src/astro';
import { EKB, SOCHI } from './helpers';

/** Геометрическая высота центра Луны (без рефракции), градусы. */
function geomAltitude(loc: typeof EKB, t: Date): number {
  const obs = toObserver(loc);
  const eq = Equator(Body.Moon, t, obs, true, true);
  return Horizon(t, obs, eq.ra, eq.dec).altitude;
}

describe('восходы и заходы Луны', () => {
  const start = new Date('2026-01-01T00:00Z');
  const end = new Date('2026-04-01T00:00Z');

  for (const loc of [EKB, SOCHI]) {
    it(`${loc.name}: в момент восхода верхний край с рефракцией на горизонте`, () => {
      const rises = moonrisesBetween(loc, start, end);
      expect(rises.length).toBeGreaterThan(80);
      for (const t of rises) {
        // Центр ниже горизонта на 34′ рефракции + видимый радиус (14,7′–16,8′ топоцентрически).
        const alt = geomAltitude(loc, t);
        expect(alt).toBeGreaterThan(-0.87);
        expect(alt).toBeLessThan(-0.80);
        // И Луна действительно поднимается.
        expect(geomAltitude(loc, new Date(t.getTime() + 600_000))).toBeGreaterThan(alt);
      }
    });

    it(`${loc.name}: восходы и заходы чередуются`, () => {
      const ev = [
        ...moonrisesBetween(loc, start, end).map((t) => ({ t, k: 'r' })),
        ...moonsetsBetween(loc, start, end).map((t) => ({ t, k: 's' })),
      ].sort((a, b) => a.t.getTime() - b.t.getTime());
      for (let i = 1; i < ev.length; i++) expect(ev[i]!.k).not.toBe(ev[i - 1]!.k);
    });
  }

  it('интервал между восходами 23–27 часов на средних широтах', () => {
    const rises = moonrisesBetween(EKB, start, end);
    for (let i = 1; i < rises.length; i++) {
      const h = (rises[i]!.getTime() - rises[i - 1]!.getTime()) / 3_600_000;
      expect(h).toBeGreaterThan(23);
      expect(h).toBeLessThan(27);
    }
  });

  it('высота над уровнем моря учитывается, но влияет мало (разреженная атмосфера → меньше рефракция)', () => {
    const { start: s, end: e } = dayBounds('2026-02-10', EKB.timeZone);
    const low = moonrisesBetween(EKB, s, new Date(e.getTime() + 86_400_000))[0]!;
    const high = moonrisesBetween({ ...EKB, elevation: 2000 }, s, new Date(e.getTime() + 86_400_000))[0]!;
    expect(high.getTime()).not.toBe(low.getTime());
    expect(Math.abs(high.getTime() - low.getTime()) / 60_000).toBeLessThan(3);
  });
});
