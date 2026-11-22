/**
 * Логика бота без сети: подписчики, разбор команд, кому пора отправлять. Покрыта тестами (tests/bot.test.ts).
 */
import { toDateKey, wallClock, type DateKey } from '../astro/time';
import { decodeSubscription, type Subscription } from './payload';

export interface Subscriber {
  sub: Subscription;
  firstName: string;
  /** Подпись места в заголовке (только у владельца из настроек репозитория). */
  placeName?: string;
  lastSent: DateKey | null;
  since: string;
}

export interface BotState {
  v: 1;
  /** Последний обработанный update_id Telegram. */
  offset: number;
  /** Владелец из старых настроек уже перенесён (чтобы его отписка работала). */
  ownerSeeded: boolean;
  subs: Record<string, Subscriber>;
}

export const emptyState = (): BotState => ({ v: 1, offset: 0, ownerSeeded: false, subs: {} });

/** Сколько часов после назначенного времени ещё можно догнать (если GitHub запустил задачу с опозданием). */
export const CATCH_UP_HOURS = 4;

export type Action =
  | { kind: 'subscribed'; chatId: string; isNew: boolean }
  | { kind: 'unsubscribed'; chatId: string; wasSubscribed: boolean }
  | { kind: 'today'; chatId: string; subscribed: boolean }
  | { kind: 'welcome'; chatId: string; firstName: string }
  | { kind: 'bad-code'; chatId: string }
  | { kind: 'ignore' };

interface TgUpdate {
  update_id: number;
  message?: { chat: { id: number; type: string }; from?: { first_name?: string }; text?: string };
  my_chat_member?: { chat: { id: number; type: string }; new_chat_member: { status: string } };
}

/** Применяет одно обновление Telegram к состоянию и говорит, что ответить. */
export function applyUpdate(state: BotState, u: TgUpdate, now: Date): Action {
  state.offset = Math.max(state.offset, u.update_id);
  if (u.my_chat_member) {
    const chatId = String(u.my_chat_member.chat.id);
    if (u.my_chat_member.new_chat_member.status === 'kicked') {
      delete state.subs[chatId];
    }
    return { kind: 'ignore' };
  }
  const msg = u.message;
  if (!msg || msg.chat.type !== 'private' || !msg.text) return { kind: 'ignore' };
  const chatId = String(msg.chat.id);
  const firstName = (msg.from?.first_name ?? '').slice(0, 40);
  const text = msg.text.trim();
  const [cmd, arg = ''] = text.split(/\s+/, 2) as [string, string?];
  const command = cmd.toLowerCase().replace(/@\w+$/, '');

  if (command === '/stop' || (command === '/start' && arg === 'stop')) {
    const was = chatId in state.subs;
    delete state.subs[chatId];
    return { kind: 'unsubscribed', chatId, wasSubscribed: was };
  }
  if (command === '/start' && arg.startsWith('a')) {
    const sub = decodeSubscription(arg);
    if (!sub) return { kind: 'bad-code', chatId };
    const prev = state.subs[chatId];
    state.subs[chatId] = { sub, firstName, lastSent: prev?.lastSent ?? null, since: prev?.since ?? now.toISOString() };
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
