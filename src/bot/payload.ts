/**
 * Подписка на утреннее сообщение передаётся боту ссылкой t.me/<бот>?start=<код>.
 * Telegram разрешает в коде до 64 символов A–Z a–z 0–9 _ -, поэтому данные упакованы в байты:
 *   'a' (версия) + base64url( широта×1e5 int32 | долгота×1e5 int32 | день | месяц | час | минута | IANA-зона ASCII )
 * Имени и года рождения в коде нет: для утреннего сообщения нужны только место, день и месяц рождения и время отправки.
 *
 * Версия 'c' (D-137) добавляет голос и Дизайн человека:
 *   'c' + base64url( те же 12 байт | флаги | момент рождения в минутах от 1900-01-01 UTC, uint32 (0 — нет) | зона )
 *   флаги: биты 0–1 — голос (0 нет, 1 Светлана, 2 Дария, 3 Алёна), бит 2 — транзиты Дизайна человека с бодиграфом.
 * Код открытый, но читает его только бот: человек сам отправляет его боту в личном чате, бот хранит список зашифрованным.
 */

export interface Subscription {
  latitude: number;
  longitude: number;
  timeZone: string;
  /** День и месяц рождения для личного дня; 0 — не указан. */
  birthDay: number;
  birthMonth: number;
  /** Во сколько присылать, местное время. */
  hour: number;
  minute: number;
  /** Голосовое сообщение: 0 — нет, 1 — Светлана, 2 — Дария, 3 — Алёна (Яндекс). */
  voice?: VoiceId;
  /** Транзиты Дизайна человека с картинкой бодиграфа (нужен момент рождения). */
  hd?: boolean;
  /** Момент рождения, UTC, мс (для Дизайна человека). */
  birthUtc?: number;
}

export type VoiceId = 0 | 1 | 2 | 3;
export const VOICE_NAMES: Record<Exclude<VoiceId, 0>, string> = { 1: 'Светлана', 2: 'Дария', 3: 'Алёна' };

const EPOCH_1900 = Date.UTC(1900, 0, 1);
const hasExtras = (s: Subscription) => !!s.voice || (!!s.hd && s.birthUtc !== undefined);

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function b64url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63]!;
    if (i + 2 < bytes.length) out += B64[n & 63]!;
  }
  return out;
}

export function unb64url(s: string): Uint8Array | null {
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 255);
    }
  }
  return new Uint8Array(out);
}

export const MAX_START = 64;

export function encodeSubscription(s: Subscription): string {
  const tz = s.timeZone;
  if (!/^[A-Za-z0-9_+\-/]+$/.test(tz)) throw new Error('Неожиданное имя часового пояса');
  if (hasExtras(s)) {
    const code = encodeV2(s);
    if (code.length <= MAX_START) return code;
  }
  const bytes = new Uint8Array(12 + tz.length);
  head(bytes, s);
  for (let i = 0; i < tz.length; i++) bytes[12 + i] = tz.charCodeAt(i);
  const code = `a${b64url(bytes)}`;
  if (code.length > MAX_START) throw new Error('Код подписки длиннее 64 символов');
  return code;
}

/** Помещается ли в код голос и Дизайн человека (для очень длинных имён часовых поясов — нет). */
export function extrasFit(s: Subscription): boolean {
  return encodeV2(s).length <= MAX_START;
}

function head(bytes: Uint8Array, s: Subscription): void {
  const dv = new DataView(bytes.buffer);
  dv.setInt32(0, Math.round(s.latitude * 1e5));
  dv.setInt32(4, Math.round(s.longitude * 1e5));
  bytes[8] = s.birthDay;
  bytes[9] = s.birthMonth;
  bytes[10] = s.hour;
  bytes[11] = s.minute;
}

function encodeV2(s: Subscription): string {
  const tz = s.timeZone;
  const bytes = new Uint8Array(17 + tz.length);
  head(bytes, s);
  const hd = !!s.hd && s.birthUtc !== undefined;
  bytes[12] = (s.voice ?? 0) | (hd ? 4 : 0);
  const mins = hd ? Math.round((s.birthUtc! - EPOCH_1900) / 60000) : 0;
  new DataView(bytes.buffer).setUint32(13, Math.max(0, mins));
  for (let i = 0; i < tz.length; i++) bytes[17 + i] = tz.charCodeAt(i);
  return `c${b64url(bytes)}`;
}

export function decodeSubscription(code: string): Subscription | null {
  if (!/^[ac]/.test(code) || code.length > MAX_START) return null;
  const v2 = code[0] === 'c';
  const bytes = unb64url(code.slice(1));
  if (!bytes || bytes.length < (v2 ? 18 : 13)) return null;
  const dv = new DataView(bytes.buffer);
  const latitude = dv.getInt32(0) / 1e5;
  const longitude = dv.getInt32(4) / 1e5;
  const [birthDay, birthMonth, hour, minute] = [bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!];
  const timeZone = String.fromCharCode(...bytes.slice(v2 ? 17 : 12));
  const flags = v2 ? bytes[12]! : 0;
  const mins = v2 ? dv.getUint32(13) : 0;
  const ok =
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    birthDay <= 31 &&
    birthMonth <= 12 &&
    (birthDay === 0) === (birthMonth === 0) &&
    hour < 24 &&
    minute < 60 &&
    flags < 8 &&
    (!(flags & 4) || mins > 0) &&
    /^[A-Za-z0-9_+\-/]+$/.test(timeZone);
  if (!ok) return null;
  const base: Subscription = { latitude, longitude, timeZone, birthDay, birthMonth, hour, minute };
  if (!v2) return base;
  const voice = (flags & 3) as VoiceId;
  return { ...base, voice, hd: !!(flags & 4), ...(flags & 4 ? { birthUtc: EPOCH_1900 + mins * 60000 } : {}) };
}

/** Ссылка на бота с кодом подписки. */
export function subscribeLink(bot: string, s: Subscription): string {
  return `https://t.me/${bot.replace(/^@/, '')}?start=${encodeSubscription(s)}`;
}

export function unsubscribeLink(bot: string): string {
  return `https://t.me/${bot.replace(/^@/, '')}?start=stop`;
}
