/** «Мандала» (D-148): круг 64 ворот и 12 знаков, планеты рождения на кольце, лучи к воротам бодиграфа, транзит по желанию. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Bodygraph, BodyActivation } from '../../../humandesign/chart';
import { detailOf, isRetrograde, quarterOf, QUARTER_TEXT, SIGN_GLYPH, SIGN_KEYS, SIGN_RU, type FullActivation, type Quarter } from '../../../humandesign/details';
import { transitActivationsAt } from '../../../humandesign/transits';
import { GATE_ORDER, GATE_SPAN, WHEEL_START } from '../../../humandesign/wheel';
import HEX from '../../../humandesign/data/hexagrams.json';
import { haptic } from '../../../telegram';
import { cx } from '../../ui';
import { GATE_XY } from '../Bodygraph';
import { ChartGraph, Info, Legend, Rubric, SIDE_COLOR, sideMarks, useTone } from './common';
import { PlanetSheet } from './ChartTab';

const C0 = 500;
const ang = (lon: number) => ((90 + (lon - 268.25)) * Math.PI) / 180;
const pt = (r: number, a: number): [number, number] => [C0 + r * Math.cos(a), C0 - r * Math.sin(a)];
const f1 = (n: number) => Math.round(n * 10) / 10;
function arcPath(r: number, l1: number, l2: number, cw: boolean) {
  const [x1, y1] = pt(r, ang(cw ? l2 : l1));
  const [x2, y2] = pt(r, ang(cw ? l1 : l2));
  return `M${f1(x1)} ${f1(y1)}A${r} ${r} 0 ${Math.abs(l2 - l1) > 180 ? 1 : 0} ${cw ? 1 : 0} ${f1(x2)} ${f1(y2)}`;
}
function sector(r1: number, r2: number, l1: number, l2: number) {
  const a1 = ang(l1);
  const a2 = ang(l2);
  const p1 = pt(r2, a1);
  const p2 = pt(r2, a2);
  const p3 = pt(r1, a2);
  const p4 = pt(r1, a1);
  return `M${f1(p1[0])} ${f1(p1[1])}A${r2} ${r2} 0 0 0 ${f1(p2[0])} ${f1(p2[1])}L${f1(p3[0])} ${f1(p3[1])}A${r1} ${r1} 0 0 1 ${f1(p4[0])} ${f1(p4[1])}Z`;
}
const Q_LON: Record<Quarter, [number, number]> = {
  initiation: [WHEEL_START + 2 * GATE_SPAN, WHEEL_START + 18 * GATE_SPAN],
  civilization: [WHEEL_START + 18 * GATE_SPAN - 360, WHEEL_START + 34 * GATE_SPAN - 360],
  duality: [WHEEL_START + 34 * GATE_SPAN - 360, WHEEL_START + 50 * GATE_SPAN - 360],
  mutation: [WHEEL_START + 50 * GATE_SPAN - 360, WHEEL_START + 66 * GATE_SPAN - 360],
};

/** Бодиграф в центре: размер и место — как в макете. */
const BG = { w: 339, h: 485.4, x: C0 - 339 / 2, y: C0 - 485.4 / 2 + 4 };
const FULL_VIEW = [85, 112, 1186, 1698] as const;
const gpos = (g: number): [number, number] => {
  const [gx, gy] = GATE_XY[g]!;
  const s = BG.w / FULL_VIEW[2];
  return [BG.x + (gx - FULL_VIEW[0]) * s, BG.y + (gy - FULL_VIEW[1]) * s];
};

type Kind = 'personality' | 'design' | 'transit';
interface Dot {
  kind: Kind;
  a: BodyActivation;
  x: number;
  y: number;
}

function placeDots(list: BodyActivation[], kind: Kind, used: { a: number; r: number }[]): Dot[] {
  return list
    .map((a) => ({ a, an: ang(a.longitude) }))
    .sort((p, q) => p.an - q.an)
    .map(({ a, an }) => {
      let r = 314;
      while (used.some((u) => Math.abs(u.a - an) < 0.06 && u.r === r)) r -= 17;
      used.push({ a: an, r });
      const [x, y] = pt(r, an);
      return { kind, a, x, y };
    });
}

