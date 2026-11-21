import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { isResolved, type ResolvedLocation } from '../astro/location';
import { applyOverrides, makeContent, type Content, type ContentOverride } from '../content';
import { db } from '../db';
import { DEFAULT_SETTINGS, migrateSettings, type Settings } from '../state/settings';
import { setHaptics, setTelegramColors, telegramColorScheme } from '../telegram';
import type { DayOptions } from '../synthesis/day';

interface Store {
  ready: boolean;
  settings: Settings;
  update: (patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) => Promise<void>;
  content: Content;
  overrides: ContentOverride[];
  location: ResolvedLocation | null;
  dayOptions: DayOptions;
  theme: 'dark' | 'light';
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const current = useRef<Settings>(DEFAULT_SETTINGS);
  current.current = settings;
  const overrides = useLiveQuery(() => db.overrides.toArray(), [], [] as ContentOverride[]);

  useEffect(() => {
    db.settings
      .get('main')
      .then((row) => setSettings(migrateSettings(row?.value)))
      .catch(() => setSettings(migrateSettings(undefined)))
      .finally(() => setReady(true));
  }, []);

  const update = useCallback(async (patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) => {
    const next: Settings = { ...current.current, ...(typeof patch === 'function' ? patch(current.current) : patch) };
    current.current = next;
    setSettings(next);
    await db.settings.put({ id: 'main', value: next });
  }, []);

  const content = useMemo(() => makeContent(applyOverrides(overrides)), [overrides]);

  const location = useMemo(() => {
    const l = settings.locations.find((x) => x.id === settings.activeLocationId) ?? settings.locations[0];
    return l && isResolved(l) ? l : null;
  }, [settings.locations, settings.activeLocationId]);

  const dayOptions: DayOptions = useMemo(
    () => ({
      daylight: settings.daylight,
      vocMode: settings.vocMode,
      zodiac: settings.zodiac,
      vedic: settings.layers.vedic,
      garden: settings.layers.garden,
      birthday: settings.layers.personal ? settings.birthday : null,
      numerology: settings.numerology,
    }),
    [settings],
  );

  const theme: 'dark' | 'light' =
    settings.theme === 'telegram' ? (telegramColorScheme() ?? 'dark') : settings.theme;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const bg = theme === 'dark' ? '#0e0f11' : '#f5f4f1';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
    setTelegramColors(bg);
  }, [theme]);

  useEffect(() => setHaptics(settings.haptics), [settings.haptics]);

  const value = useMemo(
    () => ({ ready, settings, update, content, overrides, location, dayOptions, theme }),
    [ready, settings, update, content, overrides, location, dayOptions, theme],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider отсутствует');
  return s;
}
