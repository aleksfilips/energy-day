/** Общее для раздела «Дизайн человека» (D-148): шапка, вкладки, «i», цвета и значки планет, бодиграф с метками. */
import { useMemo, useState, type ReactNode } from 'react';
import type { Bodygraph } from '../../../humandesign/chart';
import { channelKey, CENTERS, definedCenters, definedChannels } from '../../../humandesign/graph';
import type { GraphLayer, GraphView } from '../../../humandesign/overlay';
import type { HdBody } from '../../../humandesign/positions';
import content from '../../../content/data/humandesign.json';
import { useStore } from '../../store';
import { cx, Sheet } from '../../ui';
import type { Nav } from '../../App';
import { BodygraphSvg, type GateMark, type GraphTone } from '../Bodygraph';

export type HdTab = 'chart' | 'mandala' | 'cycles' | 'people';

export function useTone(): GraphTone {
  const { settings } = useStore();
  return settings.theme === 'light' ? 'light' : 'night';
}

/** Цвета планет (из макета): спокойные, в гамме приложения. */
export const PLANET_COLOR: Record<GraphTone, Record<HdBody | 'chiron', string>> = {
  night: { sun: '#ECC98F', earth: '#B98E68', moon: '#CDD3DF', northNode: '#B5A4D8', southNode: '#9087B5', mercury: '#8FB3D9', venus: '#F0B48A', mars: '#D9877A', jupiter: '#9FCFA6', saturn: '#C4B99F', uranus: '#84C6C1', neptune: '#7F9DDB', pluto: '#B88DB5', chiron: '#C9B08A' },
  light: { sun: '#C8924A', earth: '#8A6040', moon: '#7F8797', northNode: '#7563AC', southNode: '#8E7FB0', mercury: '#3E6EA8', venus: '#C2703A', mars: '#B04F42', jupiter: '#4F8A5B', saturn: '#857A61', uranus: '#2F8C86', neptune: '#3F5FB0', pluto: '#8A5A88', chiron: '#8C7146' },
};
export const SIDE_COLOR: Record<GraphTone, { P: string; D: string; T: string }> = {
  night: { P: '#ECC98F', D: '#C4566C', T: '#8FB8FF' },
  light: { P: '#C8924A', D: '#9C2F47', T: '#3D74EC' },
};

export const BODY_NAME: Record<HdBody | 'chiron', string> = {
  sun: 'Солнце', earth: 'Земля', moon: 'Луна', northNode: 'Северный узел', southNode: 'Южный узел', mercury: 'Меркурий', venus: 'Венера', mars: 'Марс', jupiter: 'Юпитер', saturn: 'Сатурн', uranus: 'Уран', neptune: 'Нептун', pluto: 'Плутон', chiron: 'Хирон',
};

const ICON: Record<HdBody | 'chiron', ReactNode> = {
  sun: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></>,
  earth: <><circle cx="12" cy="12" r="7" /><path d="M12 5v14M5 12h14" /></>,
  moon: <path d="M15.6 4.6a7.6 7.6 0 1 0 0 14.8A6.2 6.2 0 0 1 15.6 4.6z" />,
  northNode: <><path d="M8 16.2V11.5a4 4 0 0 1 8 0v4.7" /><circle cx="8" cy="18" r="1.9" /><circle cx="16" cy="18" r="1.9" /></>,
  southNode: <><path d="M8 7.8v4.7a4 4 0 0 0 8 0V7.8" /><circle cx="8" cy="6" r="1.9" /><circle cx="16" cy="6" r="1.9" /></>,
  mercury: <><circle cx="12" cy="11.5" r="4" /><path d="M12 15.5V21M9.4 18.4h5.2M8.4 3.8a3.7 3.7 0 0 0 7.2 0" /></>,
  venus: <><circle cx="12" cy="9" r="5" /><path d="M12 14v7M9 18h6" /></>,
  mars: <><circle cx="10" cy="14" r="5" /><path d="M13.6 10.4L19.2 4.8M14.6 4.8h4.6v4.6" /></>,
  jupiter: <path d="M6.3 8.4a3.1 3.1 0 1 1 4.6 2.7L6 16.4h12.5M15.2 6v14.5" />,
  saturn: <path d="M8 3.8v15.4M5.4 6.4h5.2M8 12.6a4 4 0 0 1 7.6 1.8c0 2.6-2.6 3.4-1.4 5.8" />,
  uranus: <><path d="M6.5 4v10M17.5 4v10M6.5 9h11M12 4v11" /><circle cx="12" cy="18" r="2.4" /></>,
  neptune: <path d="M5.5 5.5c0 4.6 2.6 7.2 6.5 7.2s6.5-2.6 6.5-7.2M12 4v17M9 17.6h6M4.3 7.2l1.2-1.7 1.2 1.7M16.8 7.2l1.2-1.7 1.2 1.7M10.8 5.7L12 4l1.2 1.7" />,
  pluto: <><circle cx="12" cy="7" r="2.6" /><path d="M7 7.4a5 5 0 0 0 10 0M12 12.4V21M9 17.6h6" /></>,
  chiron: <><path d="M12 3.5v11M12 9.2l5-5M12 9.2l5 5" /><circle cx="12" cy="18.2" r="2.4" /></>,
};
export function PlanetIcon({ body, size = 16, className }: { body: HdBody | 'chiron'; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {ICON[body]}
    </svg>
  );
}