function Mandala({ chart, transit, spin, onDot }: { chart: Bodygraph; transit: BodyActivation[] | null; spin: boolean; onDot: (d: Dot) => void }) {
  const tone = useTone();
  const dark = tone === 'night';
  const S = SIDE_COLOR[tone];
  const line = dark ? 'rgba(255,255,255,.09)' : 'rgba(42,38,32,.12)';
  const txt = dark ? '#B3B8C8' : '#6D665B';
  const txt2 = dark ? '#7C8399' : '#9C9387';
  const plate = dark ? '#141B2F' : '#FBF7F0';
  const myQ = quarterOf(chart.personality[0]!.gate);
  const P = useMemo(() => new Set(chart.personality.map((a) => a.gate)), [chart]);
  const D = useMemo(() => new Set(chart.design.map((a) => a.gate)), [chart]);
  const T = useMemo(() => new Set((transit ?? []).map((a) => a.gate)), [transit]);
  const marks = useMemo(() => sideMarks(chart, tone, transit ? [...T] : []), [chart, tone, transit, T]);
  const layer = useMemo(() => {
    if (!transit) return undefined;
    const gates: Record<number, BodyActivation['body'][]> = {};
    for (const a of transit) (gates[a.gate] ??= []).push(a.body);
    return { gates, channels: [], centers: [] };
  }, [transit]);
  const dots = useMemo(() => {
    const used: { a: number; r: number }[] = [];
    return [...placeDots(chart.personality, 'personality', used), ...placeDots(chart.design, 'design', used), ...(transit ? placeDots(transit, 'transit', used) : [])];
  }, [chart, transit]);
  const [raysOn, setRaysOn] = useState(!spin);
  const uid = useRef(Math.random().toString(36).slice(2, 8)).current;
  const color = (k: Kind) => (k === 'personality' ? S.P : k === 'design' ? S.D : S.T);

  return (
    <div className="relative aspect-square w-full">
      <svg viewBox="0 0 1000 1000" className="absolute inset-0 h-full w-full" role="img" aria-label="Мандала: 64 ворот и 12 знаков">
        <defs>
          {(Object.keys(Q_LON) as Quarter[]).map((k) => {
            const [l1, l2] = Q_LON[k];
            return <path key={k} id={`q-${k}-${uid}`} d={arcPath(470, l1, l2, k !== 'civilization')} fill="none" />;
          })}
        </defs>
        <g className={cx('hd-ring', spin && 'spin')} onAnimationEnd={() => setRaysOn(true)}>
          <circle cx={C0} cy={C0} r={498} fill={plate} />
          {(Object.keys(Q_LON) as Quarter[]).map((k) => {
            const [l1, l2] = Q_LON[k];
            const on = k === myQ;
            const bottom = k === 'civilization';
            return (
              <g key={k}>
                <path d={sector(456, 497, l1, l2)} fill={on ? (dark ? 'rgba(236,201,143,.16)' : 'rgba(176,125,46,.13)') : dark ? 'rgba(255,255,255,.025)' : 'rgba(42,38,32,.03)'} />
                <text fontSize={21} letterSpacing={2.4} fill={on ? S.P : txt} fontWeight={on ? 600 : 500} dy={bottom ? 14 : 7}>
                  <textPath href={`#q-${k}-${uid}`} startOffset="50%" textAnchor="middle">
                    Четверть {QUARTER_TEXT[k].gen}
                  </textPath>
                </text>
              </g>
            );
          })}
          {GATE_ORDER.map((g, i) => {
            const l1 = WHEEL_START + i * GATE_SPAN;
            const mid = ang(l1 + GATE_SPAN / 2);
            const cs = [P.has(g) && S.P, D.has(g) && S.D, T.has(g) && S.T].filter(Boolean) as string[];
            const [x, y] = pt(438, mid);
            const [hx, hy] = pt(391, mid);
            const [sx1, sy1] = pt(410, ang(l1));
            const [sx2, sy2] = pt(456, ang(l1));
            const pat = (HEX as Record<string, string>)[String(g)]!;
            const w = GATE_SPAN / Math.max(1, cs.length);
            return (
              <g key={g}>
                {cs.length > 0 && <path d={sector(410, 456, l1, l1 + GATE_SPAN)} fill={cs[0]} opacity={dark ? 0.17 : 0.14} />}
                {cs.map((c, j) => (
                  <path key={j} d={sector(410, 416, l1 + j * w + 0.25, l1 + (j + 1) * w - 0.25)} fill={c} />
                ))}
                <text x={f1(x)} y={f1(y + 6)} textAnchor="middle" fontSize={17} fill={cs.length ? (dark ? '#F1EDE4' : '#2A2620') : txt} fontWeight={cs.length ? 600 : 400}>
                  {g}
                </text>
                <g transform={`translate(${f1(hx - 9)} ${f1(hy - 9)})`} fill={txt2}>
                  {[0, 1, 2, 3, 4, 5].map((k) => {
                    const yy = f1(15.4 - k * 3.1);
                    return pat[k] === '1' ? (
                      <rect key={k} x={0} y={yy} width={18} height={1.9} rx={0.5} />
                    ) : (
                      <g key={k}>
                        <rect x={0} y={yy} width={7.6} height={1.9} rx={0.5} />
                        <rect x={10.4} y={yy} width={7.6} height={1.9} rx={0.5} />
                      </g>
                    );
                  })}
                </g>
                <line x1={f1(sx1)} y1={f1(sy1)} x2={f1(sx2)} y2={f1(sy2)} stroke={line} strokeWidth={1} />
              </g>
            );
          })}
          {SIGN_KEYS.map((s, i) => {
            const l1 = i * 30;
            const [x1, y1] = pt(332, ang(l1));
            const [x2, y2] = pt(372, ang(l1));
            const [x, y] = pt(352, ang(l1 + 15));
            return (
              <g key={s}>
                <line x1={f1(x1)} y1={f1(y1)} x2={f1(x2)} y2={f1(y2)} stroke={line} strokeWidth={1.2} />
                <text x={f1(x)} y={f1(y + 8)} textAnchor="middle" fontSize={23} fill={txt} fontFamily="'Apple Symbols','Segoe UI Symbol','Noto Sans Symbols 2','DejaVu Sans',sans-serif">
                  <title>{SIGN_RU[s]}</title>
                  {SIGN_GLYPH[s]}︎
                </text>
              </g>
            );
          })}
          {[497, 456, 410, 372, 332].map((r) => (
            <circle key={r} cx={C0} cy={C0} r={r} fill="none" stroke={line} strokeWidth={r === 497 ? 1.5 : 1} />
          ))}
          {dots.map((d, i) => (
            <g
              key={i}
              transform={`translate(${f1(d.x)} ${f1(d.y)})`}
              className={cx('cursor-pointer', d.kind === 'transit' && 'hd-twinkle')}
              onClick={() => onDot(d)}
              role="button"
              aria-label={`${d.a.body} ${d.a.gate}.${d.a.line}`}
            >
              <circle r={11} fill={color(d.kind)} stroke={plate} strokeWidth={2.5} />
              <circle r={22} fill="transparent" />
            </g>
          ))}
        </g>
      </svg>
      <div className="pointer-events-none absolute" style={{ left: `${BG.x / 10}%`, top: `${BG.y / 10}%`, width: `${BG.w / 10}%`, height: `${BG.h / 10}%` }}>
        <ChartGraph chart={chart} layer={layer} marks={marks} viewBox={FULL_VIEW} className="block h-full w-full" />
      </div>
      <svg viewBox="0 0 1000 1000" className="hd-rays pointer-events-none absolute inset-0 h-full w-full" style={{ opacity: raysOn ? 1 : 0 }} aria-hidden>
        {dots.map((d, i) => {
          const [gx, gy] = gpos(d.a.gate);
          return <line key={i} x1={f1(d.x)} y1={f1(d.y)} x2={f1(gx)} y2={f1(gy)} stroke={color(d.kind)} strokeWidth={1.3} opacity={0.38} />;
        })}
      </svg>
    </div>
  );
}

