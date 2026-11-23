/** Код напоминания для ссылки t.me/<бот>?start=r… (D-146): дни от 2024-01-01 и номер сферы. */
import type { DateKey } from '../astro/time';
import { AREAS, type AreaKey } from '../synthesis/areas';
import { b64url, unb64url } from './payload';

export interface Reminder {
  date: DateKey;
  area: AreaKey;
}

const EPOCH = Date.UTC(2024, 0, 1);
const AREA_KEYS = AREAS.map((a) => a.key);

/** Код для ссылки t.me/<бот>?start=r…: дни от 2024-01-01 и номер сферы. */
export function encodeReminder(r: Reminder): string {
  const [y, m, d] = r.date.split('-').map(Number) as [number, number, number];
  const days = Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000);
  return `r${b64url(new Uint8Array([days >> 8, days & 255, AREA_KEYS.indexOf(r.area)]))}`;
}

export function decodeReminder(code: string): Reminder | null {
  if (!/^r[A-Za-z0-9_-]{4}$/.test(code)) return null;
  const b = unb64url(code.slice(1));
  if (!b || b.length < 3) return null;
  const area = AREA_KEYS[b[2]!];
  if (!area) return null;
  const t = new Date(EPOCH + ((b[0]! << 8) | b[1]!) * 86400000);
  return { date: t.toISOString().slice(0, 10) as DateKey, area };
}

