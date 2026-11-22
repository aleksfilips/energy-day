/**
 * Бодиграф: 9 центров, 36 каналов, 64 ворот в стандартной раскладке.
 * Рисуется на «ночной» карточке в обеих темах (как драгоценность в футляре): так золото и
 * сияние транзита одинаково читаются и на тёмном, и на светлом экране (D-133).
 * Золото — твоё с рождения, голубое сияние — что включает транзит.
 */
import { useId } from 'react';
import { CHANNELS, GATE_CENTER, type Center } from '../../humandesign/graph';
import type { GraphLayer, GraphView } from '../../humandesign/overlay';

type P = readonly [number, number];

/** Палитра «ночной» карточки: не зависит от темы приложения. */
export const NIGHT = {
  bgA: '#1b2342',
  bgB: '#0b1020',
  ink: '#f4eee3',
  muted: '#b4bacb',
  faint: '#7d859c',
  line: 'rgba(255,255,255,0.08)',
  gold: '#ecc98f',
  goldA: '#f8e3b5',
  goldB: '#c8924a',
  blue: '#8fb8ff',
  blueA: '#b9d5ff',
  blueB: '#5d7fe6',
  pin: '#0e1428',
} as const;

/** Точки ворот на схеме (viewBox 320 × 480). */
export const GATE_XY: Record<number, P> = {
  // Теменной
  64: [143, 56], 61: [160, 56], 63: [177, 56],
  // Аджна
  47: [143, 92], 24: [160, 92], 4: [177, 92], 17: [147, 108], 11: [173, 108], 43: [160, 126],
  // Горло
  62: [143, 166], 23: [160, 166], 56: [177, 166], 16: [137, 180], 20: [137, 200], 35: [183, 176], 12: [183, 190], 45: [183, 204],
  31: [146, 212], 8: [160, 212], 33: [174, 212],
  // Джи
  1: [160, 240], 7: [148, 252], 13: [172, 252], 10: [136, 264], 25: [184, 264], 15: [148, 276], 46: [172, 276], 2: [160, 288],
  // Сердце (Эго)
  21: [236, 279], 51: [219, 290], 26: [226, 302], 40: [245, 302],
  // Селезёнка
  48: [26, 316], 57: [38, 326], 44: [51, 334], 50: [65, 342], 32: [51, 352], 28: [38, 361], 18: [26, 370],
  // Солнечное сплетение
  36: [294, 316], 22: [282, 326], 37: [269, 334], 6: [255, 342], 49: [269, 352], 55: [282, 361], 30: [294, 370],
  // Сакрал
  5: [146, 342], 14: [160, 342], 29: [174, 342], 34: [136, 356], 27: [136, 376], 59: [184, 376], 42: [146, 392], 3: [160, 392], 9: [174, 392],
  // Корень
  53: [146, 426], 60: [160, 426], 52: [174, 426], 54: [136, 438], 38: [136, 452], 58: [136, 466], 19: [184, 438], 39: [184, 452], 41: [184, 466],
};

const CENTER_SHAPE: Record<Center, string> = {
  head: 'M160 14 L190 64 L130 64 Z',
  ajna: 'M130 84 L190 84 L160 134 Z',
  throat: 'M131 158 H189 V220 H131 Z',
  g: 'M160 226 L198 264 L160 302 L122 264 Z',
  heart: 'M236 266 L256 310 L210 310 Z',
  spleen: 'M18 304 L78 343 L18 382 Z',
  solar: 'M302 304 L242 343 L302 382 Z',
  sacral: 'M129 334 H191 V400 H129 Z',
  root: 'M129 418 H191 V474 H129 Z',
};

/** Звёзды фона — фиксированные, чтобы картинка не «прыгала». */
const STARS: [number, number, number][] = [
  [22, 40, 0.8], [58, 120, 0.6], [290, 60, 0.9], [270, 150, 0.6], [30, 230, 0.7], [300, 240, 0.5], [92, 200, 0.5],
  [240, 420, 0.7], [70, 440, 0.6], [300, 460, 0.5], [110, 20, 0.5], [214, 30, 0.7], [250, 210, 0.5], [16, 452, 0.6],
];

