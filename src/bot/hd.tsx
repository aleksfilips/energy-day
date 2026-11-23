/**
 * Дизайн человека в утреннем сообщении (D-137): картинка бодиграфа с транзитами дня,
 * подпись к ней и полный разбор дня. Тексты — те же, что в приложении (по курсу, D-131).
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { BodygraphSvg, NIGHT, PALETTE, VIEWBOX } from '../app/screens/Bodygraph';
import { bodygraphFromUtc, type Bodygraph } from '../humandesign/chart';
import { dayTransits } from '../humandesign/transits';
import { transitStory, type HdItem, type HdStory } from '../humandesign/summary';
import type { HdBody } from '../humandesign/positions';
import type { DateKey } from '../astro/time';
import { esc } from './message';

export interface HdMorning {
  chart: Bodygraph;
  story: HdStory;
  /** SVG 1080×1350 для картинки. */
  svg: string;
  /** Подпись к картинке (HTML, до 1024 знаков). */
  caption: string;
  /** Полный разбор (HTML, до 4096 знаков). */
  text: string;
}

const GLYPH: Record<HdBody, string> = {
  sun: '☉', earth: '⊕', northNode: '☊', southNode: '☋', moon: '☽', mercury: '☿', venus: '♀',
  mars: '♂', jupiter: '♃', saturn: '♄', uranus: '♅', neptune: '♆', pluto: '♇',
};
const ORDER: HdBody[] = ['sun', 'earth', 'northNode', 'southNode', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

const W = 1080;
const H = 1350;
const SERIF = "'Cormorant Garamond', 'DejaVu Serif', serif";
const SANS = "'Inter', 'DejaVu Sans', sans-serif";
const GLYPHS = "'DejaVu Sans', sans-serif";
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function hdMorning(birthUtc: Date, date: DateKey, tz: string, heading: string): HdMorning {
  const chart = bodygraphFromUtc(birthUtc);
  const t = dayTransits(chart, date, tz);
  const story = transitStory(chart, t, tz);
  return { chart, story, svg: cardSvg(story, heading), caption: caption(story), text: fullText(story) };
}

function column(marks: HdStory['graph']['design'], side: 'design' | 'personality', top: number, bottom: number): string {
  const P = PALETTE.night;
  const color = side === 'design' ? P.design : P.personality;
  const ink = side === 'design' ? '#fff' : NIGHT.pin;
  const by = new Map(marks.map((m) => [m.body, m]));
  const rows = ORDER.filter((b) => by.has(b));
  const step = (bottom - top) / Math.max(1, rows.length - 1);
  const x0 = side === 'design' ? 56 : W - 56;
  return rows
    .map((b, i) => {
      const m = by.get(b)!;
      const y = top + i * step;
      const gx = side === 'design' ? x0 + 17 : x0 - 17;
      const tx = side === 'design' ? x0 + 44 : x0 - 44;
      return (
        `<circle cx="${gx}" cy="${y}" r="17" fill="${color}"/>` +
        `<text x="${gx}" y="${y + 7}" text-anchor="middle" font-family="${GLYPHS}" font-size="20" fill="${ink}">${GLYPH[b]}</text>` +
        `<text x="${tx}" y="${y + 9}" text-anchor="${side === 'design' ? 'start' : 'end'}" font-family="${SANS}" font-weight="600" font-size="26" fill="${color}">${m.gate}.${m.line}</text>`
      );
    })
    .join('');
}

function cardSvg(story: HdStory, heading: string): string {
  const P = PALETTE.night;
  const g = story.graph;
  const inner = renderToStaticMarkup(<BodygraphSvg g={g} layer={g.day} tone="night" />)
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '');
  const gh = 900;
  const gw = Math.round((gh * VIEWBOX.w) / VIEWBOX.h);
  const gx = (W - gw) / 2;
  const gy = 268;
  const theme = `Тема дня: ворота ${story.theme.gate} «${story.theme.name}»`;
  const legend = [
    ['Личность', P.personality],
    ['Дизайн', P.design],
    ['Транзит дня', P.transit],
  ] as const;
  const lw = [190, 170, 230];
  let lx = (W - lw.reduce((a, b) => a + b, 0)) / 2;
  const leg = legend
    .map(([name, c], i) => {
      const s = `<circle cx="${lx + 12}" cy="1222" r="9" fill="${c}"/><text x="${lx + 32}" y="1231" font-family="${SANS}" font-size="25" fill="${NIGHT.muted}">${name}</text>`;
      lx += lw[i]!;
      return s;
    })
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<defs><linearGradient id="bgV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1C2443"/><stop offset="0.5" stop-color="#141B34"/><stop offset="1" stop-color="#0B1020"/></linearGradient>` +
    `<radialGradient id="bgGlow" cx="${W / 2}" cy="0" r="760" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2E3A6E" stop-opacity="0.9"/><stop offset="1" stop-color="#2E3A6E" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#bgV)"/><rect width="${W}" height="${H}" fill="url(#bgGlow)"/>` +
    `<text x="${W / 2}" y="92" text-anchor="middle" font-family="${SANS}" font-weight="600" font-size="23" letter-spacing="5" fill="${NIGHT.gold}">ДИЗАЙН ЧЕЛОВЕКА · ТРАНЗИТЫ ДНЯ</text>` +
    `<text x="${W / 2}" y="168" text-anchor="middle" font-family="${SERIF}" font-weight="500" font-size="66" fill="${NIGHT.ink}">${xml(heading)}</text>` +
    `<text x="${W / 2}" y="222" text-anchor="middle" font-family="${SANS}" font-size="28" fill="${NIGHT.muted}">${xml(theme)}</text>` +
    `<svg x="${gx}" y="${gy}" width="${gw}" height="${gh}" viewBox="${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}">${inner}</svg>` +
    column(g.design, 'design', 330, 1110) +
    column(g.personality, 'personality', 330, 1110) +
    `<text x="56" y="296" font-family="${SANS}" font-weight="600" font-size="20" letter-spacing="3" fill="${P.design}">ДИЗАЙН</text>` +
    `<text x="${W - 56}" y="296" text-anchor="end" font-family="${SANS}" font-weight="600" font-size="20" letter-spacing="3" fill="${P.personality}">ЛИЧНОСТЬ</text>` +
    leg +
    `<line x1="${W / 2 - 60}" y1="1272" x2="${W / 2 + 60}" y2="1272" stroke="${NIGHT.gold}" stroke-opacity="0.35"/>` +
    `<text x="${W / 2}" y="1310" text-anchor="middle" font-family="${SERIF}" font-size="30" fill="${NIGHT.faint}">Энергия дня</text>` +
    `</svg>`
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function caption(s: HdStory): string {
  const lines = [`🔮 <b>Дизайн человека · транзиты дня</b>`, `Тема дня для всех — ворота ${s.theme.gate} «${esc(s.theme.name)}»: ${esc(s.theme.gist)}.`];
  if (s.theme.periods.length > 1) lines.push(esc(s.theme.periods.map((p) => `${p.when}: ворота ${p.gate} «${p.name}»`).join('; ')) + '.');
  lines.push('', 'Синим на бодиграфе — то, что сегодня включают планеты. Разбор — ниже.');
  return lines.join('\n');
}

const item = (i: HdItem) => `• <b>${esc(i.when)}</b> — ${esc(i.title)}. ${esc(i.text)}`;

/** Полный разбор: что включается в тебе, что приходит извне, общий фон, как прожить день. */
function fullText(s: HdStory): string {
  const ty = s.type;
  const head = [`🔮 <b>Дизайн человека на сегодня</b>`, '', `<b>Тема дня</b> — ворота ${s.theme.gate} «${esc(s.theme.name)}» (${esc(s.theme.iching)}): ${esc(s.theme.gist)}.${s.theme.mine ? ' Это твои ворота — тема звучит в тебе особенно ярко.' : ''}`];
  const tail = [
    '',
    `<b>Как прожить день</b>`,
    `${esc(cap(ty.name))}, профиль ${ty.profile}. Стратегия: ${esc(ty.strategy)}. Авторитет: ${esc(ty.authority)}.`,
    `Если день идёт верно — ${esc(ty.signature)}; если чувствуешь ${esc(ty.notSelf)} — вернись к своей стратегии.`,
  ];
  const sections: [string, HdItem[]][] = [
    ['Что включается в тебе', s.mine],
    ['Что приходит извне (открытые центры)', s.open],
    ['Общий фон для всех', s.shared],
  ];
  // Помещаемся в 4096 знаков: если длинно — сокращаем списки с конца (общий фон первым).
  const build = (limits: number[]) => {
    const out = [...head];
    sections.forEach(([title, items], i) => {
      const shown = items.slice(0, limits[i]);
      if (!shown.length) return;
      out.push('', `<b>${title}</b>`, ...shown.map(item));
      if (items.length > shown.length) out.push(`…и ещё ${items.length - shown.length} — в приложении.`);
    });
    return [...out, ...tail].join('\n');
  };
  const limits = sections.map(([, xs]) => xs.length);
  const plainLen = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&lt;|&gt;|&amp;/g, '.').length;
  let text = build(limits);
  for (const i of [2, 1, 0, 2, 1, 0]) {
    while (plainLen(text) > 3900 && limits[i]! > (i === 0 ? 3 : 1)) {
      limits[i]!--;
      text = build(limits);
    }
  }
  return text;
}
