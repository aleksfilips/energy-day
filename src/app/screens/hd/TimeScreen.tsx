/** «Не знаю точного времени» (D-148): как меняется карта в течение дня рождения, с выбором и сохранением времени. */
import { useEffect, useMemo, useState } from 'react';
import type { BirthData } from '../../../humandesign/chart';
import { channelKey } from '../../../humandesign/graph';
import { scanDay, type DaySlice } from '../../../humandesign/timeScan';
import { haptic } from '../../../telegram';
import { useStore } from '../../store';
import { cx } from '../../ui';
import type { Nav } from '../../App';
import { AUTH_NAME, ChartGraph, DEF_NAME, Header, HD, hhmm, Info, sideMarks, typeName, useTone } from './common';

const COLORS = ['var(--accent)', 'var(--good)', 'var(--tone-gentle)', 'var(--tone-calm)', 'var(--care)'];
const TYPE_SHORT: Record<string, string> = { generator: 'Генератор', 'manifesting-generator': 'МГ', manifestor: 'Манифестор', projector: 'Проектор', reflector: 'Рефлектор' };
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

interface Group {
  type: string;
  profile: string;
  from: number;
  to: number;
}

function groupsOf(day: DaySlice[]): Group[] {
  const g: Group[] = [];
  for (const s of day) {
    const profile = s.chart.profile.join('/');
    const last = g[g.length - 1];
    if (last && last.type === s.chart.type && last.profile === profile) last.to = s.to;
    else g.push({ type: s.chart.type, profile, from: s.from, to: s.to });
  }
  return g;
}

function summary(day: DaySlice[]) {
  const uniq = <T,>(f: (s: DaySlice) => T) => [...new Set(day.map(f))];
  const charts = day.map((s) => s.chart);
  const chSets = charts.map((c) => new Set(c.channels.map(channelKey)));
  const stableCh = [...chSets[0]!].filter((k) => chSets.every((s) => s.has(k)));
  const stableC = [...charts[0]!.centers].filter((c) => charts.every((x) => x.centers.has(c)));
  const types = uniq((s) => s.chart.type);
  const auths = uniq((s) => s.chart.authority);
  const profs = uniq((s) => s.chart.profile.join('/'));
  const defs = uniq((s) => s.chart.definition);
  const moons = uniq((s) => s.chart.personality.find((a) => a.body === 'moon')!.gate);
  const chName = (k: string) => (HD.channels as Record<string, { name: string }>)[k]?.name;
  const cName = (c: string) => (HD.centers as Record<string, { name: string }>)[c]?.name ?? c;
  const stable: [string, string][] = [];
  const varying: [string, string][] = [];
  (types.length === 1 ? stable : varying).push(['Тип', types.map(typeName).join(' или ')]);
  (auths.length === 1 ? stable : varying).push(['Авторитет', auths.map((a) => AUTH_NAME[a]!.toLowerCase()).join(', ')]);
  (profs.length === 1 ? stable : varying).push(['Профиль', profs.join(', ')]);
  (defs.length === 1 ? stable : varying).push(['Определённость', defs.map((d) => DEF_NAME[d]!.toLowerCase()).join(' или ')]);
  stable.push(['Каналы', stableCh.length ? stableCh.map((k) => `${k.replace('-', '–')}${chName(k) ? ` «${chName(k)}»` : ''}`).join(', ') : 'нет каналов, которые были бы весь день']);
  stable.push(['Определённые центры', stableC.length ? stableC.map(cName).join(', ') : 'ни одного на весь день']);
  varying.push(['Луна', moons.length > 1 ? `ворота ${moons.join(' → ')}` : `ворота ${moons[0]}, меняется только линия`]);
  return { stable, varying };
}

