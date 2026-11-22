/**
 * Что рисовать на бодиграфе: своё (определённое с рождения) и то, что включает транзит —
 * за весь день или в конкретный момент.
 */
import type { Bodygraph } from './chart';
import type { DayTransits, TransitSegment } from './transits';
import { CENTERS, channelKey, definedCenters, definedChannels, type Center } from './graph';
import type { HdBody } from './positions';

export interface GraphLayer {
  /** Ворота, в которых стоят планеты транзита, и какие именно планеты. */
  gates: Record<number, HdBody[]>;
  /** Каналы, которых нет с рождения, но которые транзит делает определёнными. */
  channels: string[];
  /** Открытые центры, определённые транзитом. */
  centers: Center[];
}

export interface GraphView {
  natalGates: number[];
  natalChannels: string[];
  natalCenters: Center[];
  day: GraphLayer;
  /** Слой на текущий момент (если момент попадает в эти сутки). */
  now: GraphLayer | null;
}

function layer(chart: Bodygraph, segs: TransitSegment[]): GraphLayer {
  const gates: Record<number, HdBody[]> = {};
  const channels = new Set<string>();
  const centers = new Set<Center>();
  const natal = new Set(chart.channels.map(channelKey));
  for (const s of segs) {
    for (const a of s.activations) {
      const list = (gates[a.gate] ??= []);
      if (!list.includes(a.body)) list.push(a.body);
    }
    const chs = definedChannels(new Set([...chart.gates, ...s.activations.map((a) => a.gate)])).filter((c) => !natal.has(channelKey(c)));
    for (const c of chs) channels.add(channelKey(c));
    for (const c of definedCenters([...chart.channels, ...chs])) if (!chart.centers.has(c)) centers.add(c);
  }
  return { gates, channels: [...channels], centers: CENTERS.filter((c) => centers.has(c)) };
}

export function graphView(chart: Bodygraph, t: DayTransits, now?: Date): GraphView {
  const nowSeg = now ? t.segments.find((s) => s.from.getTime() <= now.getTime() && now.getTime() < s.to.getTime()) : undefined;
  return {
    natalGates: [...chart.gates].sort((a, b) => a - b),
    natalChannels: chart.channels.map(channelKey),
    natalCenters: CENTERS.filter((c) => chart.centers.has(c)),
    day: layer(chart, t.segments),
    now: nowSeg ? layer(chart, [nowSeg]) : null,
  };
}
