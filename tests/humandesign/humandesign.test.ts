import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/hd-swisseph.json';
import { GATE_ORDER, gateLine, gateStartLongitude, GATE_SPAN, LINE_SPAN } from '../../src/humandesign/wheel';
import { CENTER_GATES, CHANNELS, GATE_CENTER, CENTERS, channelCenters, definedChannels, definedCenters, components } from '../../src/humandesign/graph';
import { hdLongitude, designMoment, type HdBody } from '../../src/humandesign/positions';
import { bodygraphFromUtc, hdType, hdAuthority, type Bodygraph } from '../../src/humandesign/chart';
import { transitsBetween, transitSegments } from '../../src/humandesign/transits';
import { transitLines, hdProfileLines, transitStory } from '../../src/humandesign/summary';
import { planetLongitude } from '../../src/astro/bodies';
import content from '../../src/content/data/humandesign.json';

const angDiffSec = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180) * 3600;

describe('колесо ворот', () => {
  it('64 разных ворот', () => {
    expect(new Set(GATE_ORDER).size).toBe(64);
    expect([...GATE_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, i) => i + 1));
  });
  it('опорные точки мандалы', () => {
    expect(gateStartLongitude(41)).toBeCloseTo(302, 9); // 2°00′ Водолея
    expect(gateStartLongitude(1)).toBeCloseTo(223.25, 9); // 13°15′ Скорпиона
    expect(gateStartLongitude(2)).toBeCloseTo(43.25, 9); // 13°15′ Тельца
    expect(gateStartLongitude(25)).toBeCloseTo(358.25, 9); // 28°15′ Рыб
    expect(gateStartLongitude(51)).toBeCloseTo(15.125, 9); // 15°07′30″ Овна
  });
  it('противоположные ворота — Солнце и Земля', () => {
    for (const g of GATE_ORDER) {
      const opp = gateLine(gateStartLongitude(g) + 180 + 0.1).gate;
      expect(gateLine(gateStartLongitude(opp) + 180 + 0.1).gate).toBe(g);
    }
    expect(gateLine(gateStartLongitude(1) + 180 + 0.1).gate).toBe(2);
    expect(gateLine(gateStartLongitude(13) + 180 + 0.1).gate).toBe(7);
  });
  it('линии 1..6 и граница', () => {
    const s = gateStartLongitude(41);
    for (let l = 0; l < 6; l++) expect(gateLine(s + l * LINE_SPAN + 0.01).line).toBe(l + 1);
    expect(gateLine(s - 0.001).gate).toBe(60);
    expect(gateLine(s + GATE_SPAN - 0.001)).toMatchObject({ gate: 41, line: 6 });
    expect(gateLine(s + GATE_SPAN)).toMatchObject({ gate: 19, line: 1 });
  });
});

describe('схема бодиграфа', () => {
  it('каждые ворота ровно в одном центре', () => {
    const all = Object.values(CENTER_GATES).flat();
    expect(all.length).toBe(64);
    expect(new Set(all).size).toBe(64);
  });
  it('36 каналов, каждые ворота в каналах правильного центра', () => {
    expect(CHANNELS.length).toBe(36);
    expect(new Set(CHANNELS.map((c) => c.join('-'))).size).toBe(36);
    for (const ch of CHANNELS) {
      const [a, b] = channelCenters(ch);
      expect(a).not.toBe(b);
    }
    // Ворота без канала не бывает
    const used = new Set(CHANNELS.flat());
    expect(used.size).toBe(64);
  });
  it('ворота 10, 20, 34, 57 — «интеграция»', () => {
    const chs = definedChannels(new Set([10, 20, 34, 57]));
    expect(chs.map((c) => c.join('-')).sort()).toEqual(['10-20', '10-34', '10-57', '20-34', '20-57', '34-57']);
  });
  it('тексты есть для всех ворот, каналов и центров', () => {
    for (let g = 1; g <= 64; g++) expect((content.gates as Record<string, { name: string; iching: string; gist: string }>)[String(g)]).toMatchObject({ name: expect.any(String), iching: expect.any(String), gist: expect.any(String) });
    for (const ch of CHANNELS) expect((content.channels as Record<string, unknown>)[ch.join('-')]).toBeTruthy();
    for (const c of CENTERS) expect(content.centers[c].transit).toBeTruthy();
  });
});

describe('тип и авторитет', () => {
  const chart = (gates: number[]) => {
    const chs = definedChannels(new Set(gates));
    const cs = definedCenters(chs);
    return { type: hdType(chs, cs), authority: hdAuthority(chs, cs), parts: components(chs).length };
  };
  it('рефлектор', () => expect(chart([1, 3, 64])).toMatchObject({ type: 'reflector', authority: 'lunar', parts: 0 }));
  it('генератор с сакральным авторитетом', () => expect(chart([5, 15])).toMatchObject({ type: 'generator', authority: 'sacral' }));
  it('манифестирующий генератор: сакрал к горлу 20-34', () => expect(chart([20, 34])).toMatchObject({ type: 'manifesting-generator', authority: 'sacral' }));
  it('манифест. генератор через цепочку сакрал→G→горло', () =>
    expect(chart([2, 14, 1, 8])).toMatchObject({ type: 'manifesting-generator' }));
  it('манифестор: сердце к горлу 21-45', () => expect(chart([21, 45])).toMatchObject({ type: 'manifestor', authority: 'ego' }));
  it('манифестор с эмоциональным авторитетом 35-36', () => expect(chart([35, 36])).toMatchObject({ type: 'manifestor', authority: 'emotional' }));
  it('проектор с эмоциональным авторитетом (корень–сплетение без горла)', () =>
    expect(chart([19, 49])).toMatchObject({ type: 'projector', authority: 'emotional' }));
  it('проектор самопроецируемый: G–горло', () =>
    expect(chart([1, 8, 23, 43])).toMatchObject({ type: 'projector', authority: 'self', parts: 1 }));
  it('проектор с ментальным авторитетом', () => expect(chart([4, 63, 17, 62])).toMatchObject({ type: 'projector', authority: 'mental' }));
  it('проектор селезёночный', () => expect(chart([16, 48])).toMatchObject({ type: 'projector', authority: 'splenic' }));
  it('расщеплённая определённость', () => expect(chart([4, 63, 19, 49]).parts).toBe(2));
});

