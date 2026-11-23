import { describe, expect, it } from 'vitest';
import { bodygraph } from '../../src/humandesign/chart';
import { composite, LOVE_GATES, partnerLayer, profileAngle, profileBridge, sharedCenters, splitBridges } from '../../src/humandesign/composite';
import { CHANNELS, channelKey, components } from '../../src/humandesign/graph';

// Публичная карта Ра Уру Ху и синтетическая вторая карта (не данные владельца).
const RA = bodygraph({ year: 1948, month: 4, day: 9, hour: 5, minute: 5, timeZone: 'UTC' } as never);
const B = bodygraph({ year: 1990, month: 3, day: 15, hour: 14, minute: 20, timeZone: 'Europe/Moscow' } as never);

describe('совместимость двух карт (D-143)', () => {
  const c = composite(RA, B);
  it('каждая связь соответствует определению своего вида', () => {
    for (const l of c.links) {
      const [x, y] = l.gates;
      const a = [RA.gates.has(x), RA.gates.has(y)];
      const b = [B.gates.has(x), B.gates.has(y)];
      const full = (p: boolean[]) => p[0] && p[1];
      const any = (p: boolean[]) => p[0] || p[1];
      if (l.kind === 'companionship') expect(full(a) && full(b)).toBe(true);
      if (l.kind === 'electromagnetic') expect(!full(a) && !full(b) && ((a[0] && b[1]) || (a[1] && b[0]))).toBe(true);
      if (l.kind === 'dominance') expect(l.holder === 'a' ? full(a) && !any(b) : full(b) && !any(a)).toBe(true);
      if (l.kind === 'compromise') expect(l.holder === 'a' ? full(a) && any(b) && !full(b) : full(b) && any(a) && !full(a)).toBe(true);
    }
  });
  it('каждый канал, собранный вместе, попал ровно в одну связь', () => {
    const all = new Set([...RA.gates, ...B.gates]);
    const together = CHANNELS.filter(([x, y]) => all.has(x) && all.has(y)).map(channelKey).sort();
    expect(c.links.map((l) => l.key).sort()).toEqual(together);
  });
  it('с самим собой — только дружба', () => {
    const self = composite(RA, RA);
    expect(self.links.every((l) => l.kind === 'companionship')).toBe(true);
    expect(self.links).toHaveLength(RA.channels.length);
  });
  it('слой партнёра не повторяет мои каналы и центры', () => {
    const l = partnerLayer(RA, B);
    const mine = new Set(RA.channels.map(channelKey));
    expect(l.channels.some((k) => mine.has(k))).toBe(false);
    expect(l.centers.some((x) => RA.centers.has(x))).toBe(false);
  });
});

describe('совместимость: основа, профили, мостики (КЛ, «Определённости и разрывы»)', () => {
  it('общие центры — определены у обоих', () => {
    const s = sharedCenters(RA, B);
    for (const c of s) expect(RA.centers.has(c) && B.centers.has(c)).toBe(true);
  });
  it('мостик профиля по правилу КЛ с. 87 (5/1: 1, 4, 5, 2)', () => {
    const mk = (p: [number, number]) => ({ profile: p }) as never;
    expect(profileBridge(mk([5, 1]), mk([1, 3]))?.resonance).toEqual([1]);
    expect(profileBridge(mk([5, 1]), mk([2, 4]))?.harmony.length).toBe(2);
    expect(profileBridge(mk([5, 1]), mk([3, 6]))).toBeNull();
    expect(profileAngle([4, 1])).toBe('juxta');
    expect(profileAngle([6, 2])).toBe('left');
    expect(profileAngle([2, 4])).toBe('right');
  });
  it('ворота-мостики действительно соединяют части разделённой определённости', () => {
    const r = splitBridges(RA, B);
    if (RA.definition === 'single') expect(r).toBeNull();
    for (const gate of r?.gates ?? []) {
      expect(B.gates.has(gate)).toBe(true);
      const g = new Set([...RA.gates, gate]);
      const chs = CHANNELS.filter(([x, y]) => g.has(x) && g.has(y));
      expect(components(chs).length).toBeLessThan(components(RA.channels).length);
    }
  });
  it('ворот любви десять', () => expect(LOVE_GATES.size).toBe(10));
});
