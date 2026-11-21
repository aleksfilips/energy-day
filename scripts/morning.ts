/**
 * Утреннее сообщение «Энергия дня» от бота. Запускается GitHub Actions по расписанию (без своего сервера).
 * Все параметры — из секретов репозитория, в коде нет личных данных:
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, APP_URL,
 *   LOCATION_NAME, LATITUDE, LONGITUDE, TIME_ZONE (по умолчанию Asia/Yekaterinburg),
 *   BIRTH_DAY, BIRTH_MONTH (необязательно, для личного дня).
 * Запуск вручную: npx tsx scripts/morning.ts --dry  (печатает текст, ничего не отправляет)
 */
import * as A from '../src/astro';
import { makeContent } from '../src/content';
import { DEFAULT_NUMEROLOGY } from '../src/personal/numerology';
import { computeDay } from '../src/synthesis/day';
import { synthesize } from '../src/synthesis/rules';

const env = (k: string, d?: string) => process.env[k]?.trim() || d;
const dry = process.argv.includes('--dry');

const lat = Number(env('LATITUDE', '57.1401'));
const lon = Number(env('LONGITUDE', '60.1476'));
const tz = env('TIME_ZONE', 'Asia/Yekaterinburg')!;
const loc: A.ResolvedLocation = { id: 'bot', name: env('LOCATION_NAME', 'Калиново')!, latitude: lat, longitude: lon, elevation: 0, timeZone: tz };
const bd = Number(env('BIRTH_DAY', '0'));
const bm = Number(env('BIRTH_MONTH', '0'));

const now = new Date();
const date = A.toDateKey(now, tz);
const day = computeDay(loc, date, {
  daylight: { from: 7, to: 23 },
  vocMode: 'modern',
  zodiac: 'tropical',
  vedic: false,
  garden: false,
  birthday: bd && bm ? { day: bd, month: bm } : null,
  numerology: DEFAULT_NUMEROLOGY,
});
const content = makeContent();
const card = synthesize(day, content);
const t = (d: Date) => A.formatTime(d, tz);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ld = content.lunarDay(day.dominant.number);
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const [, m, d] = date.split('-').map(Number) as [number, number, number];

const lines = [
  `<b>${d} ${MONTHS[m - 1]}</b> · ${esc(loc.name)}`,
  '',
  `🌙 ${esc(A.describeLunarDays(day.lunarDays, tz))} · ${esc(ld.symbols[0]!)}`,
  `${esc(A.PHASE_NAMES[day.phase.phase])}, ${Math.round(day.phase.illuminationPct)}% · Луна ${esc(A.inSign(day.dominantSign))}`,
  '',
  esc(card.summary),
  '',
  card.tags.join(' · '),
];
const vocs = card.modifiers.filter((x) => x.key === 'voc');
if (vocs.length) lines.push('', `Луна без курса: ${vocs.map((v) => esc(v.text.split(':')[0]!)).join(', ')}`);
for (const mm of card.modifiers.filter((x) => ['eclipse', 'new', 'full', 'supermoon', 'corridor'].includes(x.key))) lines.push(`${esc(mm.title)}: ${esc(mm.text)}`);
if (card.personal) lines.push('', `Мой личный день: <b>${card.personal.number}</b> (${esc(card.personal.color.name)}) — ${esc(card.personal.note.replace(/^для тебя лично это день числа \d+: /, ''))}`);
lines.push('', '<i>Ориентир для внимания. Решение принимаешь ты.</i>');
const text = lines.join('\n');

if (dry) {
  console.log(text);
  process.exit(0);
}

const token = env('TELEGRAM_BOT_TOKEN');
const chat = env('TELEGRAM_CHAT_ID');
const url = env('APP_URL');
if (!token || !chat) {
  console.error('Нужны секреты TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID');
  process.exit(1);
}
const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    chat_id: chat,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(url ? { reply_markup: { inline_keyboard: [[{ text: 'Открыть день', web_app: { url } }]] } } : {}),
  }),
});
const body = await res.json();
if (!res.ok || !body.ok) {
  console.error('Telegram ответил ошибкой:', body.description ?? res.status);
  process.exit(1);
}
console.log('Отправлено', date, t(now));
