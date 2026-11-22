/**
 * Простые тексты о транзитах дня и о бодиграфе — для карточки на экране «Сегодня».
 * Смыслы ворот, каналов, центров, типов и авторитетов — по материалам курса Rave ABC (IHDS),
 * см. src/content/data/humandesign.json и D-131.
 */
import content from '../content/data/humandesign.json';
import { bodygraph, type BirthData, type Bodygraph } from './chart';
import { dayTransits, type DayTransits, type TransitWindow } from './transits';
import { HD_BODY_NAMES } from './positions';
import { CENTERS, channelKey, type Center } from './graph';
import { formatTime, type DateKey } from '../astro/time';
import { graphView, type GraphView } from './overlay';

type Content = typeof content;
const C: Content = content;

export interface HdCardText {
  title: string;
  lines: string[];
}

type GateInfo = { name: string; iching: string; gist: string };
export const gateInfo = (g: number): GateInfo => C.gates[String(g) as keyof Content['gates']];
const gateName = (g: number) => gateInfo(g).name;
const centerInfo = (c: Center) => C.centers[c];
/** Название центра для подписи. */
export const centerTitle = (c: Center) => C.centers[c].name;
export const REFLECTOR = C.reflector;
/** Название канала по ключу «a-b». */
export const channelTitle = (key: string) => C.channels[key as keyof Content['channels']]!.name;
const channelInfo = (key: string) => C.channels[key as keyof Content['channels']];

function when(windows: TransitWindow[], dayFrom: Date, dayTo: Date, tz: string): string {
  if (windows.length === 1) {
    const w = windows[0]!;
    const fromStart = w.from.getTime() <= dayFrom.getTime();
    const toEnd = w.to.getTime() >= dayTo.getTime();
    if (fromStart && toEnd) return 'Весь день';
    if (fromStart) return `До ${formatTime(w.to, tz)}`;
    if (toEnd) return `С ${formatTime(w.from, tz)}`;
  }
  return windows
    .map((w) => `с ${formatTime(w.from, tz)} до ${formatTime(w.to, tz)}`)
    .join(' и ')
    .replace(/^с/, 'С');
}

/** Ворота Солнца в течение дня: обычно одни, а в день смены — двое (с моментом смены). */
export interface SunPeriod {
  gate: number;
  from: Date;
  to: Date;
}

export function sunPeriods(t: DayTransits): SunPeriod[] {
  const out: SunPeriod[] = [];
  for (const s of t.segments) {
    const g = s.activations.find((a) => a.body === 'sun')!.gate;
    const last = out[out.length - 1];
    if (last && last.gate === g) last.to = s.to;
    else out.push({ gate: g, from: s.from, to: s.to });
  }
  return out;
}

/** «ворота 14 «Навыки силы»» или «до 15:21 — ворота 14 «…», затем ворота 34 «…»». */
function themePhrase(chart: Bodygraph, t: DayTransits, tz: string): string {
  const ps = sunPeriods(t);
  const g = (p: SunPeriod) => `ворота ${p.gate} «${gateName(p.gate)}»${chart.gates.has(p.gate) ? ' (твои ворота)' : ''}`;
  if (ps.length === 1) return g(ps[0]!);
  return ps.map((p, i) => (i === 0 ? `до ${formatTime(p.to, tz)} — ${g(p)}` : `с ${formatTime(p.from, tz)} — ${g(p)}`)).join(', ');
}

export function transitLines(chart: Bodygraph, t: DayTransits, tz: string): string[] {
  const lines: string[] = [];
  lines.push(`Тема дня для всех: ${themePhrase(chart, t, tz)}.`);

  // Сначала каналы, которые замыкаются через твои ворота, потом общие.
  const chs = [...t.channels].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'completes' ? -1 : 1));
  for (const ch of chs) {
    const info = channelInfo(ch.key)!;
    const [a, b] = ch.gates;
    const mine = ch.kind === 'completes' ? (chart.gates.has(a) ? a : b) : null;
    const lead = when(ch.windows, t.from, t.to, tz);
    lines.push(
      mine !== null
        ? `${lead} твои ворота ${mine} замыкаются в канал ${a}–${b} «${info.name}»: ${info.text}.`
        : `${lead} у всех работает канал ${a}–${b} «${info.name}»: ${info.text}.`,
    );
  }

  const centers = [...t.centers].sort((x, y) => CENTERS.indexOf(x.center) - CENTERS.indexOf(y.center));
  for (const c of centers) {
    const info = centerInfo(c.center);
    lines.push(`${when(c.windows, t.from, t.to, tz)} определён извне твой открытый центр «${info.name}». ${info.transit}`);
  }

  for (const h of t.gateHits) {
    if (!SHOWN_HIT_BODIES.has(h.body)) continue;
    lines.push(`${when(h.windows, t.from, t.to, tz)} ${HD_BODY_NAMES[h.body]} в твоих воротах ${h.gate} «${gateName(h.gate)}»: эта тема звучит сильнее.`);
  }

  if (lines.length === 1) lines.push('Сегодня транзиты почти не задевают твой бодиграф. Спокойный день, чтобы быть собой.');
  return lines;
}

/**
 * Какие планеты в твоих воротах показываем отдельной строкой. Солнце уже названо в теме дня,
 * а медленные планеты стоят в одних воротах неделями и месяцами — это фон, а не событие дня.
 */
const SHOWN_HIT_BODIES = new Set(['moon', 'earth', 'mercury']);

