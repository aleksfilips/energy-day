import { describe, expect, it } from 'vitest';
import {
  gardenChangesBetween,
  gardenInfo,
  nakshatra,
  nakshatraChangesBetween,
  nakshatraFromLongitude,
  quartersBetween,
  tithi,
  tithiChangesBetween,
  tithiFromElongation,
} from '../../src/astro';

describe('титхи', () => {
  it('формула floor(elong/12)+1', () => {
    expect(tithiFromElongation(0)).toBe(1);
    expect(tithiFromElongation(11.99)).toBe(1);
    expect(tithiFromElongation(12)).toBe(2);
    expect(tithiFromElongation(180)).toBe(16);
    expect(tithiFromElongation(359.99)).toBe(30);
  });

  it('сразу после новолуния — 1-я шукла, сразу после полнолуния — 16-я (1-я кришна)', () => {
    const q = quartersBetween(new Date('2026-01-01T00:00Z'), new Date('2026-02-01T00:00Z'));
    const nm = q.find((x) => x.quarter === 0)!.time;
    const fm = q.find((x) => x.quarter === 2)!.time;
    const a = tithi(new Date(nm.getTime() + 3_600_000));
    expect(a.number).toBe(1);
    expect(a.paksha).toBe('shukla');
    const b = tithi(new Date(fm.getTime() + 3_600_000));
    expect(b.number).toBe(16);
    expect(b.paksha).toBe('krishna');
    expect(b.inPaksha).toBe(1);
    expect(tithi(new Date(fm.getTime() - 3_600_000)).name).toBe('Пурнима');
  });

  it('за синодический месяц 30 смен титхи по порядку', () => {
    const ch = tithiChangesBetween(new Date('2026-01-18T20:00Z'), new Date('2026-02-17T12:30Z'));
    expect(ch).toHaveLength(30);
    for (let i = 1; i < ch.length; i++) expect(ch[i]!.number).toBe((ch[i - 1]!.number % 30) + 1);
  });
});

describe('накшатры', () => {
  it('27 по 13°20′', () => {
    expect(nakshatraFromLongitude(0)).toBe(1);
    expect(nakshatraFromLongitude(13.33)).toBe(1);
    expect(nakshatraFromLongitude(13.34)).toBe(2);
    expect(nakshatraFromLongitude(359.9)).toBe(27);
  });

  it('за сидерический месяц все 27 по порядку', () => {
    const ch = nakshatraChangesBetween(new Date('2026-01-01T00:00Z'), new Date('2026-01-28T08:00Z'));
    expect(ch.length).toBeGreaterThanOrEqual(27);
    for (let i = 1; i < ch.length; i++) expect(ch[i]!.number).toBe((ch[i - 1]!.number % 27) + 1);
    for (const c of ch) expect(nakshatra(new Date(c.time.getTime() + 60_000)).number).toBe(c.number);
  });
});

describe('садовый слой (Тун, приближение)', () => {
  const ch = gardenChangesBetween(new Date('2026-01-01T00:00Z'), new Date('2026-03-01T00:00Z'));

  it('созвездия сменяются по порядку зодиака, стихии чередуются', () => {
    const order = ['Ari', 'Tau', 'Gem', 'Cnc', 'Leo', 'Vir', 'Lib', 'Sco', 'Sgr', 'Cap', 'Aqr', 'Psc'];
    for (let i = 1; i < ch.length; i++) {
      const a = order.indexOf(ch[i - 1]!.constellation);
      const b = order.indexOf(ch[i]!.constellation);
      expect(b).toBe((a + 1) % 12);
      expect(ch[i]!.day).not.toBe(ch[i - 1]!.day);
    }
  });

  it('созвездия неравные: Дева дольше всех, Скорпион короче всех', () => {
    const dur: Record<string, number[]> = {};
    for (let i = 1; i < ch.length; i++) {
      (dur[ch[i - 1]!.constellation] ??= []).push((ch[i]!.time.getTime() - ch[i - 1]!.time.getTime()) / 3_600_000);
    }
    const avg = (k: string) => dur[k]!.reduce((s, x) => s + x, 0) / dur[k]!.length;
    expect(avg('Vir')).toBeGreaterThan(avg('Ari'));
    expect(avg('Sco')).toBeLessThan(avg('Lib'));
  });

  it('результат всегда помечен как приближение и стихия по маппингу ТЗ', () => {
    const g = gardenInfo(new Date('2026-11-19T07:00Z'));
    expect(g.approximate).toBe(true);
    const map: Record<string, string> = { Tau: 'root', Vir: 'root', Cap: 'root', Cnc: 'leaf', Sco: 'leaf', Psc: 'leaf', Gem: 'flower', Lib: 'flower', Aqr: 'flower', Ari: 'fruit', Leo: 'fruit', Sgr: 'fruit' };
    expect(g.day).toBe(map[g.constellation]);
  });
});
