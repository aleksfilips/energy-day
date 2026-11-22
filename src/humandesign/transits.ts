/**
 * Транзиты дня относительно личного бодиграфа.
 *
 * Как читается транзит:
 *  • «Ваши ворота включены» — планета дня стоит в воротах, которые уже есть в бодиграфе.
 *  • «Канал замыкается» — у вас есть одни ворота канала, транзит даёт вторые (или обе),
 *    и на это время канал работает так, будто он ваш.
 *  • «Центр включён извне» — ваш открытый центр на время становится определённым.
 */
import { activationsAt, type Bodygraph, type BodyActivation } from './chart';
import { CENTERS, definedCenters, definedChannels, channelKey, type Center } from './graph';
import type { HdBody } from './positions';
import { dayBounds, type DateKey } from '../astro/time';

export interface TransitSegment {
  from: Date;
  to: Date;
  activations: BodyActivation[];
}

export type ChannelKind = 'completes' | 'transit-only';

export interface TransitWindow {
  from: Date;
  to: Date;
}

export interface ChannelTransit {
  key: string;
  gates: readonly [number, number];
  kind: ChannelKind;
  /** Какие планеты дают недостающие ворота. */
  bodies: HdBody[];
  windows: TransitWindow[];
}

export interface CenterTransit {
  center: Center;
  windows: TransitWindow[];
}

export interface GateHit {
  gate: number;
  body: HdBody;
  windows: TransitWindow[];
}

export interface DayTransits {
  from: Date;
  to: Date;
  segments: TransitSegment[];
  channels: ChannelTransit[];
  centers: CenterTransit[];
  gateHits: GateHit[];
  /** Солнце и Земля дня (общая тема для всех) — на середину дня. */
  sun: BodyActivation;
  earth: BodyActivation;
}

const STEP_MS = 20 * 60_000;
const gateSig = (acts: BodyActivation[]) => acts.map((a) => a.gate).join(',');

/** Разбивает интервал на отрезки, внутри которых ни одна планета не меняет ворота. */
export function transitSegments(from: Date, to: Date): TransitSegment[] {
  const segs: TransitSegment[] = [];
  let segStart = from;
  let cur = activationsAt(from);
  let t = from.getTime();
  while (t < to.getTime()) {
    const next = Math.min(t + STEP_MS, to.getTime());
    const nextActs = activationsAt(new Date(next));
    if (gateSig(nextActs) !== gateSig(cur)) {
      // Уточняем момент смены делением пополам до минуты.
      let lo = t;
      let hi = next;
      while (hi - lo > 30_000) {
        const mid = (lo + hi) / 2;
        if (gateSig(activationsAt(new Date(mid))) === gateSig(cur)) lo = mid;
        else hi = mid;
      }
      // hi — первый момент уже с новыми воротами (точность ±30 с).
      const change = new Date(hi);
      segs.push({ from: segStart, to: change, activations: cur });
      segStart = change;
      cur = activationsAt(change);
      // Если за этот шаг сменилось несколько ворот, следующий проход их тоже найдёт.
      t = change.getTime();
      continue;
    }
    t = next;
  }
  segs.push({ from: segStart, to, activations: cur });
  return segs.filter((s) => s.to.getTime() > s.from.getTime());
}

function addWindow(list: TransitWindow[], from: Date, to: Date) {
  const last = list[list.length - 1];
  if (last && last.to.getTime() === from.getTime()) last.to = to;
  else list.push({ from, to });
}

export function transitsBetween(chart: Bodygraph, from: Date, to: Date): DayTransits {
  const segments = transitSegments(from, to);
  const natalChannels = new Set(chart.channels.map(channelKey));
  const channels = new Map<string, ChannelTransit>();
  const centers = new Map<Center, CenterTransit>();
  const hits = new Map<string, GateHit>();

  for (const seg of segments) {
    const tGates = new Set(seg.activations.map((a) => a.gate));
    const all = new Set<number>([...chart.gates, ...tGates]);
    const chs = definedChannels(all).filter((c) => !natalChannels.has(channelKey(c)));
    for (const ch of chs) {
      const key = channelKey(ch);
      const kind: ChannelKind = chart.gates.has(ch[0]) || chart.gates.has(ch[1]) ? 'completes' : 'transit-only';
      const bodies = seg.activations.filter((a) => (a.gate === ch[0] || a.gate === ch[1]) && !chart.gates.has(a.gate)).map((a) => a.body);
      let ct = channels.get(key);
      if (!ct) channels.set(key, (ct = { key, gates: ch, kind, bodies: [], windows: [] }));
      for (const b of bodies) if (!ct.bodies.includes(b)) ct.bodies.push(b);
      addWindow(ct.windows, seg.from, seg.to);
    }
    const nowDefined = definedCenters([...chart.channels, ...chs]);
    for (const c of CENTERS) {
      if (chart.centers.has(c) || !nowDefined.has(c)) continue;
      let ct = centers.get(c);
      if (!ct) centers.set(c, (ct = { center: c, windows: [] }));
      addWindow(ct.windows, seg.from, seg.to);
    }
    for (const a of seg.activations) {
      if (!chart.gates.has(a.gate)) continue;
      const key = `${a.body}:${a.gate}`;
      let h = hits.get(key);
      if (!h) hits.set(key, (h = { gate: a.gate, body: a.body, windows: [] }));
      addWindow(h.windows, seg.from, seg.to);
    }
  }

  const mid = activationsAt(new Date((from.getTime() + to.getTime()) / 2));
  return {
    from,
    to,
    segments,
    channels: [...channels.values()],
    centers: [...centers.values()],
    gateHits: [...hits.values()],
    sun: mid.find((a) => a.body === 'sun')!,
    earth: mid.find((a) => a.body === 'earth')!,
  };
}

/** Транзиты за календарные сутки в часовом поясе пользователя. */
export function dayTransits(chart: Bodygraph, key: DateKey, timeZone: string): DayTransits {
  const { start, end } = dayBounds(key, timeZone);
  return transitsBetween(chart, start, end);
}
