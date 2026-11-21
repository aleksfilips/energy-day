import type { Location } from '../astro/location';
import { LOCATION_PRESETS, DEFAULT_LOCATION_ID } from '../astro/location';
import type { VocMode } from '../astro/voc';
import type { ZodiacMode } from '../astro/zodiac';
import { DEFAULT_NUMEROLOGY, type Birthday, type NumerologyOptions } from '../personal/numerology';

export type Theme = 'dark' | 'light' | 'telegram';

export interface Settings {
  version: 1;
  onboarded: boolean;
  locations: Location[];
  activeLocationId: string;
  homeLocationId: string;
  daylight: { from: number; to: number };
  vocMode: VocMode;
  zodiac: ZodiacMode;
  layers: { vedic: boolean; garden: boolean; personal: boolean };
  birthday: Birthday | null;
  numerology: NumerologyOptions;
  theme: Theme;
  haptics: boolean;
  /** Резервная копия дневника в облаке Telegram (CloudStorage). По умолчанию выключено. */
  telegramBackup: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  onboarded: false,
  locations: LOCATION_PRESETS.map((l) => ({ ...l })),
  activeLocationId: DEFAULT_LOCATION_ID,
  homeLocationId: DEFAULT_LOCATION_ID,
  daylight: { from: 7, to: 23 },
  vocMode: 'modern',
  zodiac: 'tropical',
  layers: { vedic: false, garden: false, personal: true },
  birthday: null,
  numerology: { ...DEFAULT_NUMEROLOGY },
  theme: 'dark',
  haptics: true,
  telegramBackup: false,
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
    locations: raw.locations?.length ? raw.locations : structuredClone(DEFAULT_SETTINGS.locations),
  };
}