export const I = {
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
};

/** Курсовые тексты. */
export const HD = content;
export const typeName = (t: string) => (content.types as Record<string, { name: string }>)[t]?.name ?? t;
export const lineName = (n: number) => (content.lines as Record<string, string>)[String(n)] ?? '';
export const gateText = (g: number) => (content.gates as Record<string, { name: string; iching: string; gist: string }>)[String(g)]!;
export const AUTH_NAME: Record<string, string> = { emotional: 'Эмоциональный', sacral: 'Сакральный', splenic: 'Селезёночный', ego: 'Эго (сердечный)', self: 'Самопроецируемый', mental: 'Ментальный', lunar: 'Лунный' };
export const DEF_NAME: Record<string, string> = { none: 'Нет определённости', single: 'Одинарная', split: 'Двойная', 'triple-split': 'Тройная', 'quadruple-split': 'Четверная' };

export function Header({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <header className="px-1 pt-2">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Дизайн человека</div>
        {right}
      </div>
      <h1 className="mt-1 font-serif text-[34px] font-medium leading-[1.08]">{title}</h1>
      {sub && <p className="mt-1.5 text-[15px] leading-5 text-muted">{sub}</p>}
    </header>
  );
}

const TAB_ICON: Record<HdTab, ReactNode> = {
  chart: <><path d="M12 3l3.5 5.5h-7z" /><path d="M8 11h8l-4 6z" /><circle cx="12" cy="20" r="1.4" /></>,
  mandala: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4" /></>,
  cycles: <><path d="M3 12h18" /><circle cx="7" cy="12" r="2" /><circle cx="14" cy="12" r="2" /><path d="M19.5 8.5v7" /></>,
  people: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5" /><circle cx="16.5" cy="9.5" r="2.6" /><path d="M15.5 14.2c2.6-.3 4.5 1.3 5 4.3" /></>,
};
const TAB_LABEL: Record<HdTab, string> = { chart: 'Карта', mandala: 'Мандала', cycles: 'Циклы', people: 'Мои люди' };

export function Tabs({ active, nav }: { active: HdTab; nav: Nav }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {(Object.keys(TAB_LABEL) as HdTab[]).map((k) => (
        <button
          key={k}
          onClick={() => k !== active && nav.replace({ name: 'hd', tab: k })}
          className={cx(
            'flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[15px] transition active:scale-95',
            k === active ? 'bg-accent font-semibold text-bg' : 'border border-line bg-surface text-ink',
          )}
        >
          <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {TAB_ICON[k]}
          </svg>
          {TAB_LABEL[k]}
        </button>
      ))}
    </div>
  );
}

