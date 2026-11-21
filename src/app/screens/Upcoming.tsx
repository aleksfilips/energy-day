import { useEffect, useState } from 'react';
import * as A from '../../astro';
import type { UpcomingEvent } from '../../synthesis/day';
import { compute } from '../../worker/client';
import { humanDateTime, humanIn } from '../format';
import { useNow } from '../hooks';
import { useStore } from '../store';
import { Card, Label, MiniMoon } from '../ui';
import type { Nav } from '../App';

const PHASE_ANGLE: Record<string, number> = { new: 0, first_quarter: 90, full: 180, last_quarter: 270 };

export function UpcomingScreen({ nav }: { nav: Nav }) {
  const { location, settings } = useStore();
  const now = useNow();
  const [events, setEvents] = useState<UpcomingEvent[] | null>(null);
  const hourKey = Math.floor(now.getTime() / 3_600_000);

  useEffect(() => {
    let alive = true;
    compute<UpcomingEvent[]>({ type: 'upcoming', from: hourKey * 3_600_000, days: 60, vocMode: settings.vocMode }).then((r) => alive && setEvents(r));
    return () => {
      alive = false;
    };
  }, [hourKey, settings.vocMode]);

  if (!location) return null;
  const tz = location.timeZone;
  const next = (kind: string) => events?.find((e) => e.kind === kind && e.time > now);
  const nm = next('new');
  const fm = next('full');

  return (
    <div className="space-y-4 pb-6">
      <header className="pt-2">
        <div className="font-display text-[30px] font-semibold">События</div>
        <div className="text-[15px] text-muted">Что ждёт впереди. Время для места «{location.name}»</div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {[nm, fm].map((e, i) => (
          <Card key={i} className="!p-4">
            <MiniMoon angle={i === 0 ? 0 : 180} size={26} />
            <Label className="mt-3">{i === 0 ? 'Новолуние' : 'Полнолуние'}</Label>
            {e ? (
              <>
                <div className="mt-1 text-[17px]">{humanDateTime(e.time, tz)}</div>
                <div className="text-[13px] text-faint">{humanIn(e.time.getTime() - now.getTime())}</div>
              </>
            ) : (
              <div className="mt-1 h-10 animate-pulse rounded bg-surface-2" />
            )}
          </Card>
        ))}
      </div>

      <Card className="!py-2">
        {!events && <div className="py-6 text-center text-[14px] text-faint">Считаю…</div>}
        {events
          ?.filter((e) => (e.end ?? e.time) > now)
          .map((e, i) => (
            <button
              key={i}
              onClick={() => nav.push({ name: 'day', date: A.toDateKey(e.time, tz) })}
              className="flex w-full items-center gap-4 border-t border-line py-3.5 text-left first:border-t-0"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                {e.kind in PHASE_ANGLE ? (
                  <MiniMoon angle={PHASE_ANGLE[e.kind]!} size={22} />
                ) : e.kind === 'eclipse' ? (
                  <span className="h-2.5 w-2.5 rotate-45 bg-accent" />
                ) : e.kind === 'voc' ? (
                  <span className="h-[3px] w-5 rounded-full bg-accent/60" />
                ) : (
                  <span className="h-3 w-3 rounded-full border-2 border-silver" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]">{e.title}</span>
                <span className="block text-[13px] text-muted">
                  {humanDateTime(e.time, tz)}
                  {e.end && ` → ${humanDateTime(e.end, tz)}`}
                  {e.detail && ` · ${e.detail}`}
                </span>
              </span>
              <span className="shrink-0 text-[12px] text-faint">{humanIn(e.time.getTime() - now.getTime()).replace('через ', '')}</span>
            </button>
          ))}
      </Card>
      <p className="px-1 text-[13px] leading-5 text-faint">Здесь новолуния и полнолуния на 2 месяца, затмения на год вперёд и долгие (больше 12 часов) периоды Луны без курса: в такие дни лучше не планировать важных начинаний.</p>
    </div>
  );
}
