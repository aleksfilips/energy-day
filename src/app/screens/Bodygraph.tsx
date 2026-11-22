/**
 * Бодиграф в классической раскладке (как в карте рейв-чарта): силуэт человека, 9 центров своих форм и цветов,
 * 36 каналов «трубками», ворота на центрах. Личность (сознательное) — чёрным, Дизайн (бессознательное) — красным,
 * транзит — синим. Две палитры: светлая (белая карточка) и ночная (тёмная карточка) — D-134.
 * Геометрия — шаблон пользователя 1:1 (bodygraphGeometry.ts, холст 1356×1908).
 */
import { useId } from 'react';
import { CHANNELS, GATE_CENTER, type Center } from '../../humandesign/graph';
import type { GraphLayer, GraphView } from '../../humandesign/overlay';
import { CANVAS, CENTER_D, CHANNEL_D, GATES, HALF_D, INTEGRATION_D, PIPE, SILHOUETTE_F, SILHOUETTE_M } from './bodygraphGeometry';

type P = readonly [number, number];

/** Палитра «ночной» карточки (спотлайт на «Сегодня», тёмная тема). */
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

export type GraphTone = 'light' | 'night';

export interface GraphPalette {
  silhouette: string;
  tube: string;
  open: string;
  openStroke: string;
  num: string;
  personality: string;
  design: string;
  transit: string;
  gate: string;
  gateNum: string;
}

/**
 * Фирменные цвета бодиграфа (D-135): рождение — золото, Личность — золото, Дизайн — бордо, транзит — синий.
 * Основа (силуэт, каналы) — по шаблону пользователя.
 */
export const PALETTE: Record<GraphTone, GraphPalette> = {
  light: {
    silhouette: '#e5e4ef',
    tube: '#ffffff',
    open: '#ffffff',
    openStroke: '#d9cdb6',
    num: '#6b6577',
    personality: '#c8924a',
    design: '#9c2f47',
    transit: '#3d74ec',
    gate: '#1d1a24',
    gateNum: '#f8e3b5',
  },
  night: {
    silhouette: '#252e52',
    tube: '#3a4570',
    open: 'rgba(255,255,255,0.07)',
    openStroke: 'rgba(236,201,143,0.35)',
    num: '#b4bacb',
    personality: '#ecc98f',
    design: '#c4566c',
    transit: '#8fb8ff',
    gate: '#0e1428',
    gateNum: '#f8e3b5',
  },
};

/** Градиенты центров: определённый с рождения — золото, от транзита — синий. */
export const CENTER_FILL = {
  natal: ['#f8e3b5', '#c8924a'],
  transit: ['#b9d5ff', '#5d7fe6'],
} as const;

/** Видимая область шаблона: силуэт с небольшим полем (холст шаблона 1356×1908). */
export const VIEWBOX = { x: 60, y: 100, w: CANVAS.w - 120, h: 1730 } as const;

/** Центр подписи ворот. */
export const GATE_XY: Record<number, P> = Object.fromEntries(Object.entries(GATES).map(([k, v]) => [k, v.label]));

/** Ключ центра в шаблоне: Солнечное сплетение там называется sp. */
const shapeKey = (c: Center) => (c === 'solar' ? 'sp' : c);

/** Контур центра как многоугольник (для теста раскладки). */
function outline(c: Center): P[] {
  const s = CENTER_D[shapeKey(c)]!;
  if (s.kind === 'circle') return Array.from({ length: 48 }, (_, i) => [s.cx + s.r * Math.cos((i / 48) * 2 * Math.PI), s.cy + s.r * Math.sin((i / 48) * 2 * Math.PI)] as P);
  if (s.kind === 'rect') return [[s.x, s.y], [s.x + s.w, s.y], [s.x + s.w, s.y + s.h], [s.x, s.y + s.h]];
  const n = s.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const ps: P[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) ps.push([n[i]!, n[i + 1]!]);
  return ps;
}

