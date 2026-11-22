import { describe, expect, it } from 'vitest';
import { GATE_XY, insideCenter } from '../../src/app/screens/Bodygraph';
import { CHANNELS as ALL_CHANNELS } from '../../src/humandesign/graph';
import { gateHalves } from '../../src/app/screens/Bodygraph';
import { CHANNEL_D, GATES, HALF_D, INTEGRATION_D } from '../../src/app/screens/bodygraphGeometry';

/** Первая и последняя точки SVG-пути. */
function ends(d: string): [[number, number], [number, number]] {
  const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  return [[n[0]!, n[1]!], [n[n.length - 2]!, n[n.length - 1]!]];
}
import { GATE_CENTER, CENTER_GATES, type Center } from '../../src/humandesign/graph';
import { bodygraphFromUtc } from '../../src/humandesign/chart';
import { dayTransits } from '../../src/humandesign/transits';
import { graphView } from '../../src/humandesign/overlay';

describe('схема бодиграфа', () => {
  it('у всех 64 ворот есть точка', () => {
    expect(Object.keys(GATE_XY).length).toBe(64);
    for (let g = 1; g <= 64; g++) expect(GATE_XY[g]).toBeTruthy();
  });
  it('каждые ворота нарисованы внутри своего центра', () => {
    for (const [c, gates] of Object.entries(CENTER_GATES) as [Center, readonly number[]][]) {
      for (const g of gates) {
        expect(GATE_CENTER[g]).toBe(c);
        expect(insideCenter(c, GATE_XY[g]!), `ворота ${g} в центре ${c}`).toBe(true);
      }
    }
  });
  it('шаблон: 36 каналов, у каждых ворот свой центр как в разметке', () => {
    expect(Object.keys(CHANNEL_D).length).toBe(36);
    for (const [a, b] of ALL_CHANNELS) expect(CHANNEL_D[`${a}-${b}`], `${a}-${b}`).toBeTruthy();
    const key: Record<string, string> = { sp: 'solar' };
    for (let n = 1; n <= 64; n++) expect(key[GATES[n]!.center] ?? GATES[n]!.center, `ворота ${n}`).toBe(GATE_CENTER[n]);
  });
  it('половины канала начинаются у своих ворот и смыкаются в одной точке', () => {
    const d = (p: [number, number], q: [number, number]) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    for (const [a, b] of ALL_CHANNELS) {
      const k = `${a}-${b}`;
      // Один конец половины — у своих ворот (в центре или у точки входа), другой — общая точка встречи.
      const atGate = (n: number, p: [number, number]) => insideCenter(GATE_CENTER[n]!, p) || d(p, [...GATES[n]!.anchor] as [number, number]) < 25;
      const split = (n: number, path: string) => {
        const [p, q] = ends(path);
        expect(atGate(n, p) || atGate(n, q), `${k}: половина у ${n}`).toBe(true);
        return atGate(n, p) ? q : p;
      };
      const ea = split(a, HALF_D[k]?.[a] ?? INTEGRATION_D[a]!);
      const eb = split(b, HALF_D[k]?.[b] ?? INTEGRATION_D[b]!);
      expect(d(ea, eb), k).toBeLessThan(0.5);
    }
  });
  it('у каждых ворот есть что подсветить', () => {
    for (let n = 1; n <= 64; n++) expect(gateHalves(n).length, `ворота ${n}`).toBeGreaterThan(0);
  });
});

describe('что подсвечивается', () => {
  const chart = bodygraphFromUtc(new Date('1985-03-10T09:30:00Z'));
  const t = dayTransits(chart, '2026-11-22', 'Asia/Yekaterinburg');
  it('слой дня = все каналы и центры из разбора транзитов', () => {
    const v = graphView(chart, t);
    expect(v.day.channels.sort()).toEqual(t.channels.map((c) => c.key).sort());
    expect(v.day.centers.sort()).toEqual(t.centers.map((c) => c.center).sort());
    expect(v.now).toBeNull();
    for (const c of v.day.centers) expect(v.natalCenters).not.toContain(c);
  });
  it('слой «сейчас» — ворота планет в этот момент, и он часть слоя дня', () => {
    const v = graphView(chart, t, new Date('2026-11-22T07:00:00Z'));
    // Swiss Ephemeris, 22.11.2026 07:00 UTC.
    const ref: Record<string, number> = { sun: 14, moon: 3, northNode: 30, mercury: 44, venus: 32, mars: 29, jupiter: 29, saturn: 17, uranus: 20, neptune: 25, pluto: 41, earth: 8, southNode: 29 };
    const got: Record<string, number> = {};
    for (const [g, bodies] of Object.entries(v.now!.gates)) for (const b of bodies) got[b] = Number(g);
    expect(got).toEqual(ref);
    for (const c of v.now!.channels) expect(v.day.channels).toContain(c);
    for (const c of v.now!.centers) expect(v.day.centers).toContain(c);
  });
});
