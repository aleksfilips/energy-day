import { useEffect, useMemo, useState } from 'react';
import * as A from '../astro';
import { toDateKey, type DateKey } from '../astro/time';
import { computeDay, type DayModel } from '../synthesis/day';
import { synthesize, type EnergyCard } from '../synthesis/rules';
import { useStore } from './store';

/** Текущее время, обновляется раз в минуту (и при возврате в приложение). */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return now;
}

export function useToday(): DateKey {
  const { location } = useStore();
  const now = useNow();
  return toDateKey(now, location?.timeZone ?? 'Asia/Yekaterinburg');
}

/**
 * Модель дня. Для сегодняшней даты — вживую (D-149): советы, настроение, сферы и всё остальное — по лунному дню,
 * который идёт прямо сейчас, и по знаку Луны сейчас. Пересчёт — в момент смены лунных суток (точный таймер),
 * при входе Луны в новый знак, смене фазы и при возврате в приложение. Другие даты — по большей части светлого окна.
 */
export function useDay(date: DateKey): { model: DayModel; card: EnergyCard } | null {
  const { location, dayOptions, content } = useStore();
  const minute = useNow();
  const [tick, setTick] = useState(0);
  const now = tick > minute.getTime() ? new Date(tick) : minute;
  const live = !!location && toDateKey(now, location.timeZone) === date;
  const current = live ? A.lunarDayAt(location, now) : null;
  const ph = live ? A.phaseInfo(now) : null;
  const focusKey = current && ph ? `${current.start.getTime()}|${A.moonSign(now, dayOptions.zodiac).sign}|${ph.phase}|${ph.waxing}` : '';
  const endsAt = current ? current.end.getTime() : 0;

  // Точно в момент смены лунных суток — пересчитать, не дожидаясь минутного тика.
  useEffect(() => {
    if (!endsAt) return;
    const ms = endsAt - Date.now() + 1000;
    if (ms <= 0 || ms > 2 ** 31 - 1) return;
    const id = setTimeout(() => setTick(Date.now()), ms);
    return () => clearTimeout(id);
  }, [endsAt]);

  return useMemo(() => {
    if (!location) return null;
    const model = computeDay(location, date, focusKey ? { ...dayOptions, at: new Date() } : dayOptions);
    return { model, card: synthesize(model, content) };
    // focusKey меняется только когда меняется то, что видно в советах дня.
  }, [location, date, dayOptions, content, focusKey]);
}
