import type { Location } from '../astro/location';
import { LOCATION_PRESETS, DEFAULT_LOCATION_ID } from '../astro/location';
import type { VocMode } from '../astro/voc';
import type { ZodiacMode } from '../astro/zodiac';
import { DEFAULT_NUMEROLOGY, type Birthday, type NumerologyOptions } from '../personal/numerology';
import type { BirthData } from '../humandesign/chart';

export type Theme = 'dark' | 'light' | 'telegram';

export interface HdPerson {
  id: string;
  name: string;
  birth: BirthData;
  note: string;
  tags: string[];
}

export interface Settings {
  version: 1;
  onboarded: boolean;
  /** Как обращаться к человеку. null — имя из Telegram. */
  name: string | null;
  locations: Location[];
  activeLocationId: string;
  homeLocationId: string;
  daylight: { from: number; to: number };
  vocMode: VocMode;
  zodiac: ZodiacMode;
  layers: { vedic: boolean; garden: boolean; personal: boolean };
  birthday: Birthday | null;
  /** Полные данные рождения для Дизайна человека (только на устройстве). */
  humanDesign: BirthData | null;
  /** Решение, которое Рефлектор проживает лунный цикл (D-133). start — ISO-время начала. */
  hdDecision: { title: string; start: string } | null;
  /** Силуэт на бодиграфе: мужской или женский (null — ещё не выбран, рисуется мужской). */
  hdSilhouette: 'm' | 'f' | null;
  numerology: NumerologyOptions;
  theme: Theme;
  haptics: boolean;
  /** Резервная копия дневника в облаке Telegram (CloudStorage). По умолчанию выключено. */
  telegramBackup: boolean;
  /** Копия профиля (имя, места, рождение) в личном облаке Telegram. По умолчанию включено. */
  cloudProfile: boolean;
  /** Автоматическая копия дневника в личном облаке Telegram после каждой записи (D-141). По умолчанию включено. */
  autoBackup: boolean;
  /** Второй человек для совместимости по Дизайну человека (D-143). Только на этом устройстве. */
  pair: { name: string; birth: BirthData } | null;
  /** «Мои люди» (D-148): карты близких. Только на этом устройстве, в облако не уходит. */
  people: HdPerson[];
  /**
   * Утреннее сообщение от бота. code — последний отправленный боту код подписки.
   * voice — голосовое сообщение (0 нет, 1 Светлана, 2 Дария, 3 Алёна), hd — транзиты Дизайна человека с бодиграфом (D-137).
   */
  morning: { enabled: boolean; hour: number; minute: number; code: string | null; voice: 0 | 1 | 2 | 3; hd: boolean; changes: boolean; voc: boolean; sunGate: boolean; evening: number | null };
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  onboarded: false,
  name: null,
  locations: LOCATION_PRESETS.map((l) => ({ ...l })),
  activeLocationId: DEFAULT_LOCATION_ID,
  homeLocationId: DEFAULT_LOCATION_ID,
  daylight: { from: 7, to: 23 },
  vocMode: 'modern',
  zodiac: 'tropical',
  layers: { vedic: false, garden: false, personal: true },
  birthday: null,
  humanDesign: null,
  hdDecision: null,
  hdSilhouette: null,
  numerology: { ...DEFAULT_NUMEROLOGY },
  theme: 'dark',
  haptics: true,
  telegramBackup: false,
  cloudProfile: true,
  autoBackup: true,
  pair: null,
  people: [],
  morning: { enabled: false, hour: 7, minute: 30, code: null, voice: 0, hd: true, changes: true, voc: true, sunGate: true, evening: 21 * 60 },
};

/** Аккуратно дополняет сохранённые настройки новыми полями по умолчанию. */
export function migrateSettings(raw: Partial<Settings> | undefined): Settings {
  if (!raw) return structuredClone(DEFAULT_SETTINGS);
  return {
    ...structuredClone(DEFAULT_SETTINGS),
    ...raw,
    daylight: { ...DEFAULT_SETTINGS.daylight, ...raw.daylight },
    layers: { ...DEFAULT_SETTINGS.layers, ...raw.layers },
    numerology: { ...DEFAULT_SETTINGS.numerology, ...raw.numerology },
    morning: { ...DEFAULT_SETTINGS.morning, ...raw.morning },
    locations: raw.locations ?? structuredClone(DEFAULT_SETTINGS.locations),
    people: Array.isArray(raw.people) ? raw.people : [],
  };
}
