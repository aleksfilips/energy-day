/**
 * «Подобрать день» (D-138) и «Неделя вперёд» (D-139).
 * Оба считают дни в воркере (synthesis/pick.ts): оценки 20 сфер, окна для важного, Луна без курса.
 */
import { useEffect, useState } from 'react';
import * as A from '../../astro';
import { AREAS, type AreaKey, type Verdict } from '../../synthesis/areas';
import { bestDays, rankDays, type PickDay, type PickSpan, type Ranked } from '../../synthesis/pick';
import { compute } from '../../worker/client';
import { haptic, tg } from '../../telegram';
import { BOT_USERNAME } from '../../config';
import { encodeReminder } from '../../bot/reminder';
import { humanDate, parseKey, plural, WEEKDAYS_SHORT } from '../format';
import { useToday } from '../hooks';
import { useStore } from '../store';
import { cx, MiniMoon, TONE_COLOR } from '../ui';
import type { Nav } from '../App';
import { Panel, SHORT, V } from './Compact';

const RANGE = 42;

function usePickDays(days: number): PickDay[] | null {
  const { location, settings } = useStore();
  const today = useToday();
  const [res, setRes] = useState<PickDay[] | null>(null);
  useEffect(() => {
    if (!location) return;
    let alive = true;
    setRes(null);
    compute<PickDay[]>({ type: 'pick', loc: location, from: today, days, daylight: settings.daylight, zodiac: settings.zodiac, vocMode: settings.vocMode })
      .then((r) => alive && setRes(r))
      .catch(() => alive && setRes([]));
    return () => {
      alive = false;
    };
  }, [location, today, days, settings.daylight, settings.zodiac, settings.vocMode]);
  return res;
}

const spans = (xs: PickSpan[], tz: string) => xs.map((w) => `${A.formatTime(new Date(w.from), tz)}–${A.formatTime(new Date(w.to), tz)}`).join(', ');