export function BodygraphSvg({ g, layer, mini = false, className }: { g: GraphView; layer: GraphLayer; mini?: boolean; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const id = (s: string) => `${s}-${uid}`;
  const natalGates = new Set(g.natalGates);
  const natalCenters = new Set(g.natalCenters);
  const trCenters = new Set(layer.centers);
  const trChannels = new Set(layer.channels);
  const natalChannels = new Set(g.natalChannels);
  const trGate = (n: number) => layer.gates[n] !== undefined;

  return (
    <svg viewBox="0 0 320 480" className={className} role="img" aria-label="Бодиграф">
      <defs>
        <linearGradient id={id('gold')} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={NIGHT.goldA} />
          <stop offset="1" stopColor={NIGHT.goldB} />
        </linearGradient>
        <linearGradient id={id('blue')} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={NIGHT.blueA} />
          <stop offset="1" stopColor={NIGHT.blueB} />
        </linearGradient>
        <radialGradient id={id('halo')} cx="0.5" cy="0.52" r="0.55">
          <stop offset="0" stopColor="#3a4a86" stopOpacity="0.55" />
          <stop offset="1" stopColor="#3a4a86" stopOpacity="0" />
        </radialGradient>
        <filter id={id('glow')} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={mini ? 3 : 5} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={id('soft')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse cx="160" cy="250" rx="175" ry="250" fill={`url(#${id('halo')})`} />
      {!mini && STARS.map(([x, y, o], i) => <circle key={i} cx={x} cy={y} r={0.9} fill="#fff8e6" opacity={o * 0.7} />)}

      {/* Каналы: тонкая дорожка, поверх — половинки активных ворот. */}
      {CHANNELS.map(([a, b]) => {
        const pa = GATE_XY[a]!;
        const pb = GATE_XY[b]!;
        const mid: P = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
        const key = `${a}-${b}`;
        const lit = trChannels.has(key);
        const whole = lit || natalChannels.has(key);
        const w = whole ? 5.2 : 3.2;
        const half = (p: P, n: number) => {
          const natal = natalGates.has(n);
          const tr = trGate(n);
          if (!natal && !tr) return null;
          return <line x1={p[0]} y1={p[1]} x2={mid[0]} y2={mid[1]} stroke={natal ? NIGHT.gold : NIGHT.blue} strokeOpacity={whole ? 1 : 0.75} strokeWidth={w} strokeLinecap="round" />;
        };
        return (
          <g key={key} filter={lit ? `url(#${id('glow')})` : undefined}>
            <line x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke={NIGHT.line} strokeWidth={4.4} strokeLinecap="round" />
            {half(pa, a)}
            {half(pb, b)}
          </g>
        );
      })}

      {/* Центры. */}
      {(Object.keys(CENTER_SHAPE) as Center[]).map((c) => {
        const natal = natalCenters.has(c);
        const tr = trCenters.has(c);
        return (
          <g key={c} filter={tr ? `url(#${id('glow')})` : natal ? `url(#${id('soft')})` : undefined}>
            <path
              d={CENTER_SHAPE[c]}
              fill={natal ? `url(#${id('gold')})` : tr ? `url(#${id('blue')})` : 'rgba(255,255,255,0.035)'}
              stroke={natal ? NIGHT.goldA : tr ? NIGHT.blueA : 'rgba(220,228,255,0.34)'}
              strokeWidth={natal || tr ? 1 : 1.1}
              strokeLinejoin="round"
            >
              {tr && !mini && <animate attributeName="opacity" values="1;0.82;1" dur="3.6s" repeatCount="indefinite" />}
            </path>
          </g>
        );
      })}

      {/* Ворота. */}
      {!mini &&
        Object.entries(GATE_XY).map(([k, [x, y]]) => {
          const n = Number(k);
          const natal = natalGates.has(n);
          const tr = trGate(n);
          const c = GATE_CENTER[n]!;
          const onFilled = natalCenters.has(c) || trCenters.has(c);
          if (!natal && !tr)
            return (
              <text key={k} x={x} y={y + 2.3} textAnchor="middle" fontSize={6.2} fontWeight={500} fill={onFilled ? NIGHT.pin : NIGHT.muted} fillOpacity={onFilled ? 0.55 : 0.7}>
                {n}
              </text>
            );
          return (
            <g key={k}>
              {tr && <circle cx={x} cy={y} r={8.2} fill="none" stroke={NIGHT.blueA} strokeWidth={1.4} />}
              <circle cx={x} cy={y} r={6.4} fill={natal ? NIGHT.pin : NIGHT.blueA} stroke={natal ? NIGHT.gold : 'none'} strokeWidth={0.8} />
              <text x={x} y={y + 2.3} textAnchor="middle" fontSize={6.6} fontWeight={700} fill={natal ? NIGHT.goldA : NIGHT.pin}>
                {n}
              </text>
            </g>
          );
        })}
    </svg>
  );
}
