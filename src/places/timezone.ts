/**
 * Часовые пояса для людей: проверка, подписи и исторические переводы часов.
 * Исторические правила (летнее время до 2011, смены поясов 1991, 2011, 2014, 2016…) берутся
 * из базы IANA, встроенной в браузер (Intl). Мы ничего не считаем «на глаз».
 */
import { tzOffsetMinutes, wallClock, zonedTimeToUtc } from '../astro/time';

/** Новые имена поясов, которых может не знать старый телефон, → прежние имена того же пояса. */
const LEGACY: Record<string, string> = {
  'Europe/Kyiv': 'Europe/Kiev',
  'America/Ciudad_Juarez': 'America/Ojinaga',
  'Pacific/Kanton': 'Pacific/Enderbury',
  'America/Nuuk': 'America/Godthab',
  'Asia/Yangon': 'Asia/Rangoon',
  'Asia/Kolkata': 'Asia/Calcutta',
  'Asia/Kathmandu': 'Asia/Katmandu',
  'Asia/Ho_Chi_Minh': 'Asia/Saigon',
  'Atlantic/Faroe': 'Atlantic/Faeroe',
};

export function isValidTimeZone(z: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: z }).format(0);
    return true;
  } catch {
    return false;
  }
}

/** Имя пояса, которое точно поймёт этот телефон. */
export function safeTimeZone(z: string): string {
  if (isValidTimeZone(z)) return z;
  const legacy = LEGACY[z];
  if (legacy && isValidTimeZone(legacy)) return legacy;
  return z;
}

/** «UTC+5», «UTC+5:30», «UTC−3». */
export function offsetText(minutes: number): string {
  const sign = minutes < 0 ? '−' : '+';
  const a = Math.abs(minutes);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

/** Понятная подпись пояса: «Екатеринбург, стандартное время · UTC+5». */
export function zoneLabel(z: string, at: Date = new Date()): string {
  let name = '';
  try {
    name = new Intl.DateTimeFormat('ru-RU', { timeZone: z, timeZoneName: 'longGeneric' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    /* старый браузер */
  }
  const off = offsetText(tzOffsetMinutes(at, z));
  return name && !/^GMT|^UTC/.test(name) ? `${name} · ${off}` : off;
}

/** Местное время сейчас в поясе: «22:41». */
export function localNow(z: string, at: Date = new Date()): string {
  const w = wallClock(at, z);
  return `${String(w.hour).padStart(2, '0')}:${String(w.minute).padStart(2, '0')}`;
}

export interface BirthMoment {
  utc: Date;
  /** Смещение от UTC в момент рождения, минуты. */
  offset: number;
  /** Летнее время было в этот день (смещение больше, чем зимой того года). */
  summer: boolean;
  /** Такого местного времени не было: часы переводили вперёд. */
  nonexistent: boolean;
  /** Это местное время было дважды: часы переводили назад. Берём первое (летнее). */
  ambiguous: boolean;
}

/** Момент рождения с проверкой перевода часов. */
export function birthMoment(y: number, mo: number, d: number, h: number, mi: number, z: string): BirthMoment {
  const utc = zonedTimeToUtc(y, mo, d, h, mi, z);
  const w = wallClock(utc, z);
  const nonexistent = w.year !== y || w.month !== mo || w.day !== d || w.hour !== h || w.minute !== mi;
  const offset = tzOffsetMinutes(utc, z);
  // Двойное время: то же местное время встречается и на час раньше/позже по UTC с другим смещением.
  let ambiguous = false;
  let chosen = utc;
  for (const shift of [-60, 60, -30, 30, -120, 120]) {
    const alt = new Date(utc.getTime() + shift * 60_000);
    const wa = wallClock(alt, z);
    if (wa.year === y && wa.month === mo && wa.day === d && wa.hour === h && wa.minute === mi) {
      ambiguous = true;
      if (alt < chosen) chosen = alt;
    }
  }
  const off = tzOffsetMinutes(chosen, z);
  // Летнее время: смещение больше «зимнего» в этом году. Берём минимум из января, июля и января следующего года,
  // чтобы год смены пояса (например, Самара 2010) не путал, и южное полушарие (лето в январе) тоже работало.
  const base = Math.min(
    tzOffsetMinutes(new Date(Date.UTC(y, 0, 15, 12)), z),
    tzOffsetMinutes(new Date(Date.UTC(y, 6, 15, 12)), z),
    tzOffsetMinutes(new Date(Date.UTC(y + 1, 0, 15, 12)), z),
  );
  const summer = off > base;
  return { utc: chosen, offset: ambiguous ? off : offset, summer, nonexistent, ambiguous };
}
