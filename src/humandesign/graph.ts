/** Центры, ворота и каналы бодиграфа (стандартная схема из 9 центров и 36 каналов). */

export type Center =
  | 'head'
  | 'ajna'
  | 'throat'
  | 'g'
  | 'heart'
  | 'spleen'
  | 'solar'
  | 'sacral'
  | 'root';

export const CENTERS: readonly Center[] = ['head', 'ajna', 'throat', 'g', 'heart', 'spleen', 'solar', 'sacral', 'root'];

/** Моторы: центры, которые дают энергию. */
export const MOTORS: readonly Center[] = ['heart', 'solar', 'sacral', 'root'];

export const CENTER_GATES: Record<Center, readonly number[]> = {
  head: [64, 61, 63],
  ajna: [47, 24, 4, 17, 43, 11],
  throat: [62, 23, 56, 35, 12, 45, 33, 8, 31, 20, 16],
  g: [1, 13, 25, 46, 2, 15, 10, 7],
  heart: [21, 40, 26, 51],
  spleen: [48, 57, 44, 50, 32, 28, 18],
  solar: [36, 22, 37, 6, 49, 55, 30],
  sacral: [5, 14, 29, 59, 9, 3, 42, 27, 34],
  root: [53, 60, 52, 19, 39, 41, 58, 38, 54],
};

export const GATE_CENTER: Record<number, Center> = Object.fromEntries(
  (Object.entries(CENTER_GATES) as [Center, readonly number[]][]).flatMap(([c, gs]) => gs.map((g) => [g, c])),
) as Record<number, Center>;

/** 36 каналов; ворота в паре записаны по возрастанию. */
export const CHANNELS: readonly (readonly [number, number])[] = [
  [1, 8], [2, 14], [3, 60], [4, 63], [5, 15], [6, 59], [7, 31], [9, 52], [10, 20], [10, 34], [10, 57],
  [11, 56], [12, 22], [13, 33], [16, 48], [17, 62], [18, 58], [19, 49], [20, 34], [20, 57], [21, 45],
  [23, 43], [24, 61], [25, 51], [26, 44], [27, 50], [28, 38], [29, 46], [30, 41], [32, 54], [34, 57],
  [35, 36], [37, 40], [39, 55], [42, 53], [47, 64],
];

export function channelKey(ch: readonly [number, number]): string {
  return `${ch[0]}-${ch[1]}`;
}

export function channelCenters(ch: readonly [number, number]): [Center, Center] {
  return [GATE_CENTER[ch[0]]!, GATE_CENTER[ch[1]]!];
}

/** Каналы, полностью замкнутые данным набором ворот. */
export function definedChannels(gates: ReadonlySet<number>): (readonly [number, number])[] {
  return CHANNELS.filter(([a, b]) => gates.has(a) && gates.has(b));
}

export function definedCenters(channels: readonly (readonly [number, number])[]): Set<Center> {
  const s = new Set<Center>();
  for (const ch of channels) for (const c of channelCenters(ch)) s.add(c);
  return s;
}

/** Группы связанных между собой определённых центров. */
export function components(channels: readonly (readonly [number, number])[]): Center[][] {
  const adj = new Map<Center, Set<Center>>();
  for (const ch of channels) {
    const [a, b] = channelCenters(ch);
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  }
  const seen = new Set<Center>();
  const out: Center[][] = [];
  for (const start of CENTERS) {
    if (!adj.has(start) || seen.has(start)) continue;
    const comp: Center[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const c = stack.pop()!;
      comp.push(c);
      for (const n of adj.get(c)!) if (!seen.has(n)) (seen.add(n), stack.push(n));
    }
    out.push(comp);
  }
  return out;
}

/** Есть ли путь по определённым каналам между двумя центрами. */
export function connected(channels: readonly (readonly [number, number])[], a: Center, b: Center): boolean {
  return components(channels).some((comp) => comp.includes(a) && comp.includes(b));
}
