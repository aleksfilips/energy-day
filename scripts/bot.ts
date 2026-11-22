/**
 * Бот «Энергия дня» без своего сервера. Запускается GitHub Actions каждые 10 минут (.github/workflows/bot.yml):
 *  1) забирает новые сообщения боту (getUpdates): подписка по коду из приложения, /stop, /today;
 *  2) отправляет утреннее сообщение тем, у кого по их местному времени наступило выбранное время;
 *  3) сохраняет список подписчиков ЗАШИФРОВАННЫМ (AES-256-GCM, ключ — секрет BOT_DATA_KEY) в ветку bot-data.
 * В журналах (они в публичном репозитории видны всем) печатаются только количества, без личных данных.
 *
 * Секреты: TELEGRAM_BOT_TOKEN, BOT_DATA_KEY. Необязательно: APP_URL.
 * Перенос владельца со старой схемы: TELEGRAM_CHAT_ID, LATITUDE, LONGITUDE, TIME_ZONE, LOCATION_NAME, BIRTH_DAY, BIRTH_MONTH.
 * Файл данных: аргумент --data <путь> (по умолчанию bot-data/subscribers.enc).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ResolvedLocation } from '../src/astro/location';
import { morningText } from '../src/bot/message';
import { applyUpdate, emptyState, isDue, localTime, type Action, type BotState, type Subscriber } from '../src/bot/state';
import { SITE_URL } from '../src/config';

const env = (k: string) => process.env[k]?.trim() || undefined;
const argAt = process.argv.indexOf('--data');
const DATA = argAt > 0 ? process.argv[argAt + 1]! : 'bot-data/subscribers.enc';
const token = env('TELEGRAM_BOT_TOKEN');
const key = env('BOT_DATA_KEY');
const appUrl = env('APP_URL') ?? SITE_URL;

// Без секретов спокойно выходим (иначе GitHub будет слать письмо об ошибке каждые 10 минут).
if (!token || !key || key.length < 16) {
  console.log(!token ? 'Нет секрета TELEGRAM_BOT_TOKEN — бот не запущен.' : 'Нет секрета BOT_DATA_KEY (фраза не короче 16 символов) — бот не запущен. Добавьте его в Settings → Secrets and variables → Actions.');
  process.exit(0);
}

// ---------- хранение ----------
const aesKey = createHash('sha256').update(key).digest();

function load(): BotState {
  if (!existsSync(DATA)) return emptyState();
  const f = JSON.parse(readFileSync(DATA, 'utf8')) as { iv: string; tag: string; data: string };
  const d = createDecipheriv('aes-256-gcm', aesKey, Buffer.from(f.iv, 'base64'));
  d.setAuthTag(Buffer.from(f.tag, 'base64'));
  const plain = Buffer.concat([d.update(Buffer.from(f.data, 'base64')), d.final()]).toString('utf8');
  return { ...emptyState(), ...(JSON.parse(plain) as BotState) };
}

function save(s: BotState): void {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', aesKey, iv);
  const data = Buffer.concat([c.update(JSON.stringify(s), 'utf8'), c.final()]);
  mkdirSync(dirname(DATA), { recursive: true });
  writeFileSync(DATA, JSON.stringify({ iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') }));
}

// ---------- Telegram ----------
interface TgResp<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
}

async function tg<T>(method: string, body: object): Promise<TgResp<T>> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${env('TELEGRAM_API') ?? 'https://api.telegram.org'}/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = (await res.json()) as TgResp<T>;
    if (j.error_code === 429 && j.parameters?.retry_after) {
      await new Promise((r) => setTimeout(r, (j.parameters!.retry_after! + 1) * 1000));
      continue;
    }
    return j;
  }
  return { ok: false, description: 'слишком много запросов' };
}

const openButton = (text = 'Открыть «Энергию дня»') => ({ inline_keyboard: [[{ text, web_app: { url: appUrl } }]] });

async function send(chatId: string, text: string, button = true): Promise<TgResp<unknown>> {
  return tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(button ? { reply_markup: openButton('Открыть подробно') } : {}) });
}

function locOf(s: Subscriber): ResolvedLocation {
  return { id: 'bot', name: s.placeName ?? '', latitude: s.sub.latitude, longitude: s.sub.longitude, elevation: 0, timeZone: s.sub.timeZone };
}

function textFor(s: Subscriber, now: Date, greet = true): string {
  const { date } = localTime(s.sub, now);
  return morningText({
    loc: locOf(s),
    placeName: s.placeName,
    date,
    birthday: s.sub.birthDay ? { day: s.sub.birthDay, month: s.sub.birthMonth } : null,
    firstName: greet ? s.firstName || undefined : undefined,
  });
}

const hhmm = (s: Subscriber) => `${String(s.sub.hour).padStart(2, '0')}:${String(s.sub.minute).padStart(2, '0')}`;

// ---------- работа ----------
let state: BotState;
try {
  state = load();
} catch {
  console.error('Не удалось расшифровать список подписчиков: секрет BOT_DATA_KEY не совпадает с тем, которым он был зашифрован.');
  process.exit(1);
}
const before = JSON.stringify(state);
const now = new Date();
const stats = { updates: 0, subscribed: 0, unsubscribed: 0, sent: 0, failed: 0, removed: 0 };

// Перенос владельца со старой схемы (один раз).
const ownerChat = env('TELEGRAM_CHAT_ID');
if (!state.ownerSeeded && ownerChat && env('LATITUDE') && env('LONGITUDE')) {
  if (!state.subs[ownerChat]) {
    state.subs[ownerChat] = {
      sub: {
        latitude: Number(env('LATITUDE')),
        longitude: Number(env('LONGITUDE')),
        timeZone: env('TIME_ZONE') ?? 'Asia/Yekaterinburg',
        birthDay: Number(env('BIRTH_DAY') ?? 0) || 0,
        birthMonth: Number(env('BIRTH_MONTH') ?? 0) || 0,
        hour: 7,
        minute: 30,
      },
      firstName: '',
      placeName: env('LOCATION_NAME'),
      lastSent: null,
      since: now.toISOString(),
    };
  }
  state.ownerSeeded = true;
}

// 1) Новые сообщения.
const upd = await tg<Parameters<typeof applyUpdate>[1][]>('getUpdates', { offset: state.offset + 1, timeout: 0, allowed_updates: ['message', 'my_chat_member'] });
if (!upd.ok) {
  console.error('getUpdates не сработал:', upd.description);
  if (/webhook/i.test(upd.description ?? '')) console.error('У бота включён webhook. Отключите его: откройте https://api.telegram.org/bot<токен>/deleteWebhook');
}
for (const u of upd.result ?? []) {
  stats.updates++;
  let a: Action;
  try {
    a = applyUpdate(state, u, now);
  } catch {
    continue;
  }
  if (a.kind === 'subscribed') {
    stats.subscribed++;
    const s = state.subs[a.chatId]!;
    await send(a.chatId, `${a.isNew ? '✨ Готово' : '✨ Данные обновлены'}${s.firstName ? `, ${s.firstName.replace(/[<>&]/g, '')}` : ''}! Каждое утро в ${hhmm(s)} по твоему времени буду присылать подсказку на день.\n\nНе нужно — напиши /stop. Сегодняшняя подсказка — ниже.`, false);
    try {
      const r = await send(a.chatId, textFor(s, now, false));
      if (r.ok) s.lastSent = localTime(s.sub, now).date;
    } catch {
      stats.failed++;
    }
  } else if (a.kind === 'unsubscribed') {
    stats.unsubscribed++;
    await tg('sendMessage', { chat_id: a.chatId, text: a.wasSubscribed ? 'Хорошо, больше не буду присылать утренние сообщения. Включить снова: в приложении «Ещё» → «Утреннее сообщение».' : 'Утренние сообщения и так выключены.', reply_markup: openButton() });
  } else if (a.kind === 'today') {
    const s = state.subs[a.chatId];
    if (s) await send(a.chatId, textFor(s, now, false));
    else await tg('sendMessage', { chat_id: a.chatId, text: 'Чтобы я присылал подсказку для твоего места, открой приложение и включи «Утреннее сообщение» в разделе «Ещё».', reply_markup: openButton() });
  } else if (a.kind === 'bad-code') {
    await tg('sendMessage', { chat_id: a.chatId, text: 'Не получилось прочитать данные подписки. Открой приложение и нажми «Включить» ещё раз.', reply_markup: openButton() });
  } else if (a.kind === 'welcome') {
    await tg('sendMessage', {
      chat_id: a.chatId,
      text: `Привет${a.firstName ? `, ${a.firstName}` : ''}! Это «Энергия дня» — лунный календарь с подсказками на каждый день.\n\nОткрой приложение кнопкой ниже и введи своё место и дату рождения. Если хочешь получать подсказку каждое утро, включи «Утреннее сообщение» в разделе «Ещё».`,
      reply_markup: openButton(),
    });
  }
}

// 2) Утренние сообщения.
for (const [chatId, s] of Object.entries(state.subs)) {
  if (!isDue(s, now)) continue;
  try {
    const r = await send(chatId, textFor(s, now));
    if (r.ok) {
      s.lastSent = localTime(s.sub, now).date;
      stats.sent++;
    } else if (r.error_code === 403 || r.error_code === 400) {
      // Человек заблокировал бота или удалил чат — больше не пишем.
      delete state.subs[chatId];
      stats.removed++;
    } else stats.failed++;
  } catch {
    stats.failed++;
  }
}

if (JSON.stringify(state) !== before) save(state);
console.log(`Подписчиков: ${Object.keys(state.subs).length}. Сообщений боту: ${stats.updates}, подписались/обновили: ${stats.subscribed}, отписались: ${stats.unsubscribed}. Отправлено утренних: ${stats.sent}, ошибок: ${stats.failed}, удалено недоступных: ${stats.removed}.`);
