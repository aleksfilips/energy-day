/**
 * Простые тексты о транзитах дня и о бодиграфе — для карточки на экране «Сегодня»
 * и для утреннего сообщения.
 */
import content from '../content/data/humandesign.json';
import { bodygraph, type BirthData, type Bodygraph } from './chart';
import { dayTransits, type DayTransits, type TransitWindow } from './transits';
import { HD_BODY_NAMES } from './positions';
import { CENTERS, channelKey, type Center } from './graph';
import { formatTime, type DateKey } from '../astro/time';

type Content = typeof content;
const C: Content = content;

export interface HdCardText {
  title: string;
  lines: string[];
}

const gateName = (g: number) => C.gates[String(g) as keyof Content['gates']];
const centerInfo = (c: Center) => C.centers[c];
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

const MAX_CENTERS = 3;

export function transitLines(chart: Bodygraph, t: DayTransits, tz: string): string[] {
  const lines: string[] = [];
  const sunMine = chart.gates.has(t.sun.gate);
  lines.push(
    `Тема дня для всех: ворота ${t.sun.gate} «${gateName(t.sun.gate)}».` +
      (sunMine ? ' Это твои ворота, так что тема звучит лично для тебя.' : ''),
  );

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
        : `${lead} работает канал ${a}–${b} «${info.name}»: ${info.text}.`,
    );
  }

  const centers = [...t.centers]
    .sort((x, y) => CENTERS.indexOf(x.center) - CENTERS.indexOf(y.center))
    .slice(0, MAX_CENTERS);
  for (const c of centers) {
    const info = centerInfo(c.center);
    lines.push(`${when(c.windows, t.from, t.to, tz)} включён твой открытый центр «${info.name}». ${info.transit}`);
  }

  for (const h of t.gateHits) {
    if (h.body === 'sun') continue; // уже сказано в теме дня
    if (h.body !== 'moon' && h.body !== 'earth' && h.body !== 'mercury') continue; // медленные планеты стоят неделями
    lines.push(
      `${when(h.windows, t.from, t.to, tz)} ${HD_BODY_NAMES[h.body]} в твоих воротах ${h.gate} «${gateName(h.gate)}»: эта твоя черта сегодня заметнее.`,
    );
  }

  if (lines.length === 1) lines.push('Сегодня транзиты почти не задевают твой бодиграф. Спокойный день, чтобы быть собой.');
  return lines;
}

/** Главная функция для экрана: дата + часовой пояс → заголовок и строки. */
export function hdDayCard(birth: BirthData, key: DateKey, timeZone: string): HdCardText {
  const chart = bodygraph(birth);
  const t = dayTransits(chart, key, timeZone);
  return { title: 'Дизайн человека: транзиты дня', lines: transitLines(chart, t, timeZone) };
}

/** Короткое описание самого бодиграфа (для настроек / справки). */
export function hdProfileLines(chart: Bodygraph): string[] {
  const type = C.types[chart.type];
  const defined = CENTERS.filter((c) => chart.centers.has(c)).map((c) => centerInfo(c).name);
  const open = CENTERS.filter((c) => !chart.centers.has(c)).map((c) => centerInfo(c).name);
  return [
    `Тип: ${type.name}. Стратегия: ${type.strategy}.`,
    `Авторитет: ${C.authorities[chart.authority]}.`,
    `Профиль: ${chart.profile[0]}/${chart.profile[1]}.`,
    `Определённые центры: ${defined.length ? defined.join(', ') : 'нет'}.`,
    `Открытые центры: ${open.length ? open.join(', ') : 'нет'}.`,
    `Каналы: ${chart.channels.length ? chart.channels.map((c) => `${c[0]}–${c[1]} «${channelInfo(channelKey(c))!.name}»`).join(', ') : 'нет'}.`,
    `Крест: ворота ${chart.cross[0]}/${chart.cross[1]} | ${chart.cross[2]}/${chart.cross[3]}.`,
  ];
}
