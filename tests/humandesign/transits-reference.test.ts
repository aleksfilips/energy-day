/**
 * Транзиты Дизайна человека против независимого эталона: Swiss Ephemeris (полные файлы) + отдельный
 * расчёт ворот, каналов, центров и границ суток на Python (scripts/verify-hd-transits.py).
 * Дни с переходом на летнее/зимнее время, ретроградными планетами и сменой ворот у Нептуна.
 */
import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/hd-transits-swisseph.json';
import ingress from '../../src/humandesign/data/ingress.json';
import { bodygraphFromUtc, activationsAt } from '../../src/humandesign/chart';
import { dayTransits, tableGate, transitActivationsAt } from '../../src/humandesign/transits';
import { transitStory, sunPeriods } from '../../src/humandesign/summary';
import { GATE_ORDER } from '../../src/humandesign/wheel';
import type { HdBody } from '../../src/humandesign/positions';

const TOL_S = 60; // на экране время показывается до минуты
const sec = (a: string | Date, b: string | Date) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 1000;
const AUTH: Record<string, string> = { 'mental/none': 'mental' };

describe('транзиты против Swiss Ephemeris (независимый расчёт)', () => {
  for (const c of fixture.cases) {
    const chart = bodygraphFromUtc(new Date(c.birthUtc));
    describe(`${c.chart}, ${c.timeZone}`, () => {
      it('бодиграф совпадает', () => {
        expect([...chart.gates].sort((a, b) => a - b)).toEqual(c.expectChart.gates);
        expect(chart.channels.map((x) => x.join('-')).sort()).toEqual(c.expectChart.channels);
        expect(chart.type).toBe(c.expectChart.type);
        expect(chart.authority).toBe(AUTH[c.expectChart.authority] ?? c.expectChart.authority);
        expect(chart.profile).toEqual(c.expectChart.profile);
      });
      for (const d of c.days) {
        it(d.key, () => {
          const t = dayTransits(chart, d.key, c.timeZone);
          // Границы суток в часовом поясе человека.
          expect(t.from.toISOString().slice(0, 19)).toBe(d.from.slice(0, 19));
          expect(t.to.toISOString().slice(0, 19)).toBe(d.to.slice(0, 19));
          // Каждая смена ворот: то же тело, те же ворота, время ±1 мин.
          const ours: [Date, string, number, number][] = [];
          for (let i = 1; i < t.segments.length; i++) {
            const p = t.segments[i - 1]!.activations;
            t.segments[i]!.activations.forEach((a, k) => {
              if (a.gate !== p[k]!.gate) ours.push([t.segments[i]!.from, a.body, p[k]!.gate, a.gate]);
            });
          }
          const key = (x: { 1: string; 2: number; 3: number }) => `${x[1]}:${x[2]}>${x[3]}`;
          expect(ours.map(key).sort()).toEqual(d.changes.map((x) => key(x as never)).sort());
          for (const e of d.changes) {
            const o = ours.find((x) => key(x) === key(e as never))!;
            expect(sec(o[0], e[0] as string)).toBeLessThan(TOL_S);
          }
          // Каналы, центры и попадания в свои ворота — тот же набор и те же окна.
          const win = (ws: { from: Date; to: Date }[], ref: string[][]) => {
            expect(ws.length).toBe(ref.length);
            ws.forEach((w, i) => {
              expect(sec(w.from, ref[i]![0]!)).toBeLessThan(TOL_S);
              expect(sec(w.to, ref[i]![1]!)).toBeLessThan(TOL_S);
            });
          };
          const refCh = d.channels as unknown as Record<string, { kind: string; windows: string[][] }>;
          expect(t.channels.map((x) => x.key).sort()).toEqual(Object.keys(refCh).sort());
          for (const ch of t.channels) {
            expect(ch.kind).toBe(refCh[ch.key]!.kind);
            win(ch.windows, refCh[ch.key]!.windows);
          }
          const refCe = d.centers as unknown as Record<string, string[][]>;
          expect(t.centers.map((x) => x.center).sort()).toEqual(Object.keys(refCe).sort());
          for (const ce of t.centers) win(ce.windows, refCe[ce.center]!);
          const refH = d.hits as unknown as Record<string, string[][]>;
          expect(t.gateHits.map((h) => `${h.body}:${h.gate}`).sort()).toEqual(Object.keys(refH).sort());
          for (const h of t.gateHits) win(h.windows, refH[`${h.body}:${h.gate}`]!);
        });
      }
    });
  }
});

describe('таблица смен ворот (Swiss Ephemeris) согласуется с нашим движком', () => {
  it('в момент каждой смены по таблице наш расчёт даёт те же или соседние ворота', () => {
    const from = Date.parse(ingress.from);
    let n = 0;
    for (const [body, rows] of Object.entries(ingress.bodies) as [HdBody, [number, number][]][]) {
      for (const [s, g] of rows.slice(1)) {
        const at = new Date(from + s * 1000 + 1000);
        const ours = activationsAt(at).find((a) => a.body === body)!.gate;
        const i = GATE_ORDER.indexOf(g);
        expect([g, GATE_ORDER[(i + 63) % 64], GATE_ORDER[(i + 1) % 64]]).toContain(ours);
        expect(tableGate(body, at)).toBe(g);
        n++;
      }
    }
    expect(n).toBeGreaterThan(3000);
  });
  it('вне таблицы — обычный расчёт', () => {
    const d = new Date('2050-06-01T00:00:00Z');
    expect(tableGate('neptune', d)).toBeNull();
    expect(transitActivationsAt(d)).toEqual(activationsAt(d));
  });
});

describe('текст карточки', () => {
  const chart = bodygraphFromUtc(new Date('1985-03-10T09:30:00Z'));
  it('день смены ворот Солнца: тема дня из двух частей с моментом смены', () => {
    // 22.11.2026 Солнце переходит из ворот 14 в 34 в 15:21:5x по Екатеринбургу (Swiss Ephemeris), на экране 15:22.
    const t = dayTransits(chart, '2026-11-22', 'Asia/Yekaterinburg');
    const ps = sunPeriods(t);
    expect(ps.map((p) => p.gate)).toEqual([14, 34]);
    const st = transitStory(chart, t, 'Asia/Yekaterinburg');
    expect(st.theme.periods.map((p) => p.when)).toEqual(['До 15:22', 'С 15:22']);
  });
  it('все открытые центры, определённые транзитом, показаны (без обрезки)', () => {
    for (const key of ['2026-11-20', '2026-11-24', '2026-12-01']) {
      const t = dayTransits(chart, key, 'Asia/Yekaterinburg');
      expect(transitStory(chart, t, 'Asia/Yekaterinburg').open.length).toBe(t.centers.length);
    }
  });
  it('канал через твои ворота называет планету, которая его замыкает', () => {
    const t = dayTransits(chart, '2026-11-22', 'Asia/Yekaterinburg');
    const st = transitStory(chart, t, 'Asia/Yekaterinburg');
    for (const m of st.mine.filter((x) => x.title.startsWith('Канал'))) expect(m.text).toMatch(/\((Солнце|Земля|Луна|Меркурий|Венера|Марс|Юпитер|Сатурн|Уран|Нептун|Плутон|Северный узел|Южный узел)/);
  });
});
