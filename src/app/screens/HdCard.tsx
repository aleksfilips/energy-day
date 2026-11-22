/** Карточка «Дизайн человека» на экранах «Сегодня» и «День». Данные рождения — в «Мои данные». */
import { useMemo } from 'react';
import type { DateKey } from '../../astro/time';
import { bodygraph } from '../../humandesign/chart';
import { dayTransits } from '../../humandesign/transits';
import { transitLines } from '../../humandesign/summary';
import { useStore } from '../store';
import { Section } from './DayParts';

/** Строки транзитов Дизайна человека на дату (null, если дата рождения не задана). */
export function useHdLines(date: DateKey): string[] | null {
  const { settings, location } = useStore();
  const birth = settings.humanDesign;
  const tz = location?.timeZone;
  const chart = useMemo(() => (birth ? bodygraph(birth) : null), [birth]);
  return useMemo(() => {
    if (!chart || !tz) return null;
    try {
      return transitLines(chart, dayTransits(chart, date, tz), tz);
    } catch {
      return null;
    }
  }, [chart, date, tz]);
}

export function HdCard({ date }: { date: DateKey }) {
  const lines = useHdLines(date);
  if (!lines) return null;
  const [theme, ...rest] = lines;
  return (
    <Section title="Дизайн человека сегодня">
      <p className="text-[16px] leading-6">{theme}</p>
      {rest.length > 0 && (
        <ul className="mt-3 space-y-2">
          {rest.map((l) => (
            <li key={l} className="flex gap-2 text-[15px] leading-6">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--accent)' }} />
              <span>{l}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