/** Кнопка «i»: открывает короткое пояснение снизу. */
export function Info({ title, text, small = false }: { title: string; text: ReactNode; small?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Подсказка: ${title}`}
        className={cx('inline-flex shrink-0 items-center justify-center rounded-full border border-line font-serif italic text-faint', small ? 'h-[18px] w-[18px] text-[12px]' : 'h-6 w-6 text-[14px]')}
      >
        i
      </button>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <div className="font-serif text-[24px] font-medium">{title}</div>
        <div className="mt-2 space-y-2 text-[15px] leading-6 text-muted">{text}</div>
      </Sheet>
    </>
  );
}

export function Rubric({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('text-[11px] font-semibold uppercase tracking-[0.16em] text-accent', className)}>{children}</div>;
}

// ---------- бодиграф ----------

export function natalView(chart: Bodygraph): GraphView {
  const empty: GraphLayer = { gates: {}, channels: [], centers: [] };
  return {
    natalGates: [...chart.gates].sort((a, b) => a - b),
    personalityGates: [...new Set(chart.personality.map((a) => a.gate))],
    designGates: [...new Set(chart.design.map((a) => a.gate))],
    personality: chart.personality.map((a) => ({ body: a.body, gate: a.gate, line: a.line })),
    design: chart.design.map((a) => ({ body: a.body, gate: a.gate, line: a.line })),
    natalChannels: chart.channels.map(channelKey),
    natalCenters: CENTERS.filter((c) => chart.centers.has(c)),
    day: empty,
    now: null,
  };
}

/** Слой «чужих» ворот (транзит, цикл) поверх карты. */
export function gatesLayer(chart: Bodygraph, list: { body: HdBody; gate: number }[]): GraphLayer {
  const gates: GraphLayer['gates'] = {};
  for (const a of list) (gates[a.gate] ??= []).push(a.body);
  const natal = new Set(chart.channels.map(channelKey));
  const chs = definedChannels(new Set([...chart.gates, ...list.map((a) => a.gate)])).filter((c) => !natal.has(channelKey(c)));
  const centers = definedCenters([...chart.channels, ...chs]);
  return { gates, channels: chs.map(channelKey), centers: CENTERS.filter((c) => centers.has(c) && !chart.centers.has(c)) };
}

/** Метки ворот цветом планеты (первая планета, попавшая в ворота). */
export function planetMarks(chart: Bodygraph, tone: GraphTone): Map<number, GateMark> {
  const m = new Map<number, GateMark>();
  for (const a of [...chart.personality, ...chart.design]) if (!m.has(a.gate)) m.set(a.gate, { fill: PLANET_COLOR[tone][a.body] });
  return m;
}

/** Метки по сторонам: Личность — золото, Дизайн — бордо, обе — золото с бордовым кольцом, транзит — голубой. */
export function sideMarks(chart: Bodygraph, tone: GraphTone, extra: number[] = []): Map<number, GateMark> {
  const S = SIDE_COLOR[tone];
  const P = new Set(chart.personality.map((a) => a.gate));
  const D = new Set(chart.design.map((a) => a.gate));
  const m = new Map<number, GateMark>();
  for (const g of P) m.set(g, { fill: S.P });
  for (const g of D) m.set(g, P.has(g) ? { fill: S.P, ring: S.D } : { fill: S.D, text: '#FFF7EE' });
  for (const g of extra) if (!m.has(g)) m.set(g, { fill: S.T, text: '#0E1630', twinkle: true });
  return m;
}

export function ChartGraph({
  chart,
  layer,
  marks,
  pulse,
  className,
  viewBox,
  hideNumbers,
}: {
  chart: Bodygraph;
  layer?: GraphLayer;
  marks?: Map<number, GateMark>;
  pulse?: number | null;
  className?: string;
  viewBox?: readonly [number, number, number, number];
  hideNumbers?: boolean;
}) {
  const { settings } = useStore();
  const tone = useTone();
  const view = useMemo(() => natalView(chart), [chart]);
  return (
    <BodygraphSvg
      g={view}
      layer={layer ?? { gates: {}, channels: [], centers: [] }}
      tone={tone}
      silhouette={settings.hdSilhouette ?? 'm'}
      marks={marks}
      pulse={pulse}
      className={className}
      viewBox={viewBox}
      hideNumbers={hideNumbers}
    />
  );
}

export function Legend({ items }: { items: { color: string; label: string; dashed?: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[13px] text-muted">
      {items.map((x) => (
        <span key={x.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.dashed ? `repeating-linear-gradient(90deg, ${x.color} 0 3px, ${x.dashed} 3px 6px)` : x.color }} />
          {x.label}
        </span>
      ))}
    </div>
  );
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_S = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const dFull = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
export const dShort = (d: Date) => `${d.getUTCDate()} ${MONTHS_S[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
export const plural = (n: number, a: string, b: string, c: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c;
};
export const years = (n: number) => `${n} ${plural(n, 'год', 'года', 'лет')}`;
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
