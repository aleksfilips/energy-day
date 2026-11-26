/**
 * Логика бота без сети: подписчики, разбор команд, кому пора отправлять. Покрыта тестами (tests/bot.test.ts).
 */
import { toDateKey, wallClock, type DateKey } from '../astro/time';
import { decodeSubscription, type Subscription } from './payload';
import { decodeReminder } from './reminder';

export interface Subscriber {
  sub: Subscription;
  firstName: string;
  /** Подпись места в заголовке (только у владельца из настроек репозитория). */
  placeName?: string;
  lastSent: DateKey | null;
  /** Начало лунного дня, о смене на который уже сообщили (ISO). */
  lastChange?: string;
  /** Начало Луны без курса, о которой уже предупредили (ISO). */
  lastVoc?: string;
  /** Дата последнего вечернего вопроса. */
  lastEvening?: DateKey;
  /** Ворота Солнца, о которых уже сообщили. */
  lastSunGate?: number;
  /** Напоминания о днях, выбранных в «Подобрать день». */
  reminders?: { date: DateKey; area: string }[];
  since: string;
}

/** Каждый, кто хоть раз писал боту (нажал «Старт» и т.п.) — для панели владельца (D-151). */
export interface Person {
  /** Имя в Телеграме. */
  n: string;
  /** @логин в Телеграме, если есть. */
  u?: string;
  /** Когда впервые написал боту (ISO). */
  first: string;
  /** Когда последний раз писал боту (ISO). */
  last: string;
  /** Заблокировал бота. */
  blocked?: boolean;
}

/** Событие для панели: кто ушёл и когда. */
export interface PanelEvent {
  t: string;
  k: 'unsub' | 'blocked' | 'gone';
  id: string;
}

export interface BotState {
  v: 1;
  /** Последний обработанный update_id Telegram. */
  offset: number;
  /** Владелец из старых настроек уже перенесён (чтобы его отписка работала). */
  ownerSeeded: boolean;
  subs: Record<string, Subscriber>;
  /** Все, кто писал боту (D-151). Нет — список ещё не заводили (старые данные). */
  people?: Record<string, Person>;
  /** Последние уходы (отписка, блокировка), до 300 штук. */
  events?: PanelEvent[];
  /** Названия мест по координатам (округление до 0,01°), чтобы не спрашивать карту повторно. */
  places?: Record<string, string>;
}

export const emptyState = (): BotState => ({ v: 1, offset: 0, ownerSeeded: false, subs: {}, people: {}, events: [] });

/** Старые данные без списка людей: заводим его из подписчиков (их дата подписки = первое знакомство). */
export function ensurePeople(state: BotState): void {
  if (state.people) return;
  state.people = {};
  for (const [id, s] of Object.entries(state.subs)) state.people[id] = { n: s.firstName, first: s.since, last: s.since };
  state.events ??= [];
}

export function addEvent(state: BotState, k: PanelEvent['k'], id: string, now: Date): void {
  state.events = [...(state.events ?? []), { t: now.toISOString(), k, id }].slice(-300);
}

/** Ключ места для кэша названий. */
export const placeKey = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

/** Сколько часов после назначенного времени ещё можно догнать (если GitHub запустил задачу с опозданием). */
export const CATCH_UP_HOURS = 4;

export type Action =
  | { kind: 'subscribed'; chatId: string; isNew: boolean }
  | { kind: 'unsubscribed'; chatId: string; wasSubscribed: boolean }
  | { kind: 'today'; chatId: string; subscribed: boolean }
  | { kind: 'welcome'; chatId: string; firstName: string }
  | { kind: 'bad-code'; chatId: string }
  | { kind: 'voices'; chatId: string }
  | { kind: 'remind'; chatId: string; date: DateKey; area: string; subscribed: boolean }
  /** Панель владельца: full — весь список людей. */
  | { kind: 'admin'; chatId: string; full: boolean }
  /** Владелец ещё не указан в настройках: подсказываем номер чата, чтобы его вписать. */
  | { kind: 'admin-setup'; chatId: string }
  | { kind: 'ignore' };

interface TgUpdate {
  update_id: number;
  message?: { chat: { id: number; type: string }; from?: { first_name?: string; username?: string }; text?: string };
  my_chat_member?: { chat: { id: number; type: string }; new_chat_member: { status: string } };
}