export function TimeScreen({ nav }: { nav: Nav }) {
  const { settings, update } = useStore();
  const tone = useTone();
  const birth = settings.humanDesign;
  const [day, setDay] = useState<DaySlice[] | null>(null);
  const [m, setM] = useState(() => (birth ? birth.hour * 60 + birth.minute : 720));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!birth) return;
    setDay(null);
    // считаем после первого кадра, чтобы экран открылся сразу
    const t = setTimeout(() => setDay(scanDay(birth)), 30);
    return () => clearTimeout(t);
  }, [birth?.year, birth?.month, birth?.day, birth?.timeZone]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => (day ? groupsOf(day) : []), [day]);
  const sum = useMemo(() => (day ? summary(day) : null), [day]);
  const slice = day?.find((s) => m >= s.from && m < s.to) ?? null;
  const gi = groups.findIndex((g) => m >= g.from && m < g.to);
  const marks = useMemo(() => (slice ? sideMarks(slice.chart, tone) : undefined), [slice, tone]);

  if (!birth) {
    return (
      <div className="pb-8">
        <Header title="Не знаю точного времени" />
        <p className="mt-4 text-[15px] text-muted">Сначала укажи дату и место рождения в профиле.</p>
        <button onClick={() => nav.push({ name: 'profile' })} className="mt-4 h-12 rounded-full bg-accent px-6 text-[16px] font-semibold text-bg">
          Открыть профиль
        </button>
      </div>
    );
  }

  const set = (v: number) => {
    setSaved(false);
    setM(v);
  };
  const sun = slice?.chart.personality.find((a) => a.body === 'sun');
  const moon = slice?.chart.personality.find((a) => a.body === 'moon');
  const savedM = birth.hour * 60 + birth.minute;

  return (
    <div className="space-y-4 pb-8">
      <Header
        title="Не знаю точного времени"
        sub={`${birth.day} ${MONTHS[birth.month - 1]} ${birth.year}${birth.place ? ` · ${birth.place}` : ''}. Сдвигай время — и смотри, что в карте меняется.`}
      />
      <div className="rounded-[24px] border border-line bg-surface px-3.5 py-4 shadow-[var(--shadow)]">
        <div className="mx-1 mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            {slice ? `${TYPE_SHORT[slice.chart.type]} · ${slice.chart.profile.join('/')} · ${AUTH_NAME[slice.chart.authority]}` : 'Считаю карты дня…'}
          </span>
          <Info
            title="Если время неизвестно"
            text={
              <>
                <p>Карта считается для каждой минуты дня рождения. Полоса показывает, в какие часы получается какой тип и профиль.</p>
                <p>Если весь день выходит одно и то же — точное время для этого не так важно. Если меняется — уточни время у родных или по документам.</p>
              </>
            }
          />
        </div>
        <div className={cx('px-12 transition-opacity duration-200', !slice && 'opacity-30')}>
          {slice ? <ChartGraph chart={slice.chart} marks={marks} className="mx-auto block w-full" /> : <div className="aspect-[0.7] w-full" />}
        </div>
      </div>

      <div className="rounded-[24px] border border-line bg-surface p-4 shadow-[var(--shadow)]">
        <p className="text-center font-serif text-[34px] font-semibold tabular-nums leading-tight">
          {hhmm(m)}
          {sun && moon && (
            <small className="mt-0.5 block font-sans text-[13px] font-normal text-muted">
              Солнце в воротах {sun.gate}.{sun.line} · Луна {moon.gate}.{moon.line}
            </small>
          )}
        </p>
        <div className="mt-4 flex h-3 overflow-hidden rounded-md">
          {groups.map((g, i) => (
            <span key={i} className={cx('h-full transition-opacity', i !== gi && 'opacity-35')} style={{ width: `${(g.to - g.from) / 14.4}%`, background: COLORS[i % COLORS.length] }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-faint">
          {['00', '06', '12', '18', '24'].map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={1439}
          step={1}
          value={m}
          onChange={(e) => set(Number(e.target.value))}
          aria-label="Время рождения"
          className="hd-range mt-1.5 h-11 w-full"
        />
        <div className="mt-1.5 grid gap-1.5">
          {groups.map((g, i) => (
            <button
              key={i}
              onClick={() => {
                haptic.select();
                set(g.from === 0 ? Math.min(savedM, g.to - 1) : g.from);
              }}
              className={cx('flex items-center gap-2.5 rounded-[14px] bg-surface-2 px-3 py-2.5 text-left text-[14px] transition', i === gi && 'shadow-[inset_0_0_0_1.5px_var(--accent)]')}
            >
              <i className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="w-[124px] shrink-0 whitespace-nowrap text-[13px] tabular-nums text-muted">
                с {hhmm(g.from)} до {hhmm(g.to === 1440 ? 1439 : g.to)}
              </span>
              <span>
                {TYPE_SHORT[g.type]} {g.profile}
              </span>
            </button>
          ))}
        </div>
      </div>

      {sum && (
        <div className="rounded-[24px] border border-line bg-surface p-4 shadow-[var(--shadow)]">
          <h2 className="mb-1.5 font-serif text-[24px] font-medium">Что точно не меняется весь день</h2>
          {sum.stable.map(([k, v]) => (
            <Row key={k} ok k={k} v={v} />
          ))}
          <h2 className="mb-1.5 mt-4 font-serif text-[24px] font-medium">Что зависит от времени</h2>
          {sum.varying.map(([k, v]) => (
            <Row key={k} k={k} v={v} />
          ))}
        </div>
      )}

      <button
        disabled={m === savedM}
        onClick={() => {
          haptic.tap('medium');
          void update({ humanDesign: { ...birth, hour: Math.floor(m / 60), minute: m % 60 } as BirthData });
          setSaved(true);
        }}
        className="h-[52px] w-full rounded-full bg-accent text-[16px] font-semibold text-bg transition active:scale-[0.98] disabled:opacity-50"
      >
        {saved ? `Время ${hhmm(m)} сохранено для карты` : m === savedM ? `Сейчас в карте ${hhmm(m)}` : `Сохранить время ${hhmm(m)}`}
      </button>
    </div>
  );
}

function Row({ k, v, ok = false }: { k: string; v: string; ok?: boolean }) {
  return (
    <div className="flex items-start gap-3 border-t border-line py-2.5 text-[15px] leading-[1.4] first-of-type:border-t-0">
      <span className={cx('mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full', ok ? 'bg-good-soft text-good' : 'bg-care-soft text-care')}>
        <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
          {ok ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <circle cx="12" cy="12" r="3" fill="currentColor" />}
        </svg>
      </span>
      <div>
        {k}
        <small className="mt-0.5 block text-[13px] text-muted">{v}</small>
      </div>
    </div>
  );
}
