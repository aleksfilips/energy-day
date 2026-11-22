/**
 * Профиль человека: имя, место, дата и время рождения.
 * Хранится на устройстве (IndexedDB). Если человек открыл приложение в Telegram и не выключил
 * «Хранить мои данные в Telegram», копия профиля лежит в его личном облаке Telegram (CloudStorage):
 * на новом телефоне или после переустановки ничего не надо вводить заново. Дневник туда не попадает.
 */
import type { Location } from '../astro/location';
import type { BirthData } from '../humandesign/chart';
import type { Birthday } from '../personal/numerology';
import { cloudAvailable, cloudLoad, cloudSave } from '../telegram';
import type { Settings } from './settings';

export interface CloudProfile {
  v: 1;
  name: string | null;
  locations: Location[];
  activeLocationId: string;
  homeLocationId: string;
  birthday: Birthday | null;
  humanDesign: BirthData | null;
}

const KEY = 'profile';

export function profileOf(s: Settings): CloudProfile {
  return {
    v: 1,
    name: s.name,
    locations: s.locations,
    activeLocationId: s.activeLocationId,
    homeLocationId: s.homeLocationId,
    birthday: s.birthday,
    humanDesign: s.humanDesign,
  };
}

/** Проверка формы: в облаке может лежать что угодно. */
export function parseProfile(text: string | null): CloudProfile | null {
  if (!text) return null;
  try {
    const p = JSON.parse(text) as Partial<CloudProfile>;
    if (p.v !== 1 || !Array.isArray(p.locations)) return null;
    const locs = p.locations.filter(
      (l): l is Location => !!l && typeof l.id === 'string' && typeof l.name === 'string' && typeof l.timeZone === 'string' && (l.latitude === null || typeof l.latitude === 'number') && (l.longitude === null || typeof l.longitude === 'number'),
    );
    if (!locs.length) return null;
    return {
      v: 1,
      name: typeof p.name === 'string' ? p.name : null,
      locations: locs,
      activeLocationId: typeof p.activeLocationId === 'string' ? p.activeLocationId : locs[0]!.id,
      homeLocationId: typeof p.homeLocationId === 'string' ? p.homeLocationId : locs[0]!.id,
      birthday: p.birthday && typeof p.birthday.day === 'number' && typeof p.birthday.month === 'number' ? { day: p.birthday.day, month: p.birthday.month } : null,
      humanDesign: p.humanDesign && typeof p.humanDesign.year === 'number' && typeof p.humanDesign.timeZone === 'string' ? p.humanDesign : null,
    };
  } catch {
    return null;
  }
}

export async function loadCloudProfile(): Promise<CloudProfile | null> {
  if (!cloudAvailable()) return null;
  try {
    return parseProfile(await cloudLoad(KEY));
  } catch {
    return null;
  }
}

let last = '';
export async function saveCloudProfile(s: Settings): Promise<void> {
  if (!cloudAvailable() || !s.onboarded || !s.cloudProfile) return;
  const text = JSON.stringify(profileOf(s));
  if (text === last) return;
  try {
    await cloudSave(KEY, text);
    last = text;
  } catch {
    /* облако недоступно — данные всё равно есть на устройстве */
  }
}

export async function clearCloudProfile(): Promise<void> {
  if (!cloudAvailable()) return;
  try {
    await cloudSave(KEY, '');
    last = '';
  } catch {
    /* ignore */
  }
}
