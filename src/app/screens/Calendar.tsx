import { useEffect, useState } from 'react';
import * as A from '../../astro';
import type { DayBrief } from '../../synthesis/day';
import { compute } from '../../worker/client';
import { MONTHS, WEEKDAYS_SHORT, parseKey } from '../format';
import { useToday } from '../hooks';
import { useStore } from '../store';
import { cx, MiniMoon, TONE_COLOR } from '../ui';
import { haptic } from '../../telegram';
import type { Nav } from '../App';

export function CalendarScreen({ nav, ym, setYm }: { nav: Nav; ym: { y: number; m: number }; setYm: (v: { y: number; m: number }) => void }) {
  const { location, settings } = useStore();
  const today = useToday();
  const [days, setDays] = useState<DayBrief[] | null>(null);

  useEffect(() => {
    if (!location) return;
    let alive = true;
    setDays(null);
    compute<DayBrief[]>({ type: 'month', loc: location, year: ym.y, month: ym.m, daylight: settings.daylight, zodiac: settings.zodiac, vocMode: settings.vocMode })
      .then((r) => alive && setDays(r))
      .catch(() => alive && setDays([]));
    return () => {
      alive = false;
    };
  }, [location, ym.y, ym.m, settings.daylight, settings.zodiac, settings.vocMode]);

  const shift = (d: number) => {
    haptic.select();
    const m0 = ym.m - 1 + d;
    setYm({ y: ym.y + Math.floor(m0 / 12), m: ((m0 % 12) + 12) % 12 + 1 });
  };
  const first = new Date(Date.UTC(ym.y, ym.m - 1, 1)).getUTCDay();
  const lead = (first + 6) % 7;
  const keys = A.monthDateKeys(ym.y, ym.m);

  return (
    <div className="pb-6">
      <header className="flex items-center justify-between pb-5 pt-2">
        <button onClick={() => shift(-1)} className="h-10 w-10 rounded-full bg-surface text-muted" aria-label="Предыдущий месяц">
          ‹
        </button>
        <button
          className="text-center"
          onClick={() => {
            const { y, m } = parseKey(today);
            setYm({ y, m });
          }}
        >
          <div className="font-display text-[24px] font-semibold">{MONTHS[ym.m - 1]}</div>
          <div className="text-[13px] text-muted">{ym.y}</div>
        </button>
        <button onClick={() => shift(1)} className="h-10 w-10 rounded-full bg-surface text-muted" aria-label="Следующий месяц">
          ›
        </button>
      </header>

      <button
        onClick={() => nav.push({ name: 'pick' })}
        className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-line px-4 py-3 text-left transition active:scale-[0.985]"
        style={{ background: 'color-mix(in srgb, var(--accent) 10%, var(--surface))' }}
      >
        <span className="text-[20px]">📅</span>
        <span className="flex-1">
          <span className="block text-[15px] font-medium">Подобрать день для дела</span>
          <span className="block text-[13px] text-muted">стрижка, сделка, поездка, свадьба…</span>
        </span>
        <span className="text-accent">›</span>
      </button>

      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="pb-1 text-[12px] text-faint">
            {w}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`l${i}`} />
        ))}
        {keys.map((k, i) => {
          const b = days?.[i];
          const isToday = k === today;
          return (
            <button
              key={k}
              onClick={() => nav.push({ name: 'day', date: k })}
              className={cx(
                'relative flex aspect-[0.78] flex-col items-center justify-between rounded-2xl py-2 transition active:scale-95',
                isToday ? 'bg-accent text-[#1b1608]' : 'border border-line bg-surface',
              )}
            >
              <span className={cx('text-[12px]', isToday ? 'text-[#1b1608]/70' : 'text-faint')}>{Number(k.slice(8))}</span>
              {b ? (
                <>
                  <span className="relative font-display text-[19px] font-light leading-none">
                    {b.dominant}
                    {b.secondary !== null && <span className={cx('absolute -right-3 -top-1 text-[9px]', isToday ? 'text-[#1b1608]/60' : 'text-faint')}>{b.secondary}</span>}
                  </span>
                  <span className="flex items-center gap-1">
                    {b.quarter !== null || b.eclipse ? <MiniMoon angle={b.phase.angle} size={11} /> : null}
                    <span className="h-[5px] w-[5px] rounded-full" style={{ background: b.dominantTone ? TONE_COLOR[b.dominantTone] : 'var(--faint)' }} />
                  </span>
                </>
              ) : (
                <span className="h-4 w-4 animate-pulse rounded-full bg-surface-2" />
              )}
              {b?.eclipse && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rotate-45 bg-accent" />}
              {b?.hasVoc && <span className={cx('absolute bottom-1 h-[2px] w-4 rounded-full', isToday ? 'bg-[#1b1608]/40' : 'bg-accent/50')} />}
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2.5 px-1 text-[14px] text-muted">
        {([['активная', 'активный день'], ['переходная', 'переходный день'], ['созерцательная', 'спокойный день'], ['бережная', 'день отдыха']] as const).map(([t, label]) => (
          <span key={t} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TONE_COLOR[t] }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-2">
          <span className="h-[2px] w-4 rounded-full bg-accent/50" /> долго Луна без курса
        </span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rotate-45 bg-accent" /> затмение
        </span>
      </div>
      <p className="mt-4 px-1 text-[13px] leading-5 text-faint">
        Большая цифра — лунный день, который идёт большую часть дня. Маленькая — следующий, если он начинается днём. Точка — характер дня. Луна — новолуние, полнолуние или четверть. Нажми на день, чтобы увидеть подсказки.
      </p>
    </div>
  );
}