describe('сверка эфемерид со Swiss Ephemeris', () => {
  const bodies = ['sun', 'moon', 'northNode', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const;
  it(`${fixture.positions.length} случайных моментов 1930–2060: долготы ближе 1′, ворота/линии совпадают`, () => {
    let mismatches = 0;
    for (const row of fixture.positions) {
      const t = new Date(row.utc);
      for (const b of bodies) {
        const ref = (row as unknown as Record<string, number>)[b]!;
        const mine = hdLongitude(b as HdBody, t);
        const d = angDiffSec(mine, ref);
        expect(d, `${b} ${row.utc}`).toBeLessThan(60);
        const g1 = gateLine(mine);
        const g2 = gateLine(ref);
        if (g1.gate !== g2.gate || g1.line !== g2.line) {
          mismatches++;
          // Расхождение допустимо только на самой границе линии.
          expect(g2.marginDeg * 3600, `${b} ${row.utc}`).toBeLessThan(60);
        }
      }
    }
    expect(mismatches).toBeLessThanOrEqual(3);
  });
  it('момент Дизайна совпадает с расчётом Swiss Ephemeris (±2 мин)', () => {
    for (const d of fixture.designs) {
      const mine = designMoment(new Date(d.birthUtc));
      expect(Math.abs(mine.getTime() - new Date(d.designUtc).getTime())).toBeLessThan(120_000);
    }
  });
  it('Солнце Дизайна ровно на 88° позади', () => {
    const birth = new Date(fixture.designs[0]!.birthUtc);
    const des = designMoment(birth);
    expect(angDiffSec(planetLongitude('Sun', birth) - 88, planetLongitude('Sun', des))).toBeLessThan(1);
    const days = (birth.getTime() - des.getTime()) / 86400000;
    expect(days).toBeGreaterThan(85);
    expect(days).toBeLessThan(93);
  });
});

describe('бодиграф и транзиты', () => {
  const g: Bodygraph = bodygraphFromUtc(new Date('1985-03-10T09:30:00Z'));
  it('13 + 13 активаций, Земля напротив Солнца, Южный узел напротив Северного', () => {
    expect(g.personality.length).toBe(13);
    expect(g.design.length).toBe(13);
    const p = Object.fromEntries(g.personality.map((a) => [a.body, a.longitude]));
    expect(angDiffSec(p.earth! - 180, p.sun!)).toBeLessThan(0.001);
    expect(angDiffSec(p.southNode! - 180, p.northNode!)).toBeLessThan(0.001);
    expect(g.profile[0]).toBe(g.personality[0]!.line);
  });
  it('отрезки транзитов идут подряд без дыр, внутри ворота не меняются', () => {
    const from = new Date('2026-11-21T00:00:00Z');
    const to = new Date('2026-11-24T00:00:00Z');
    const segs = transitSegments(from, to);
    expect(segs[0]!.from).toEqual(from);
    expect(segs[segs.length - 1]!.to).toEqual(to);
    for (let i = 1; i < segs.length; i++) expect(segs[i]!.from).toEqual(segs[i - 1]!.to);
    // За трое суток Луна проходит 6–8 ворот
    expect(segs.length).toBeGreaterThanOrEqual(6);
    expect(segs.length).toBeLessThan(20);
  });
  it('транзитные каналы не включают свои каналы и центры', () => {
    const t = transitsBetween(g, new Date('2026-11-21T00:00:00Z'), new Date('2026-11-22T00:00:00Z'));
    const natal = new Set(g.channels.map((c) => c.join('-')));
    for (const c of t.channels) expect(natal.has(c.key)).toBe(false);
    for (const c of t.centers) expect(g.centers.has(c.center)).toBe(false);
    for (const h of t.gateHits) expect(g.gates.has(h.gate)).toBe(true);
    const lines = transitLines(g, t, 'Asia/Yekaterinburg');
    expect(lines[0]).toMatch(/^Тема дня для всех: ворота \d+/);
    for (const l of lines) expect(l).not.toMatch(/undefined|NaN/);
  });
  it('разбор транзитов по смыслу: тема, в тебе, извне, фон, стратегия типа', () => {
    const t = transitsBetween(g, new Date('2026-11-21T00:00:00Z'), new Date('2026-11-22T00:00:00Z'));
    const st = transitStory(g, t, 'Asia/Yekaterinburg');
    expect(st.theme.name).toBeTruthy();
    expect(st.type.strategy).toBeTruthy();
    expect(st.mine.length + st.open.length + st.shared.length).toBeGreaterThan(0);
    for (const x of [...st.mine, ...st.open, ...st.shared]) expect(JSON.stringify(x)).not.toMatch(/undefined|NaN/);
  });
  it('описание бодиграфа без пропусков', () => {
    for (const l of hdProfileLines(g)) expect(l).not.toMatch(/undefined|NaN/);
  });
  it('ворота каждой активации лежат в своём центре', () => {
    for (const a of [...g.personality, ...g.design]) expect(GATE_CENTER[a.gate]).toBeTruthy();
  });
});
