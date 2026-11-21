import { describe, expect, it } from 'vitest';
import {
  ingressesBetween,
  lahiriAyanamsa,
  moonLongitudeIn,
  moonSign,
  nextIngress,
  prevIngress,
  SIGNS,
  signFromLongitude,
} from '../../src/astro';

const start = new Date('2026-01-01T00:00Z');
const end = new Date('2026-04-01T00:00Z');

describe('знак Луны', () => {
  it('знак = floor(λ/30)', () => {
    expect(signFromLongitude(0)).toBe('aries');
    expect(signFromLongitude(29.999)).toBe('aries');
    expect(signFromLongitude(30)).toBe('taurus');
    expect(signFromLongitude(359.9)).toBe('pisces');
    expect(signFromLongitude(-1)).toBe('pisces');
  });

  const ingresses = ingressesBetween(start, end);

  it('ингрессии точные: за минуту до — прежний знак, через минуту — новый', () => {
    expect(ingresses.length).toBeGreaterThan(30);
    for (const i of ingresses) {
      expect(moonSign(new Date(i.time.getTime() - 60_000)).sign).toBe(i.from);
      expect(moonSign(new Date(i.time.getTime() + 60_000)).sign).toBe(i.sign);
      const lon = moonLongitudeIn('tropical', i.time);
      const off = Math.abs(((lon - SIGNS.indexOf(i.sign) * 30 + 540) % 360) - 180);
      expect(off).toBeLessThan(1 / 120); // < 0,5′ дуги ≈ 1 минута времени
    }
  });

  it('знаки идут по кругу, Луна в знаке 1,9–2,9 суток', () => {
    for (let k = 1; k < ingresses.length; k++) {
      const a = ingresses[k - 1]!;
      const b = ingresses[k]!;
      expect(b.from).toBe(a.sign);
      const days = (b.time.getTime() - a.time.getTime()) / 86_400_000;
      expect(days).toBeGreaterThan(1.9);
      expect(days).toBeLessThan(2.9);
    }
  });

  it('nextIngress / prevIngress окружают момент', () => {
    const t = new Date('2026-11-19T07:00Z');
    const n = nextIngress(t);
    const p = prevIngress(t);
    expect(p.time < t && t < n.time).toBe(true);
    expect(n.from).toBe(p.sign);
    expect(moonSign(t).sign).toBe(p.sign);
  });

  it('сидерика: айанамша Лахири ≈ 24°12′ в 2026 и растёт ~50″ в год', () => {
    const a2026 = lahiriAyanamsa(new Date('2026-01-01T00:00Z'));
    expect(a2026).toBeGreaterThan(24.15);
    expect(a2026).toBeLessThan(24.25);
    const a2027 = lahiriAyanamsa(new Date('2027-01-01T00:00Z'));
    expect((a2027 - a2026) * 3600).toBeCloseTo(50.3, 0);
  });

  it('сидерические ингрессии сдвинуты на ~1,8 суток позже тропических', () => {
    const trop = ingressesBetween(start, end, 'tropical');
    const sid = ingressesBetween(start, end, 'sidereal');
    const a = trop.find((x) => x.sign === 'leo')!;
    const b = sid.find((x) => x.sign === 'leo' && x.time > a.time)!;
    const days = (b.time.getTime() - a.time.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(1.5);
    expect(days).toBeLessThan(2.3);
  });
});
