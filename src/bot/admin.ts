/**
 * Панель владельца бота (D-151): сколько людей знают бота, кто получает утреннее сообщение, кто новенький, кто ушёл.
 * Открывается только владельцу командой /admin (номер его чата — ADMIN_ID в настройках на сервере).
 * Всё считается из зашифрованного списка бота; наружу ничего не уходит.
 * Здесь — только расчёт и тексты, без сети (покрыто tests/bot-admin.test.ts).
 */
import { addDays, toDateKey, tzOffsetMinutes, wallClock, type DateKey } from '../astro/time';
import { offsetText } from '../places/timezone';
import { placeKey, type BotState, type Person, type Subscriber } from './state';
import { esc } from './message';

const DAY = 86_400_000;
export const ADMIN_TZ_DEFAULT = 'Asia/Yekaterinburg';

export interface PanelRow {
  id: string;
  name: string;
  username?: string;
  first: string;
  last: string;
  sub?: Subscriber;
  place: string;
  blocked: boolean;
}

export interface PanelStats {
  at: Date;
  tz: string;
  /** Все, кто знает бота (писал ему хоть раз). */
  known: number;
  /** Получают утреннее сообщение. */
  subs: number;
  /** Писали боту, но рассылку не включили (и не заблокировали). */
  notSubscribed: number;
  blocked: number;
  newPeople: { day: number; week: number; month: number };
  newSubs: { week: number; month: number };
  left30: { unsub: number; blocked: number; gone: number };
  /** Писали боту за последние 7 дней. */
  active7: number;
  features: { voice: number; hd: number; voc: number; evening: number; changes: number; sunGate: number };
  /** Откуда люди (по подписчикам): место → сколько. */
  places: [string, number][];
  /** 30 дней: сколько новых людей в каждый день и сколько всего было к концу дня. */
  series: { date: DateKey; added: number; total: number }[];
  rows: PanelRow[];
}

/** Подпись места подписчика: название из кэша, иначе — пояс. */
export function placeOf(state: BotState, s: Subscriber, at: Date): string {
  const name = state.places?.[placeKey(s.sub.latitude, s.sub.longitude)];
  if (name) return name;
  return zoneName(s.sub.timeZone, at);
}

/** «Екатеринбург (UTC+5)» из IANA-зоны. */
export function zoneName(tz: string, at: Date): string {
  const RU: Record<string, string> = {
    'Europe/Kaliningrad': 'Калининград', 'Europe/Moscow': 'Москва', 'Europe/Samara': 'Самара', 'Europe/Volgograd': 'Волгоград',
    'Europe/Saratov': 'Саратов', 'Europe/Ulyanovsk': 'Ульяновск', 'Europe/Astrakhan': 'Астрахань', 'Europe/Kirov': 'Киров',
    'Asia/Yekaterinburg': 'Екатеринбург', 'Asia/Omsk': 'Омск', 'Asia/Novosibirsk': 'Новосибирск', 'Asia/Barnaul': 'Барнаул',
    'Asia/Tomsk': 'Томск', 'Asia/Novokuznetsk': 'Новокузнецк', 'Asia/Krasnoyarsk': 'Красноярск', 'Asia/Irkutsk': 'Иркутск',
    'Asia/Chita': 'Чита', 'Asia/Yakutsk': 'Якутск', 'Asia/Vladivostok': 'Владивосток', 'Asia/Sakhalin': 'Сахалин',
    'Asia/Magadan': 'Магадан', 'Asia/Kamchatka': 'Камчатка', 'Asia/Anadyr': 'Анадырь', 'Europe/Minsk': 'Минск',
    'Europe/Kiev': 'Киев', 'Europe/Kyiv': 'Киев', 'Asia/Almaty': 'Алматы', 'Asia/Tashkent': 'Ташкент', 'Asia/Tbilisi': 'Тбилиси',
    'Asia/Yerevan': 'Ереван', 'Asia/Baku': 'Баку', 'Asia/Bishkek': 'Бишкек', 'Europe/Istanbul': 'Стамбул', 'Asia/Dubai': 'Дубай',
    'Europe/Berlin': 'Берлин', 'Europe/London': 'Лондон', 'Asia/Bangkok': 'Бангкок', 'Asia/Makassar': 'Бали',
  };
  let off = '';
  try {
    off = offsetText(tzOffsetMinutes(at, tz));
  } catch {
    /* неизвестная зона */
  }
  const city = RU[tz] ?? tz.split('/').pop()!.replace(/_/g, ' ');
  return `пояс ${city}${off ? ` (${off})` : ''}`;
}