/** Лежит ли точка внутри фигуры центра. */
export function insideCenter(c: Center, [x, y]: P): boolean {
  const ps = outline(c);
  let r = false;
  for (let i = 0, j = ps.length - 1; i < ps.length; j = i++) {
    const [xi, yi] = ps[i]!;
    const [xj, yj] = ps[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}

const INTEGRATION_GATES = new Set([10, 20, 34, 57]);

/** Все половины, которые подсвечиваются у ворот n (по одной на канал; у ворот интеграции — одна общая). */
export function gateHalves(n: number): { key: string; d: string }[] {
  if (INTEGRATION_GATES.has(n)) {
    const out = [{ key: `int-${n}`, d: INTEGRATION_D[n]! }];
    for (const [a, b] of CHANNELS) if ((a === n || b === n) && HALF_D[`${a}-${b}`]) out.push({ key: `${a}-${b}`, d: HALF_D[`${a}-${b}`]![n]! });
    return out;
  }
  return CHANNELS.filter(([a, b]) => a === n || b === n).map(([a, b]) => ({ key: `${a}-${b}`, d: HALF_D[`${a}-${b}`]![n]! }));
}

/* ───────────── Рисунок ───────────── */

export function BodygraphSvg({
  g,
  layer,
  mini = false,
  tone = 'night',
  silhouette = 'm',
  className,
}: {
  g: GraphView;
  layer: GraphLayer;
  mini?: boolean;
  tone?: GraphTone;
  silhouette?: 'm' | 'f';
  className?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const id = (s: string) => `${s}-${uid}`;
  const C = PALETTE[tone];
  const pers = new Set(g.personalityGates);
  const des = new Set(g.designGates);
  const natalCenters = new Set(g.natalCenters);
  const trCenters = new Set(layer.centers);
  const trGate = (n: number) => layer.gates[n] !== undefined;
  const W = mini ? PIPE * 1.25 : PIPE;

  /** Подсветка ворот n: все их половины одним цветом (или Дизайн + штрих Личности). */
  const lit = (n: number, transitOnly: boolean) => {
    const p = pers.has(n);
    const d = des.has(n);
    if (transitOnly ? p || d || !trGate(n) : !(p || d)) return null;
    const halves = gateHalves(n);
    const glow = layer.channels.some((k) => k.split('-').map(Number).includes(n));
    const line = { fill: 'none', strokeWidth: W, strokeLinecap: 'butt' as const, strokeLinejoin: 'round' as const };
    return (
      <g key={`${transitOnly ? 't' : 'n'}${n}`} filter={glow ? `url(#${id('glow')})` : undefined}>
        {halves.map((h) =>
          transitOnly ? (
            <path key={h.key} d={h.d} {...line} stroke={C.transit} />
          ) : p && d ? (
            <g key={h.key}>
              <path d={h.d} {...line} stroke={C.design} />
              <path d={h.d} {...line} stroke={C.personality} strokeDasharray="7 7" />
            </g>
          ) : (
            <path key={h.key} d={h.d} {...line} stroke={p ? C.personality : C.design} />
          ),
        )}
      </g>
    );
  };

  const shape = (c: Center, props: Record<string, unknown>) => {
    const s = CENTER_D[shapeKey(c)]!;
    if (s.kind === 'circle') return <circle cx={s.cx} cy={s.cy} r={s.r} {...props} />;
    if (s.kind === 'rect') return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} {...props} />;
    return <path d={s.d} {...props} />;
  };

  const gates = Array.from({ length: 64 }, (_, i) => i + 1);

  return (
    <svg viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}`} className={className} role="img" aria-label="Бодиграф">
      <defs>
        <filter id={id('glow')} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation={mini ? 9 : 11} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={id('gold')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CENTER_FILL.natal[0]} />
          <stop offset="1" stopColor={CENTER_FILL.natal[1]} />
        </linearGradient>
        <linearGradient id={id('blue')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CENTER_FILL.transit[0]} />
          <stop offset="1" stopColor={CENTER_FILL.transit[1]} />
        </linearGradient>
      </defs>

      {/* Силуэт */}
      <path d={silhouette === 'f' ? SILHOUETTE_F : SILHOUETTE_M} fill={C.silhouette} />

      {/* Каналы (трубки) */}
      <g fill="none" stroke={C.tube} strokeWidth={W} strokeLinecap="butt" strokeLinejoin="round">
        {CHANNELS.map(([a, b]) => (
          <path key={`${a}-${b}`} d={CHANNEL_D[`${a}-${b}`]} />
        ))}
      </g>

      {/* Транзит (под рождением), затем рождение */}
      {gates.map((n) => lit(n, true))}
      {gates.map((n) => lit(n, false))}

      {/* Центры */}
      {(Object.keys(CENTER_D) as string[]).map((k) => {
        const c = (k === 'sp' ? 'solar' : k) as Center;
        const natal = natalCenters.has(c);
        const tr = !natal && trCenters.has(c);
        const fill = natal ? `url(#${id('gold')})` : tr ? `url(#${id('blue')})` : C.open;
        const stroke = natal ? 'none' : tr ? CENTER_FILL.transit[0] : C.openStroke;
        return (
          <g key={c} filter={tr ? `url(#${id('glow')})` : undefined}>
            {shape(c, { fill, stroke, strokeWidth: tr ? 7 : 3, strokeLinejoin: 'round' })}
            {tr && !mini && <animate attributeName="opacity" values="1;0.8;1" dur="3.6s" repeatCount="indefinite" />}
          </g>
        );
      })}

      {/* Ворота */}
      {!mini && (
        <g fontFamily="Inter, 'SF Pro Text', -apple-system, Roboto, sans-serif" fontSize={23} textAnchor="middle">
          {gates.map((n) => {
            const { label, text } = GATES[n]!;
            const natal = pers.has(n) || des.has(n);
            const tr = trGate(n);
            if (!natal && !tr)
              return (
                <text key={n} x={text[0]} y={text[1]} fontWeight={500} fill={natalCenters.has(GATE_CENTER[n]!) ? '#6a4a1c' : trCenters.has(GATE_CENTER[n]!) ? '#14245a' : C.num}>
                  {n}
                </text>
              );
            return (
              <g key={n}>
                <circle cx={label[0]} cy={label[1]} r={21} fill={natal ? C.gate : C.transit} stroke={natal ? (tr ? C.transit : pers.has(n) ? C.personality : C.design) : '#e6efff'} strokeWidth={3.5} />
                <text x={text[0]} y={text[1]} fontWeight={600} fill={natal ? C.gateNum : '#0e1a40'}>
                  {n}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
