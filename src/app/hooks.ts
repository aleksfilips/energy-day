import { useEffect, useMemo, useState } from 'react';
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

export function useDay(date: DateKey): { model: DayModel; card: EnergyCard } | null {
  const { location, dayOptions, content } = useStore();
  return useMemo(() => {
    if (!location) return null;
    const model = computeDay(location, date, dayOptions);
    return { model, card: synthesize(model, content) };
  }, [location, date, dayOptions, content]);
}