/**
 * Применяет одно обновление Telegram к состоянию и говорит, что ответить.
 * adminId — номер чата владельца (ADMIN_ID): только ему открывается панель /admin (D-151).
 * Остальным /admin выглядит как обычное приветствие — о панели они не узнают.
 */
export function applyUpdate(state: BotState, u: TgUpdate, now: Date, adminId?: string): Action {
  state.offset = Math.max(state.offset, u.update_id);
  ensurePeople(state);
  if (u.my_chat_member) {
    const chatId = String(u.my_chat_member.chat.id);
    const status = u.my_chat_member.new_chat_member.status;
    const p = state.people![chatId];
    if (status === 'kicked') {
      delete state.subs[chatId];
      if (p && !p.blocked) addEvent(state, 'blocked', chatId, now);
      if (p) p.blocked = true;
    } else if (status === 'member' && p) delete p.blocked;
    return { kind: 'ignore' };
  }
  const msg = u.message;
  if (!msg || msg.chat.type !== 'private' || !msg.text) return { kind: 'ignore' };
  const chatId = String(msg.chat.id);
  const firstName = (msg.from?.first_name ?? '').slice(0, 40);
  const username = msg.from?.username?.slice(0, 40);
  const nowIso = now.toISOString();
  const known = state.people![chatId];
  state.people![chatId] = { ...known, n: firstName, ...(username ? { u: username } : {}), first: known?.first ?? nowIso, last: nowIso };
  delete state.people![chatId]!.blocked;
  const text = msg.text.trim();
  const [cmd, arg = ''] = text.split(/\s+/, 2) as [string, string?];
  const command = cmd.toLowerCase().replace(/@\w+$/, '');

  if (command === '/admin' || command === '/admin_vse') {
    if (adminId && chatId === adminId) return { kind: 'admin', chatId, full: command === '/admin_vse' || arg === 'vse' };
    if (!adminId) return { kind: 'admin-setup', chatId };
    return { kind: 'welcome', chatId, firstName };
  }
  if (command === '/stop' || (command === '/start' && arg === 'stop')) {
    const was = chatId in state.subs;
    delete state.subs[chatId];
    if (was) addEvent(state, 'unsub', chatId, now);
    return { kind: 'unsubscribed', chatId, wasSubscribed: was };
  }
  if (command === '/golos' || command === '/voices' || (command === '/start' && arg === 'golos')) return { kind: 'voices', chatId };
  if (command === '/start' && /^r/.test(arg)) {
    const r = decodeReminder(arg);
    if (!r) return { kind: 'bad-code', chatId };
    const s = state.subs[chatId];
    if (s) {
      const list = (s.reminders ?? []).filter((x) => !(x.date === r.date && x.area === r.area));
      s.reminders = [...list, r].sort((a, b) => a.date.localeCompare(b.date)).slice(-20);
    }
    return { kind: 'remind', chatId, date: r.date, area: r.area, subscribed: !!s };
  }
  if (command === '/start' && /^[acd]/.test(arg)) {
    const sub = decodeSubscription(arg);
    if (!sub) return { kind: 'bad-code', chatId };
    const prev = state.subs[chatId];
    state.subs[chatId] = { ...prev, sub, firstName, lastSent: prev?.lastSent ?? null, since: prev?.since ?? now.toISOString() };
    return { kind: 'subscribed', chatId, isNew: !prev };
  }
  if (command === '/today') return { kind: 'today', chatId, subscribed: chatId in state.subs };
  return { kind: 'welcome', chatId, firstName };
}

/** Местная дата и минуты от полуночи для подписчика. */
export function localTime(s: Subscription, now: Date): { date: DateKey; minutes: number } {
  const w = wallClock(now, s.timeZone);
  return { date: toDateKey(now, s.timeZone), minutes: w.hour * 60 + w.minute };
}

/** Пора ли отправлять: уже наступило назначенное время, сегодня ещё не отправляли, и не прошло окно догоняния. */
export function isDue(s: Subscriber, now: Date): boolean {
  const { date, minutes } = localTime(s.sub, now);
  if (s.lastSent === date) return false;
  const at = s.sub.hour * 60 + s.sub.minute;
  return minutes >= at && minutes < at + CATCH_UP_HOURS * 60;
}