export function panelStats(state: BotState, at: Date, tz: string = ADMIN_TZ_DEFAULT): PanelStats {
  const people: Record<string, Person> = { ...(state.people ?? {}) };
  // Подписчик без записи в списке людей (старые данные) — тоже человек.
  for (const [id, s] of Object.entries(state.subs)) people[id] ??= { n: s.firstName, first: s.since, last: s.since };
  const t = at.getTime();
  const within = (iso: string | undefined, days: number) => !!iso && t - Date.parse(iso) < days * DAY && Date.parse(iso) <= t + 60_000;
  const rows: PanelRow[] = Object.entries(people).map(([id, p]) => {
    const sub = state.subs[id];
    return { id, name: p.n || sub?.firstName || 'без имени', ...(p.u ? { username: p.u } : {}), first: p.first, last: p.last, ...(sub ? { sub } : {}), place: sub ? placeOf(state, sub, at) : '', blocked: !!p.blocked && !sub };
  });
  rows.sort((a, b) => b.first.localeCompare(a.first));
  const subsList = Object.values(state.subs);
  const placeCount = new Map<string, number>();
  for (const s of subsList) {
    const p = placeOf(state, s, at);
    placeCount.set(p, (placeCount.get(p) ?? 0) + 1);
  }
  const ev30 = (state.events ?? []).filter((e) => within(e.t, 30));
  const today = toDateKey(at, tz);
  const series: PanelStats['series'] = [];
  const firstDays = rows.map((r) => toDateKey(new Date(r.first), tz));
  for (let i = 29; i >= 0; i--) {
    const d = addDays(today, -i);
    series.push({ date: d, added: firstDays.filter((x) => x === d).length, total: firstDays.filter((x) => x <= d).length });
  }
  const blocked = rows.filter((r) => r.blocked).length;
  return {
    at,
    tz,
    known: rows.length,
    subs: subsList.length,
    notSubscribed: rows.filter((r) => !r.sub && !r.blocked).length,
    blocked,
    newPeople: { day: rows.filter((r) => toDateKey(new Date(r.first), tz) === today).length, week: rows.filter((r) => within(r.first, 7)).length, month: rows.filter((r) => within(r.first, 30)).length },
    newSubs: { week: subsList.filter((s) => within(s.since, 7)).length, month: subsList.filter((s) => within(s.since, 30)).length },
    left30: { unsub: ev30.filter((e) => e.k === 'unsub').length, blocked: ev30.filter((e) => e.k === 'blocked').length, gone: ev30.filter((e) => e.k === 'gone').length },
    active7: rows.filter((r) => within(r.last, 7)).length,
    features: {
      voice: subsList.filter((s) => !!s.sub.voice).length,
      hd: subsList.filter((s) => !!s.sub.hd && s.sub.birthUtc !== undefined).length,
      voc: subsList.filter((s) => !!s.sub.voc).length,
      evening: subsList.filter((s) => s.sub.evening !== undefined).length,
      changes: subsList.filter((s) => s.sub.changes !== false).length,
      sunGate: subsList.filter((s) => !!s.sub.sunGate).length,
    },
    places: [...placeCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    series,
    rows,
  };
}

const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** «26 ноя» (или «сегодня», «вчера») по поясу владельца. */
export function shortDate(iso: string, at: Date, tz: string): string {
  const d = toDateKey(new Date(iso), tz);
  const today = toDateKey(at, tz);
  if (d === today) return 'сегодня';
  if (d === addDays(today, -1)) return 'вчера';
  const [y, m, dd] = d.split('-').map(Number) as [number, number, number];
  return `${dd} ${MON[m - 1]}${y !== Number(today.slice(0, 4)) ? ` ${y}` : ''}`;
}

/** «27 ноября, 00:55». */
export function stamp(at: Date, tz: string): string {
  const d = toDateKey(at, tz);
  const w = wallClock(at, tz);
  const [, m, dd] = d.split('-').map(Number) as [number, number, number];
  return `${dd} ${MONTHS[m - 1]}, ${String(w.hour).padStart(2, '0')}:${String(w.minute).padStart(2, '0')}`;
}

const who = (r: PanelRow) => `${esc(r.name)}${r.username ? ` (@${esc(r.username)})` : ''}`;
const hhmm = (s: Subscriber) => `${String(s.sub.hour).padStart(2, '0')}:${String(s.sub.minute).padStart(2, '0')}`;

/** Что включено у подписчика — значками. */
function badges(s: Subscriber): string {
  return [s.sub.voice ? '🎧' : '', s.sub.hd && s.sub.birthUtc !== undefined ? '🔮' : '', s.sub.voc ? '🌙' : '', s.sub.evening !== undefined ? '✍️' : ''].join('');
}

/** Главное сообщение панели (HTML, до 4096 знаков). */
export function panelText(p: PanelStats): string {
  const L: string[] = [];
  L.push(`📊 <b>Панель «Энергии дня»</b>`, `<i>${stamp(p.at, p.tz)} · видишь только ты</i>`, '');
  L.push(`👥 Знают бота: <b>${p.known}</b>`);
  L.push(`☀️ Получают утреннее сообщение: <b>${p.subs}</b>`);
  L.push(`💤 Открыли, но рассылку не включили: <b>${p.notSubscribed}</b>`);
  L.push(`🔥 Заходили в бота за неделю: <b>${p.active7}</b>`);
  L.push('');
  L.push(`🌱 <b>Новые люди</b>: сегодня ${p.newPeople.day} · за 7 дней ${p.newPeople.week} · за 30 дней ${p.newPeople.month}`);
  L.push(`📬 Включили рассылку: за 7 дней ${p.newSubs.week} · за 30 дней ${p.newSubs.month}`);
  const left = p.left30.unsub + p.left30.blocked + p.left30.gone;
  L.push(`🍂 Ушли за 30 дней: ${left}${left ? ` (отписались ${p.left30.unsub}, заблокировали ${p.left30.blocked}${p.left30.gone ? `, недоступны ${p.left30.gone}` : ''})` : ''}`);
  if (p.subs) {
    const f = p.features;
    L.push('', `<b>Что включили подписчики</b>`);
    L.push(`🎧 голос — ${f.voice} · 🔮 Дизайн человека — ${f.hd}`);
    L.push(`🌙 Луна без курса — ${f.voc} · ✍️ вечерний вопрос — ${f.evening}`);
    L.push(`🔄 смена лунного дня — ${f.changes} · ☉ Солнце в воротах — ${f.sunGate}`);
  }
  if (p.places.length) {
    L.push('', `<b>Откуда</b>`);
    L.push(p.places.slice(0, 8).map(([n, c]) => `${esc(n)} — ${c}`).join(' · '));
  }
  const fresh = p.rows.slice(0, 10);
  if (fresh.length) {
    L.push('', `<b>Последние новенькие</b>`);
    for (const r of fresh) L.push(`• ${who(r)} — ${shortDate(r.first, p.at, p.tz)}${r.sub ? ` · ☀️ ${esc(r.place)}` : r.blocked ? ' · заблокировал(а)' : ''}`);
  }
  L.push('', `Весь список: /admin_vse`, `Обновить: /admin`);
  return L.join('\n');
}

/** Весь список людей, поделённый на сообщения до ~3800 знаков. */
export function panelList(p: PanelStats): string[] {
  const subs = p.rows.filter((r) => r.sub);
  const others = p.rows.filter((r) => !r.sub && !r.blocked);
  const blocked = p.rows.filter((r) => r.blocked);
  const lines: string[] = [];
  lines.push(`☀️ <b>Получают утреннее сообщение — ${subs.length}</b>`);
  for (const r of subs) {
    const d = shortDate(r.sub!.since, p.at, p.tz);
    const b = badges(r.sub!);
    lines.push(`• ${who(r)} — ${esc(r.place)}, в ${hhmm(r.sub!)}${b ? ` ${b}` : ''} · ${d === 'сегодня' || d === 'вчера' ? `подписка ${d}` : `с ${d}`}`);
  }
  if (!subs.length) lines.push('пока никого');
  lines.push('', `💤 <b>Писали боту, рассылку не включили — ${others.length}</b>`);
  for (const r of others) lines.push(`• ${who(r)} — впервые ${shortDate(r.first, p.at, p.tz)}, последний раз ${shortDate(r.last, p.at, p.tz)}`);
  if (!others.length) lines.push('никого');
  if (blocked.length) {
    lines.push('', `🚫 <b>Заблокировали бота — ${blocked.length}</b>`);
    for (const r of blocked) lines.push(`• ${who(r)} — был(а) с ${shortDate(r.first, p.at, p.tz)}`);
  }
  lines.push('', '🎧 голос · 🔮 Дизайн человека · 🌙 Луна без курса · ✍️ вечерний вопрос');
  const out: string[] = [];
  let cur = '';
  for (const l of lines) {
    if (cur.length + l.length + 1 > 3800) {
      out.push(cur.trimEnd());
      cur = '';
    }
    cur += l + '\n';
  }
  if (cur.trim()) out.push(cur.trimEnd());
  return out;
}

export interface Newcomer {
  kind: 'start' | 'sub' | 'unsub' | 'blocked';
  id: string;
}

/** Короткое уведомление владельцу о новеньких и ушедших за один запуск бота. */
export function newcomersText(state: BotState, list: Newcomer[], at: Date): string | null {
  if (!list.length) return null;
  const name = (id: string) => {
    const p = state.people?.[id];
    const n = p?.n || state.subs[id]?.firstName || 'без имени';
    return `${esc(n)}${p?.u ? ` (@${esc(p.u)})` : ''}`;
  };
  const L: string[] = [];
  for (const x of list) {
    const s = state.subs[x.id];
    if (x.kind === 'start') L.push(`👋 Новый человек в боте: ${name(x.id)}`);
    else if (x.kind === 'sub' && s) L.push(`🌱 Включил(а) утреннее сообщение: ${name(x.id)} — ${esc(placeOf(state, s, at))}, в ${hhmm(s)}`);
    else if (x.kind === 'unsub') L.push(`🍂 Отписка: ${name(x.id)}`);
    else if (x.kind === 'blocked') L.push(`🚫 Заблокировал(а) бота: ${name(x.id)}`);
  }
  if (!L.length) return null;
  const total = Object.keys(state.people ?? {}).length;
  return `${L.join('\n')}\n\n<i>Всего знают бота: ${total}, получают утреннее: ${Object.keys(state.subs).length}. Панель: /admin</i>`;
}

// ---------- карточка-картинка 1080×1350 ----------
const W = 1080;
const H = 1350;
const SERIF = "'Cormorant Garamond', 'DejaVu Serif', serif";
const SANS = "'Inter', 'DejaVu Sans', sans-serif";
const C = { ink: '#f4eee3', muted: '#b4bacb', faint: '#7d859c', gold: '#ecc98f', goldA: '#f8e3b5', goldB: '#c8924a', wine: '#9c2f47', wineA: '#c2536d', blue: '#8fb8ff' };
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function tile(x: number, y: number, w: number, h: number, value: string, label: string, sub: string, accent: string): string {
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="34" fill="#ffffff" fill-opacity="0.045" stroke="${accent}" stroke-opacity="0.35"/>` +
    `<text x="${x + w / 2}" y="${y + 128}" text-anchor="middle" font-family="${SANS}" font-weight="600" font-size="104" fill="${accent}">${xml(value)}</text>` +
    `<text x="${x + w / 2}" y="${y + 186}" text-anchor="middle" font-family="${SANS}" font-weight="600" font-size="27" fill="${C.ink}">${xml(label)}</text>` +
    `<text x="${x + w / 2}" y="${y + 224}" text-anchor="middle" font-family="${SANS}" font-size="23" fill="${C.faint}">${xml(sub)}</text>`
  );
}

/** Картинка панели: три больших числа, рост за 30 дней, что включено, откуда. */
export function panelSvg(p: PanelStats): string {
  const top = 250;
  const tw = 300;
  const gap = (W - 3 * tw - 2 * 60) / 2;
  const tiles =
    tile(60, top, tw, 250, String(p.known), 'знают бота', p.newPeople.week ? `+${p.newPeople.week} за неделю` : 'за неделю без новых', C.goldA) +
    tile(60 + tw + gap, top, tw, 250, String(p.subs), 'утренняя рассылка', p.known ? `${Math.round((p.subs / p.known) * 100)}% от всех` : '—', C.gold) +
    tile(60 + 2 * (tw + gap), top, tw, 250, String(p.active7), 'заходили за неделю', `ушли за месяц: ${p.left30.unsub + p.left30.blocked + p.left30.gone}`, C.wineA);

  // График: столбики — новые за день, линия — сколько всего.
  const gx = 90;
  const gy = 640;
  const gw = W - 180;
  const gh = 240;
  const maxTotal = Math.max(1, ...p.series.map((s) => s.total));
  const maxAdded = Math.max(1, ...p.series.map((s) => s.added));
  const step = gw / p.series.length;
  let bars = '';
  let line = '';
  p.series.forEach((s, i) => {
    const bh = (s.added / maxAdded) * gh * 0.55;
    if (s.added) bars += `<rect x="${(gx + i * step + step * 0.18).toFixed(1)}" y="${(gy + gh - bh).toFixed(1)}" width="${(step * 0.64).toFixed(1)}" height="${bh.toFixed(1)}" rx="4" fill="${C.wine}" fill-opacity="0.85"/>`;
    const lx = gx + i * step + step / 2;
    const ly = gy + gh - (s.total / maxTotal) * gh;
    line += `${i ? 'L' : 'M'}${lx.toFixed(1)} ${ly.toFixed(1)} `;
  });
  const last = p.series[p.series.length - 1]!;
  const lastX = gx + (p.series.length - 0.5) * step;
  const lastY = gy + gh - (last.total / maxTotal) * gh;
  const d0 = p.series[0]!.date.split('-').map(Number) as [number, number, number];
  const chart =
    `<text x="60" y="${gy - 56}" font-family="${SANS}" font-weight="600" font-size="22" letter-spacing="4" fill="${C.gold}">РОСТ ЗА 30 ДНЕЙ</text>` +
    `<line x1="${gx}" y1="${gy + gh}" x2="${gx + gw}" y2="${gy + gh}" stroke="#ffffff" stroke-opacity="0.12"/>` +
    `<line x1="${gx}" y1="${gy}" x2="${gx + gw}" y2="${gy}" stroke="#ffffff" stroke-opacity="0.06" stroke-dasharray="6 8"/>` +
    bars +
    `<path d="${line}" fill="none" stroke="${C.gold}" stroke-opacity="0.35" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<path d="${line}" fill="none" stroke="${C.goldA}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="10" fill="${C.goldA}"/>` +
    `<text x="${gx + gw}" y="${gy - 14}" text-anchor="end" font-family="${SANS}" font-size="22" fill="${C.muted}">всего ${maxTotal}</text>` +
    `<text x="${gx}" y="${gy + gh + 40}" font-family="${SANS}" font-size="22" fill="${C.faint}">${d0[2]} ${MON[d0[1] - 1]}</text>` +
    `<text x="${gx + gw}" y="${gy + gh + 40}" text-anchor="end" font-family="${SANS}" font-size="22" fill="${C.faint}">сегодня</text>` +
    `<rect x="${W / 2 - 170}" y="${gy + gh + 22}" width="18" height="18" rx="4" fill="${C.wine}"/><text x="${W / 2 - 144}" y="${gy + gh + 39}" font-family="${SANS}" font-size="22" fill="${C.faint}">новые за день</text>` +
    `<rect x="${W / 2 + 30}" y="${gy + gh + 28}" width="26" height="5" rx="2" fill="${C.goldA}"/><text x="${W / 2 + 66}" y="${gy + gh + 39}" font-family="${SANS}" font-size="22" fill="${C.faint}">всего</text>`;

  // Что включено и откуда.
  const by = 1010;
  const f = p.features;
  const feats: [string, number][] = [['голос', f.voice], ['Дизайн человека', f.hd], ['Луна без курса', f.voc], ['вечерний вопрос', f.evening]];
  let left = `<text x="60" y="${by}" font-family="${SANS}" font-weight="600" font-size="22" letter-spacing="4" fill="${C.gold}">ЧТО ВКЛЮЧИЛИ</text>`;
  feats.forEach(([n, c], i) => {
    const y = by + 52 + i * 52;
    left += `<text x="60" y="${y}" font-family="${SANS}" font-size="28" fill="${C.muted}">${xml(n)}</text><text x="470" y="${y}" text-anchor="end" font-family="${SANS}" font-weight="600" font-size="30" fill="${C.ink}">${c}</text>`;
  });
  let right = `<text x="580" y="${by}" font-family="${SANS}" font-weight="600" font-size="22" letter-spacing="4" fill="${C.gold}">ОТКУДА</text>`;
  const pl = p.places.slice(0, 4);
  const maxPl = Math.max(1, ...pl.map((x) => x[1]));
  if (!pl.length) right += `<text x="580" y="${by + 52}" font-family="${SANS}" font-size="28" fill="${C.faint}">пока нет подписчиков</text>`;
  pl.forEach(([n, c], i) => {
    const y = by + 52 + i * 52;
    const bw = (c / maxPl) * 300;
    right += `<rect x="580" y="${y + 10}" width="${bw.toFixed(1)}" height="6" rx="3" fill="${C.gold}" fill-opacity="0.55"/>` + `<text x="580" y="${y}" font-family="${SANS}" font-size="27" fill="${C.muted}">${xml(cut(n.replace(/^пояс /, ''), 22))}</text><text x="${W - 60}" y="${y}" text-anchor="end" font-family="${SANS}" font-weight="600" font-size="30" fill="${C.ink}">${c}</text>`;
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs><linearGradient id="bgV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1C2443"/><stop offset="0.5" stop-color="#141B34"/><stop offset="1" stop-color="#0B1020"/></linearGradient>` +
    `<radialGradient id="bgGlow" cx="${W / 2}" cy="0" r="760" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2E3A6E" stop-opacity="0.9"/><stop offset="1" stop-color="#2E3A6E" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="wine" cx="${W}" cy="${H}" r="700" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.wine}" stop-opacity="0.22"/><stop offset="1" stop-color="${C.wine}" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#bgV)"/><rect width="${W}" height="${H}" fill="url(#bgGlow)"/><rect width="${W}" height="${H}" fill="url(#wine)"/>` +
    `<text x="${W / 2}" y="92" text-anchor="middle" font-family="${SANS}" font-weight="600" font-size="23" letter-spacing="5" fill="${C.gold}">ПАНЕЛЬ ВЛАДЕЛЬЦА</text>` +
    `<text x="${W / 2}" y="168" text-anchor="middle" font-family="${SERIF}" font-weight="500" font-size="70" fill="${C.ink}">Энергия дня</text>` +
    `<text x="${W / 2}" y="214" text-anchor="middle" font-family="${SANS}" font-size="27" fill="${C.muted}">${xml(stamp(p.at, p.tz))}</text>` +
    tiles +
    chart +
    left +
    right +
    `<line x1="${W / 2 - 60}" y1="1272" x2="${W / 2 + 60}" y2="1272" stroke="${C.gold}" stroke-opacity="0.35"/>` +
    `<text x="${W / 2}" y="1310" text-anchor="middle" font-family="${SERIF}" font-size="30" fill="${C.faint}">видишь только ты</text>` +
    `</svg>`
  );
}

/** Подпись к картинке панели. */
export function panelCaption(p: PanelStats): string {
  return `📊 <b>Панель на ${stamp(p.at, p.tz)}</b>\nЗнают бота ${p.known}, получают утреннее ${p.subs}, новых за неделю ${p.newPeople.week}.`;
}

/** Ответ, пока владелец не вписан в настройки: номер чата, чтобы его вписать. */
export function adminSetupText(chatId: string): string {
  return `🔐 Панель владельца ещё не настроена.\n\nТвой номер в Телеграме: <code>${chatId}</code>\n\nЕсли это твой бот — открой на Бегете файл <b>energy-bot/nastroyki.env</b> и допиши в самый низ строку:\n<code>ADMIN_ID=${chatId}</code>\nСохрани файл, через минуту снова напиши /admin.`;
}