/** Главная функция для экрана: дата + часовой пояс → заголовок и строки. */
export function hdDayCard(birth: BirthData, key: DateKey, timeZone: string): HdCardText {
  const chart = bodygraph(birth);
  const t = dayTransits(chart, key, timeZone);
  return { title: 'Дизайн человека: транзиты дня', lines: transitLines(chart, t, timeZone) };
}

/** Короткое описание самого бодиграфа (для «Мои данные»). */
export function hdProfileLines(chart: Bodygraph): string[] {
  const type = C.types[chart.type];
  const defined = CENTERS.filter((c) => chart.centers.has(c)).map((c) => centerInfo(c).name);
  const open = CENTERS.filter((c) => !chart.centers.has(c)).map((c) => centerInfo(c).name);
  const line = (n: number) => C.lines[String(n) as keyof Content['lines']];
  return [
    `Тип: ${type.name}. Стратегия: ${type.strategy}.`,
    `Подпись (признак, что живёшь своим): ${type.signature}. Тема ложного Я: ${type.notSelf}.`,
    `Авторитет: ${C.authorities[chart.authority]}.`,
    `Профиль: ${chart.profile[0]}/${chart.profile[1]} (${line(chart.profile[0])} / ${line(chart.profile[1])}).`,
    `Определённые центры: ${defined.length ? defined.join(', ') : 'нет'}.`,
    `Открытые центры: ${open.length ? open.join(', ') : 'нет'}.`,
    `Каналы: ${chart.channels.length ? chart.channels.map((c) => `${c[0]}–${c[1]} «${channelInfo(channelKey(c))!.name}»`).join(', ') : 'нет'}.`,
    `Крест: ворота ${chart.cross[0]}/${chart.cross[1]} | ${chart.cross[2]}/${chart.cross[3]}.`,
  ];
}

/** Один пункт транзитов: когда, что и что это значит. */
export interface HdItem {
  when: string;
  title: string;
  text: string;
}

/** Транзиты дня, разложенные по смыслу и объяснённые простыми словами. */
export interface HdStory {
  /** Общая тема дня (Солнце). Если Солнце сменило ворота днём — periods из двух частей. */
  theme: { gate: number; name: string; iching: string; gist: string; mine: boolean; periods: { gate: number; name: string; when: string; mine: boolean }[] };
  /** Что включается в тебе: каналы через твои ворота и планеты в твоих воротах. */
  mine: HdItem[];
  /** Что приходит извне: открытые центры, которые сегодня определены транзитом. */
  open: HdItem[];
  /** Общий фон для всех людей: каналы, целиком собранные планетами. */
  shared: HdItem[];
  /** Как прожить день по своему типу. */
  type: { name: string; strategy: string; authority: string; signature: string; notSelf: string; purpose: string; profile: string; isReflector: boolean };
  /** Что рисовать на бодиграфе. */
  graph: GraphView;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function transitStory(chart: Bodygraph, t: DayTransits, tz: string, now?: Date): HdStory {
  const mine: HdItem[] = [];
  const shared: HdItem[] = [];
  for (const ch of t.channels) {
    const info = channelInfo(ch.key)!;
    const [a, b] = ch.gates;
    const item: HdItem = { when: when(ch.windows, t.from, t.to, tz), title: `Канал ${a}–${b} «${info.name}»`, text: upper(info.text) + '.' };
    if (ch.kind === 'completes') {
      const g = chart.gates.has(a) ? a : b;
      const other = g === a ? b : a;
      const by = ch.bodies.map((x) => HD_BODY_NAMES[x]).join(', ');
      item.text += ` Твои ворота ${g} соединяются с воротами ${other}${by ? ` (${by})` : ''}, и на это время канал работает у тебя как свой.`;
      mine.push(item);
    } else shared.push(item);
  }
  for (const h of t.gateHits) {
    if (!SHOWN_HIT_BODIES.has(h.body)) continue;
    mine.push({
      when: when(h.windows, t.from, t.to, tz),
      title: `${HD_BODY_NAMES[h.body]} в твоих воротах ${h.gate}`,
      text: `Тема твоих ворот «${gateName(h.gate)}» (${gateInfo(h.gate).gist}) сегодня звучит сильнее.`,
    });
  }
  const open = [...t.centers]
    .sort((x, y) => CENTERS.indexOf(x.center) - CENTERS.indexOf(y.center))
    .map((c) => {
      const info = centerInfo(c.center);
      return { when: when(c.windows, t.from, t.to, tz), title: `${info.name} (${info.short})`, text: `${info.transit} Мудрость открытого центра: «${info.wisdom.replace(/\.$/, "")}».` };
    });
  const type = C.types[chart.type];
  const ps = sunPeriods(t);
  const main = ps.reduce((a, b) => (b.to.getTime() - b.from.getTime() > a.to.getTime() - a.from.getTime() ? b : a));
  const gi = gateInfo(main.gate);
  return {
    theme: {
      gate: main.gate,
      name: gi.name,
      iching: gi.iching,
      gist: gi.gist,
      mine: chart.gates.has(main.gate),
      periods: ps.map((p) => ({ gate: p.gate, name: gateName(p.gate), when: when([p], t.from, t.to, tz), mine: chart.gates.has(p.gate) })),
    },
    mine,
    open,
    shared,
    type: { name: type.name, strategy: type.strategy, authority: lower(C.authorities[chart.authority]), signature: type.signature, notSelf: type.notSelf, purpose: type.purpose, profile: `${chart.profile[0]}/${chart.profile[1]}`, isReflector: chart.type === 'reflector' },
    graph: graphView(chart, t, now),
  };
}