const nowText = (d: Date) => d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export function MandalaTab({ chart }: { chart: Bodygraph }) {
  const tone = useTone();
  const S = SIDE_COLOR[tone];
  const [withTransit, setWithTransit] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [spin, setSpin] = useState(true);
  const [sel, setSel] = useState<{ a: FullActivation; side: 'design' | 'personality'; transit: boolean } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const transit = useMemo(() => (withTransit ? transitActivationsAt(now) : null), [withTransit, now]);
  useEffect(() => {
    if (!withTransit) return;
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, [withTransit]);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const id = setTimeout(() => el.scrollTo({ left: zoom ? (el.scrollWidth - el.clientWidth) / 2 : 0, top: zoom ? (el.scrollHeight - el.clientHeight) / 2 - 60 : 0, behavior: 'smooth' }), 60);
    return () => clearTimeout(id);
  }, [zoom]);

  const sun = chart.personality[0]!;
  const q = quarterOf(sun.gate);
  const Q = QUARTER_TEXT[q];
  const onDot = (d: Dot) => {
    haptic.select();
    const t = d.kind === 'transit' ? now : d.kind === 'design' ? chart.designUtc : chart.birthUtc;
    setSel({ a: { ...d.a, ...detailOf(d.a.longitude), retro: isRetrograde(d.a.body, t) }, side: d.kind === 'design' ? 'design' : 'personality', transit: d.kind === 'transit' });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-line bg-surface px-4 py-3.5 shadow-[var(--shadow)]">
        <div
          className="flex w-full cursor-pointer items-center justify-between gap-4 text-left"
          role="switch"
          tabIndex={0}
          aria-checked={withTransit}
          onClick={() => {
            haptic.select();
            setSpin(false);
            setNow(new Date());
            setWithTransit((v) => !v);
          }}
        >
          <span>
            <span className="flex items-center gap-1.5 text-[16px] font-medium">
              + Транзит сейчас
              <Info small title="Транзит" text={<p>Где планеты стоят прямо сейчас. Голубые точки и ворота временно включаются в тебе поверх карты рождения.</p>} />
            </span>
            <span className="text-[13px] text-faint">{nowText(now)}</span>
          </span>
          <span className={cx('relative h-[30px] w-[50px] shrink-0 rounded-full transition', withTransit ? 'bg-accent' : 'bg-surface-2')}>
            <span className={cx('absolute top-[3px] h-6 w-6 rounded-full bg-white shadow transition-all', withTransit ? 'left-[23px]' : 'left-[3px]')} />
          </span>
        </div>
      </div>
      <div className="relative -mx-2">
        <div ref={scroller} className="overflow-auto rounded-[24px] [scrollbar-width:none]">
          <div className="transition-[width] duration-500 ease-out" style={{ width: zoom ? '200%' : '100%' }}>
            <Mandala chart={chart} transit={transit} spin={spin} onDot={onDot} />
          </div>
        </div>
        <button
          onClick={() => {
            haptic.select();
            setSpin(false);
            setZoom((z) => !z);
          }}
          aria-label={zoom ? 'Уменьшить' : 'Увеличить'}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface/90 text-ink backdrop-blur active:scale-95"
        >
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
            <circle cx="10.5" cy="10.5" r="6" />
            <path d={zoom ? 'M8 10.5h5M15 15l5 5' : 'M8 10.5h5M10.5 8v5M15 15l5 5'} />
          </svg>
        </button>
      </div>
      <Legend
        items={[
          { color: S.P, label: 'Личность' },
          { color: S.D, label: 'Дизайн' },
          ...(withTransit ? [{ color: S.T, label: 'Транзит' }] : []),
        ]}
      />
      <p className="-mt-2 text-center text-[13px] text-faint">Нажми на точку на кольце</p>
      <div className="rounded-[24px] border border-line bg-surface p-4 shadow-[var(--shadow)]">
        <div className="mb-1.5 flex items-center justify-between">
          <Rubric>Твоя четверть</Rubric>
          <Info
            title="Четверти мандалы"
            text={<p>Круг из 64 ворот делится на четыре четверти по 16 ворот. Твоя четверть — та, где стоит Солнце Личности. Она говорит, через что реализуется твоё предназначение.</p>}
          />
        </div>
        <h2 className="font-serif text-[28px] font-medium leading-tight">{Q.name}</h2>
        <div className="mt-1 text-[14px] text-accent">{Q.purpose}</div>
        <p className="mt-2 text-[15px] leading-6 text-muted">{Q.theme}</p>
        <p className="mt-3 text-[13px] text-faint">
          Солнце Личности — ворота {sun.gate} · {SIGN_RU[detailOf(sun.longitude).sign]}
        </p>
      </div>
      <PlanetSheet sel={sel} onClose={() => setSel(null)} transit={sel?.transit} />
    </div>
  );
}