function inDays(from: A.DateKey, to: A.DateKey): string {
  const a = parseKey(from);
  const b = parseKey(to);
  const n = Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
  return n === 0 ? 'сегодня' : n === 1 ? 'завтра' : n === 2 ? 'послезавтра' : `через ${n} ${plural(n, 'день', 'дня', 'дней')}`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function PickScreen({ nav, initial }: { nav: Nav; initial?: AreaKey }) {
  const { location } = useStore();
  const today = useToday();
  const [area, setArea] = useState<AreaKey>(initial ?? 'start');
  const days = usePickDays(RANGE);
  const tz = location?.timeZone ?? 'UTC';
  const def = AREAS.find((a) => a.key === area)!;
  const best = days ? bestDays(days, area, 3) : [];
  const ranked = days ? rankDays(days, area) : [];
  const top = new Set(best.map((b) => b.day.date));

  return (
    <div className="space-y-4 pb-8 pt-2">
      <header className="px-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Подобрать день</div>
        <h1 className="mt-1 font-serif text-[32px] font-medium leading-[1.1]">Когда лучше всего?</h1>
        <p className="mt-2 text-[14px] leading-5 text-muted">Выбери дело, и я найду лучшие дни на шесть недель вперёд для места «{location?.name}».</p>
      </header>

      <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <div className="grid w-max grid-flow-col grid-rows-2 gap-2">
          {AREAS.map((a) => {
            const on = a.key === area;
            return (
              <button
                key={a.key}
                onClick={() => {
                  haptic.select();
                  setArea(a.key);
                }}
                className={cx('flex h-[38px] items-center gap-1.5 rounded-full px-3.5 text-[14px] transition active:scale-95', on ? 'bg-accent font-semibold text-[#1b1608]' : 'border border-line bg-surface text-muted')}
              >
                <span className="text-[16px] leading-none">{a.icon}</span>
                {SHORT[a.key]}
              </button>
            );
          })}
        </div>
      </div>

      {!days ? (
        <Panel className="flex h-[260px] items-center justify-center text-[14px] text-faint">Считаю ближайшие недели…</Panel>
      ) : best.length === 0 ? (
        <Panel className="p-5 text-[15px] leading-6 text-muted">В ближайшие шесть недель для дела «{def.title}» нет хороших дней по традиции. Выбери обычный день и действуй бережно.</Panel>
      ) : (
        <>
          <BestCard r={best[0]!} area={area} today={today} tz={tz} onOpen={() => nav.push({ name: 'day', date: best[0]!.day.date })} />
          {best.length > 1 && (
            <div className="space-y-2">
              <div className="px-1 text-[13px] font-semibold text-muted">Тоже хорошо</div>
              {best.slice(1).map((r) => (
                <Panel key={r.day.date} onClick={() => nav.push({ name: 'day', date: r.day.date })} className="flex items-center gap-3 px-4 py-3">
                  <DateBadge date={r.day.date} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium">{cap(humanDate(r.day.date))}</div>
                    <div className="truncate text-[13px] text-muted">
                      {inDays(today, r.day.date)} · {r.day.lunarDay}-й лунный день{r.day.good.length ? ` · для важного ${spans(r.day.good.slice(0, 1), tz)}` : ''}
                    </div>
                  </div>
                  <span className="text-[13px] font-medium" style={{ color: V[r.verdict].color }}>
                    {r.verdict === 'good' ? 'хорошо' : 'можно'}
                  </span>
                  {BOT_USERNAME && r.day.date > today && <RemindButton date={r.day.date} area={area} label="🔔" />}
                </Panel>
              ))}
            </div>
          )}
          <Panel className="p-4">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-[15px] font-semibold">Все дни</span>
              <span className="text-[12px] text-faint">{def.icon} {def.title.toLowerCase()}</span>
            </div>
            <MiniCalendar ranked={ranked} top={top} today={today} onOpen={(d) => nav.push({ name: 'day', date: d })} />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-[12px] text-muted">
              {(['good', 'neutral', 'bad'] as const).map((v) => (
                <span key={v} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: V[v].soft, boxShadow: `inset 0 0 0 1.5px ${V[v].color}` }} />
                  {v === 'good' ? 'хорошо' : v === 'neutral' ? 'можно' : 'лучше не стоит'}
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <span className="text-accent">★</span> лучшие
              </span>
            </div>
          </Panel>
        </>
      )}
      <p className="px-1 text-[13px] leading-5 text-faint">
        Подбор по лунному календарю: оценка сферы на лунный день, растущая Луна для начинаний, как можно меньше Луны без курса и есть время для важного. Это ориентир, решение за тобой.
      </p>
    </div>
  );
}

function DateBadge({ date, big = false }: { date: A.DateKey; big?: boolean }) {
  const { y, m, d } = parseKey(date);
  const wd = WEEKDAYS_SHORT[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7];
  return (
    <div className={cx('flex shrink-0 flex-col items-center justify-center rounded-2xl bg-surface-2', big ? 'h-[68px] w-[60px]' : 'h-[50px] w-[46px]')}>
      <span className={cx('font-display font-light leading-none', big ? 'text-[28px]' : 'text-[20px]')}>{d}</span>
      <span className="mt-0.5 text-[11px] uppercase text-faint">{wd}</span>
    </div>
  );
}

/** «Напомнить накануне» (D-146): открывает бота со ссылкой-напоминанием, бот напишет в 20:00 накануне. */
function RemindButton({ date, area, label }: { date: A.DateKey; area: AreaKey; label: string }) {
  return (
    <button
      aria-label="Напомнить накануне"
      onClick={(e) => {
        e.stopPropagation();
        haptic.success();
        const url = `https://t.me/${BOT_USERNAME.replace(/^@/, '')}?start=${encodeReminder({ date, area })}`;
        const t = tg();
        if (t?.openTelegramLink) t.openTelegramLink(url);
        else window.open(url, '_blank', 'noopener');
      }}
      className={cx('shrink-0 rounded-full border border-line text-[14px] text-ink', label.length > 2 ? 'px-3.5 py-1.5' : 'grid h-9 w-9 place-items-center')}
    >
      {label}
    </button>
  );
}

function BestCard({ r, area, today, tz, onOpen }: { r: Ranked; area: AreaKey; today: A.DateKey; tz: string; onOpen: () => void }) {
  const def = AREAS.find((a) => a.key === area)!;
  return (
    <Panel onClick={onOpen} className="relative overflow-hidden p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 60%)' }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Лучший день</span>
          <span className="text-[13px] text-muted">{inDays(today, r.day.date)}</span>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <DateBadge date={r.day.date} big />
          <div>
            <div className="font-serif text-[26px] font-medium leading-tight">{cap(humanDate(r.day.date))}</div>
            <div className="mt-0.5 text-[14px] text-muted">
              {def.icon} {def.text[r.verdict]}
            </div>
          </div>
        </div>
        <ul className="mt-4 space-y-1.5">
          {r.why.map((w) => (
            <li key={w} className="flex gap-2 text-[14px] leading-5">
              <span className="text-accent">✦</span>
              {cap(w)}
            </li>
          ))}
        </ul>
        {r.day.good.length > 0 && (
          <div className="mt-4 rounded-2xl px-3.5 py-2.5 text-[14px]" style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)' }}>
            <span className="text-faint">Для важного: </span>
            <span className="font-semibold tabular-nums text-accent">{spans(r.day.good, tz)}</span>
          </div>
        )}
        {r.day.voc.length > 0 && <div className="mt-2 px-1 text-[13px] text-muted">Луна без курса {spans(r.day.voc, tz)} — в эти часы не начинай.</div>}
        <div className="mt-4 flex items-center justify-between gap-3">
          {BOT_USERNAME && r.day.date > today ? (
            <RemindButton date={r.day.date} area={area} label="🔔 Напомнить накануне" />
          ) : (
            <span />
          )}
          <span className="text-[14px] font-medium text-accent">Открыть день ›</span>
        </div>
      </div>
    </Panel>
  );
}

function MiniCalendar({ ranked, top, today, onOpen }: { ranked: Ranked[]; top: Set<string>; today: A.DateKey; onOpen: (d: A.DateKey) => void }) {
  if (!ranked.length) return null;
  const { y, m, d } = parseKey(ranked[0]!.day.date);
  const lead = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return (
    <div className="grid grid-cols-7 gap-1.5 text-center">
      {WEEKDAYS_SHORT.map((w) => (
        <div key={w} className="text-[11px] text-faint">
          {w}
        </div>
      ))}
      {Array.from({ length: lead }, (_, i) => (
        <div key={`l${i}`} />
      ))}
      {ranked.map((r) => {
        const v: Verdict = r.verdict;
        const dd = parseKey(r.day.date).d;
        return (
          <button
            key={r.day.date}
            onClick={() => onOpen(r.day.date)}
            className="relative flex aspect-square items-center justify-center rounded-xl text-[14px] tabular-nums transition active:scale-95"
            style={{ background: V[v].soft, boxShadow: v === 'neutral' ? undefined : `inset 0 0 0 1px color-mix(in srgb, ${V[v].color} 40%, transparent)`, color: v === 'neutral' ? 'var(--muted)' : V[v].color }}
            aria-label={`${humanDate(r.day.date)}: ${V[v].label}`}
          >
            {dd === 1 ? <span className="font-semibold">{dd}</span> : dd}
            {top.has(r.day.date) && <span className="absolute -right-0.5 -top-1 text-[11px] text-accent">★</span>}
            {r.day.date === today && <span className="absolute bottom-1 h-[3px] w-3 rounded-full bg-accent" />}
          </button>
        );
      })}
    </div>
  );
}

/** «Неделя вперёд» на «Сегодня»: семь дней — характер, лунный день, окна для важного, Луна без курса. */
export function WeekAhead({ nav, onPick }: { nav: Nav; onPick: () => void }) {
  const days = usePickDays(7);
  const today = useToday();
  return (
    <Panel className="rise-in p-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-[15px] font-semibold">Неделя вперёд</span>
        <button onClick={onPick} className="text-[13px] font-medium text-accent">
          подобрать день ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {(days ?? Array.from({ length: 7 }, () => null)).map((x, i) => {
          if (!x) return <div key={i} className="h-[132px] animate-pulse rounded-2xl bg-surface-2" />;
          const { y, m, d } = parseKey(x.date);
          const wd = WEEKDAYS_SHORT[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7];
          const good = Object.values(x.verdicts).filter((v) => v === 'good').length;
          const isToday = x.date === today;
          return (
            <button
              key={x.date}
              onClick={() => nav.push({ name: 'day', date: x.date })}
              className={cx('flex h-[132px] flex-col items-center justify-between rounded-2xl py-2 transition active:scale-95', isToday ? 'bg-surface-2' : '')}
              aria-label={`${humanDate(x.date)}: ${x.lunarDay}-й лунный день, благоприятных сфер ${good}`}
            >
              <span className={cx('text-[11px] uppercase', isToday ? 'font-semibold text-accent' : 'text-faint')}>{isToday ? 'сег' : wd}</span>
              <span className="text-[15px] tabular-nums">{d}</span>
              <span className="flex h-[46px] w-[10px] items-end overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--ink) 7%, transparent)' }} title={`благоприятных сфер: ${good} из 20`}>
                <span className="w-full rounded-full" style={{ height: `${Math.max(18, (good / 20) * 100)}%`, background: x.tone ? TONE_COLOR[x.tone] : 'var(--accent)', boxShadow: `0 0 8px ${x.tone ? TONE_COLOR[x.tone] : 'var(--accent)'}` }} />
              </span>
              <span className="flex h-[12px] items-center">{x.moon ? <MiniMoon angle={x.moon.angle} size={11} /> : <span className="text-[11px] text-faint">{x.lunarDay}</span>}</span>
              <span className={cx('h-[2px] w-4 rounded-full', x.vocShare > 0.25 ? 'bg-[var(--care)]' : 'bg-transparent')} />
            </button>
          );
        })}
      </div>
      <p className="mt-2 px-1 text-[12px] leading-4 text-faint">Столбик — сколько сфер благоприятно, цвет — характер дня. Число — лунный день. Медная черта — долго Луна без курса.</p>
    </Panel>
  );
}
