/**
 * Компактный «Сегодня»: всё главное на первом экране, подробности — по нажатию.
 * Герой (Луна, лунный день, настроение, суть), полоска времени, плитки 20 сфер, плитки «ещё на сегодня».
 */
import { useId, useState, type ReactNode } from 'react';
import * as A from '../../astro';
import type { Content } from '../../content';
import { dreamsVerdict, type AreaKey, type AreaVerdict, type Verdict } from '../../synthesis/areas';
import type { DayModel } from '../../synthesis/day';
import { goodWindows, spanText, vocInDaylight, type DayPlan, type LifeArea } from '../../synthesis/life';
import { humanDate, humanIn, plural } from '../format';
import { cx, MiniMoon, Moon, Sheet } from '../ui';
import { haptic } from '../../telegram';
import { useStore } from '../store';
import { LifeCard, ord, PersonalCard } from './DayParts';
import { ABOUT, AREA_ABOUT, moodAbout, plainText, VERDICT_ABOUT } from '../../synthesis/explain';
import type { EnergyCard } from '../../synthesis/rules';
import { About, GoodBad, SubTitle, Tip } from './Explain';

export const SHORT: Record<AreaKey, string> = {
  start: 'Новое',
  business: 'Работа',
  money: 'Деньги',
  boss: 'Документы',
  jobChange: 'Смена работы',
  realty: 'Жильё',
  study: 'Учёба',
  creative: 'Творчество',
  talk: 'Общение',
  disputes: 'Споры',
  travel: 'Поездки',
  rest: 'Отдых',
  feast: 'Застолье',
  wedding: 'Свадьба',
  love: 'Любовь',
  conception: 'Зачатие',
  sport: 'Спорт',
  hair: 'Стрижка',
  home: 'Дом',
  garden: 'Сад',
};

export const V: Record<Verdict, { label: string; color: string; soft: string }> = {
  good: { label: 'Благоприятно', color: 'var(--good)', soft: 'var(--good-soft)' },
  neutral: { label: 'Нейтрально', color: 'var(--silver)', soft: 'var(--surface-2)' },
  bad: { label: 'Лучше не стоит', color: 'var(--bad)', soft: 'var(--bad-soft)' },
};

const MOOD: Record<DayPlan['mood']['kind'], string> = { active: 'var(--accent)', even: 'var(--silver)', calm: 'var(--tone-calm)' };

export function Panel({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={
        onClick &&
        (() => {
          haptic.select();
          onClick();
        })
      }
      style={{ boxShadow: 'var(--shadow)' }}
      className={cx('rounded-[24px] border border-line bg-surface', onClick && 'cursor-pointer transition-transform active:scale-[0.985]', className)}
    >
      {children}
    </div>
  );
}

/** Герой: Луна, номер лунного дня, настроение и суть дня в двух строках. */
export function HeroCard({
  model,
  plan,
  number,
  sign,
  until,
  next,
  now,
  onWhy,
  onMore,
}: {
  model: DayModel;
  plan: DayPlan;
  number: number;
  sign: A.Sign;
  until: Date | null;
  next: number | null;
  now?: Date;
  onWhy: () => void;
  onMore?: () => void;
}) {
  const tz = model.location.timeZone;
  const phase = now ? A.phaseInfo(now) : model.phase;
  return (
    <section onClick={onMore} className="hero rise-in relative overflow-hidden rounded-[28px] border border-line p-5" style={{ boxShadow: 'var(--shadow)' }}>
      <div className="flex items-center gap-4">
        <div className="-my-2 -ml-2 shrink-0">
          <Moon angle={phase.angle} size={112} southern={model.location.latitude < 0} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[60px] font-medium leading-[0.9] tracking-tight">{number}</span>
            <span className="text-[15px] leading-tight text-muted">
              лунный
              <br />
              день
            </span>
          </div>
          <div className="mt-2 text-[14px] leading-snug text-muted">
            Луна {phase.waxing ? 'растёт' : 'убывает'} · {Math.round(phase.illuminationPct)}% · {A.inSign(sign)}
          </div>
          {until && next !== null && (
            <div className="mt-0.5 text-[13px] leading-snug text-faint">
              {ord(next)} с {A.formatTime(until, tz)}
              {now && until > now ? `, ${humanIn(until.getTime() - now.getTime())}` : ''}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: MOOD[plan.mood.kind] }}>
          <span className="h-2 w-2 rounded-full" style={{ background: MOOD[plan.mood.kind] }} />
          {plan.mood.title}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            (onMore ?? onWhy)();
          }}
          className="rounded-full border border-line px-3 py-1 text-[13px] text-accent"
        >
          {onMore ? 'подробнее о дне ›' : 'почему так'}
        </button>
      </div>
      <p className="mt-1.5 text-[17px] leading-[1.45]">{plan.headline}</p>
      {number !== plan.lunarDay && (
        <p className="mt-1 text-[12.5px] leading-5 text-faint">Советы — по {plan.lunarDay}-му лунному дню: он идёт большую часть светлого времени.</p>
      )}
      <div className="mt-3 grid gap-1.5 text-[15px] leading-5">
        <div className="flex gap-2">
          <span className="text-good">✓</span>
          <span>{plan.doList[0]}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-care">!</span>
          <span>{plan.avoidList[0]}</span>
        </div>
      </div>
    </section>
  );
}

/** «Время дня»: дуга Солнца с окнами для важного, Луной без курса, восходом, закатом и «сейчас». */
export function TimeStrip({ model, now }: { model: DayModel; now?: Date }) {
  const { from, to } = model.window;
  const span = to.getTime() - from.getTime();
  const pos = (d: Date) => Math.max(0, Math.min(100, ((d.getTime() - from.getTime()) / span) * 100));
  const tz = model.location.timeZone;
  const t = (d: Date) => A.formatTime(d, tz);
  const voc = vocInDaylight(model);
  const good = goodWindows(model);
  const changes = model.lunarDays.filter((s) => s.startsToday && s.from > from && s.from < to);
  const { sunrise, sunset } = model.sun;
  const [open, setOpen] = useState(false);
  return (
    <>
    <Panel onClick={() => setOpen(true)} className="rise-in px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold">Время дня <span className="text-[13px] font-normal text-faint">· что это ›</span></span>
        {sunrise && sunset && (
          <span className="text-[13px] tabular-nums text-muted">
            ☀️ {t(sunrise)} – {t(sunset)}
          </span>
        )}
      </div>
      <SunArc
        pos={pos}
        from={from}
        to={to}
        good={good}
        voc={voc}
        changes={changes.map((c) => c.from)}
        sunrise={sunrise}
        sunset={sunset}
        now={now}
        t={t}
        tz={tz}
      />
    </Panel>
    <Sheet open={open} onClose={() => setOpen(false)} title="Время дня">
      <TimeExplain model={model} />
    </Sheet>
    </>
  );
}

type Span = { from: Date; to: Date };

/**
 * «Время дня» дугой Солнца (D-136): день — путь по небу от начала до конца окна дня.
 * Золотые участки — время для важного (до восхода и после заката приглушены), медный пунктир — Луна без курса,
 * точки — восход и закат, золотая черточка — смена лунного дня, светящееся Солнце — «сейчас».
 */
function SunArc({
  pos,
  from,
  to,
  good,
  voc,
  changes,
  sunrise,
  sunset,
  now,
  t,
  tz,
}: {
  pos: (d: Date) => number;
  from: Date;
  to: Date;
  good: Span[];
  voc: Span[];
  changes: Date[];
  sunrise: Date | null | undefined;
  sunset: Date | null | undefined;
  now?: Date;
  t: (d: Date) => string;
  tz: string;
}) {
  const uid = useId().replace(/:/g, '');
  const gold = `ts-gold-${uid}`;
  const glow = `ts-glow-${uid}`;
  const halo = `ts-halo-${uid}`;
  const core = `ts-core-${uid}`;
  const beam = `ts-beam-${uid}`;
  const nowIn = now && now > from && now < to ? now : null;
  const W = 320;
  const H = 104;
  const BASE = 88;
  const PAD = 10;
  // Точка дуги: x — равномерно по времени, y — полусинус (как путь Солнца), вершина на 14 px от верха.
  const pt = (d: Date): [number, number] => {
    const f = pos(d) / 100;
    return [PAD + f * (W - 2 * PAD), BASE - Math.sin(f * Math.PI) * (BASE - 14)];
  };
  const arc = (a: Date, b: Date) => {
    const n = Math.max(2, Math.round(((b.getTime() - a.getTime()) / (to.getTime() - from.getTime())) * 80));
    let d = '';
    for (let i = 0; i <= n; i++) {
      const [x, y] = pt(new Date(a.getTime() + ((b.getTime() - a.getTime()) * i) / n));
      d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    return d;
  };
  const clip = (w: Span, a: Date, b: Date): Span | null => {
    const f = w.from > a ? w.from : a;
    const e = w.to < b ? w.to : b;
    return f < e ? { from: f, to: e } : null;
  };
  const dayFrom = sunrise && sunrise > from ? sunrise : from;
  const dayTo = sunset && sunset < to ? sunset : to;
  const goodDay = good.map((w) => clip(w, dayFrom, dayTo)).filter((x): x is Span => !!x);
  const goodNight = good.flatMap((w) => [clip(w, from, dayFrom), clip(w, dayTo, to)]).filter((x): x is Span => !!x);
  const np = nowIn ? pt(nowIn) : null;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={gold} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#c8924a" />
            <stop offset="0.5" stopColor="#f8e3b5" />
            <stop offset="1" stopColor="#c8924a" />
          </linearGradient>
          <radialGradient id={halo}>
            <stop offset="0" stopColor="#f8e3b5" stopOpacity="0.75" />
            <stop offset="0.55" stopColor="#ecc98f" stopOpacity="0.25" />
            <stop offset="1" stopColor="#ecc98f" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={core} cx="0.4" cy="0.38">
            <stop offset="0" stopColor="#fffdf6" />
            <stop offset="0.45" stopColor="#f8e3b5" />
            <stop offset="1" stopColor="#c8924a" />
          </radialGradient>
          <linearGradient id={beam} gradientUnits="userSpaceOnUse" x1="0" y1={np ? np[1] : 0} x2="0" y2={BASE + 6}>
            <stop offset="0" stopColor="#ecc98f" stopOpacity="0.8" />
            <stop offset="1" stopColor="#ecc98f" stopOpacity="0" />
          </linearGradient>
          <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Горизонт */}
        <line x1={PAD} y1={BASE + 6} x2={W - PAD} y2={BASE + 6} stroke="var(--ink)" strokeOpacity="0.12" strokeWidth="1" strokeDasharray="2 4" />
        {/* Путь дня */}
        <path d={arc(from, to)} fill="none" stroke="var(--ink)" strokeOpacity="0.13" strokeWidth="3" strokeLinecap="round" />
        {nowIn && <path d={arc(from, nowIn)} fill="none" stroke="var(--ink)" strokeOpacity="0.1" strokeWidth="3" strokeLinecap="round" />}
        {goodNight.map((w) => (
          <path key={`n${w.from.getTime()}`} d={arc(w.from, w.to)} fill="none" stroke={`url(#${gold})`} strokeOpacity="0.72" strokeWidth="4" strokeLinecap="round" />
        ))}
        {goodDay.map((w) => (
          <path key={`g${w.from.getTime()}`} d={arc(w.from, w.to)} fill="none" stroke={`url(#${gold})`} strokeWidth="5" strokeLinecap="round" filter={`url(#${glow})`} />
        ))}
        {voc.map((w) => (
          <path key={`v${w.from.getTime()}`} d={arc(w.from, w.to)} fill="none" stroke="var(--care)" strokeWidth="3" strokeDasharray="2.5 4.5" strokeLinecap="round" />
        ))}
        {/* Восход и закат */}
        {[sunrise, sunset].map((d, i) => {
          if (!d || d <= from || d >= to) return null;
          const [x, y] = pt(d);
          return (
            <g key={i}>
              <line x1={x} y1={y + 6} x2={x} y2={BASE + 6} stroke="var(--ink)" strokeOpacity="0.14" strokeWidth="1" />
              <circle cx={x} cy={y} r="3.4" fill="var(--surface)" stroke="var(--ink)" strokeOpacity="0.45" strokeWidth="1.2" />
            </g>
          );
        })}
        {/* Смена лунного дня */}
        {changes.map((d) => {
          const [x, y] = pt(d);
          return <line key={d.getTime()} x1={x} y1={y - 7} x2={x} y2={y + 7} stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />;
        })}
        {/* Сейчас: Солнце на дуге — сияние, лучи, луч света к горизонту */}
        {np && (
          <g>
            <line x1={np[0]} y1={np[1] + 9} x2={np[0]} y2={BASE + 6} stroke={`url(#${beam})`} strokeWidth="1.6" />
            <circle cx={np[0]} cy={BASE + 6} r="2" fill="#e7bd7c" />
            <circle cx={np[0]} cy={np[1]} r="16" fill={`url(#${halo})`}>
              <animate attributeName="r" values="14;19;14" dur="4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.9;0.55;0.9" dur="4s" repeatCount="indefinite" />
            </circle>
            <g transform={`translate(${np[0]} ${np[1]})`}>
              <g>
                {Array.from({ length: 12 }, (_, i) => (
                  <line key={i} x1="0" y1="-9.5" x2="0" y2={i % 2 ? '-12' : '-14'} stroke="#f3d9a4" strokeWidth="1.3" strokeLinecap="round" transform={`rotate(${i * 30})`} opacity="0.9" />
                ))}
                <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="40s" repeatCount="indefinite" />
              </g>
              <circle r="7" fill={`url(#${core})`} filter={`url(#${glow})`} />
            </g>
          </g>
        )}
      </svg>
      <div className="relative -mt-0.5 h-4 text-[11px] tabular-nums text-faint">
        <span className="absolute left-0">{t(from)}</span>
        {nowIn && (
          <span className="absolute -translate-x-1/2 font-medium text-accent" style={{ left: `${Math.min(88, Math.max(12, pos(nowIn)))}%` }}>
            сейчас {t(nowIn)}
          </span>
        )}
        <span className="absolute right-0">{t(to)}</span>
      </div>
      <div className="mt-3 space-y-1.5 text-[14px] leading-5">
        <div className="flex items-baseline gap-2">
          <span className="w-[118px] shrink-0 whitespace-nowrap text-[10.5px] font-medium uppercase tracking-[0.08em] text-accent">Для важного</span>
          <span className="font-medium tabular-nums">{good.length ? good.map((w) => spanText(w, tz)).join(' · ') : 'сегодня лучше без начинаний'}</span>
        </div>
        {voc.length > 0 && (
          <div className="flex items-baseline gap-2">
            <span className="w-[118px] shrink-0 whitespace-nowrap text-[10.5px] font-medium uppercase tracking-[0.08em] text-care">Луна без курса</span>
            <span className="font-medium tabular-nums">{voc.map((w) => spanText(w, tz)).join(' · ')}</span>
          </div>
        )}
      </div>
    </>
  );
}

/** Полное пояснение к «Времени дня». */
export function TimeExplain({ model }: { model: DayModel }) {
  const { content } = useStore();
  const tz = model.location.timeZone;
  const t = (d: Date) => A.formatTime(d, tz);
  const voc = vocInDaylight(model);
  const good = goodWindows(model);
  const changes = model.lunarDays.filter((s) => s.startsToday && s.from > model.window.from && s.from < model.window.to);
  const v = content.special('voc');
  const { sunrise, sunset } = model.sun;
  return (
    <div className="space-y-5">
      <div>
        <SubTitle color="var(--good)">● Для важных дел</SubTitle>
        <p className="text-[16px] leading-6">{good.length ? good.map((w) => spanText(w, tz)).join(', ') : 'Сегодня удачного окна нет: лучше без важных начинаний.'}</p>
        <p className="mt-1 text-[14px] leading-5 text-muted">{ABOUT.goodTime}</p>
      </div>
      <div>
        <SubTitle color="var(--care)">● Луна без курса</SubTitle>
        <p className="text-[16px] leading-6">
          {voc.length ? `Сегодня ${voc.map((w) => spanText(w, tz)).join(', ')}.` : 'Сегодня днём её нет: весь светлый день подходит для дел.'}
        </p>
        <p className="mt-1 text-[14px] leading-5 text-muted">{ABOUT.voc}</p>
        {voc.length > 0 && (
          <div className="mt-3">
            <GoodBad good={v.favorable} bad={v.mindful} goodTitle="В эти часы хорошо" badTitle="В эти часы не стоит" />
          </div>
        )}
      </div>
      {changes.map((c) => (
        <div key={c.from.getTime()}>
          <SubTitle color="var(--accent)">│ Смена лунного дня</SubTitle>
          <p className="text-[16px] leading-6">В {t(c.from)} взойдёт Луна, и начнётся {ord(c.day.number)} лунный день. Золотая черточка на дуге — этот момент.</p>
        </div>
      ))}
      {sunrise && sunset && (
        <div>
          <SubTitle>☀️ Солнце</SubTitle>
          <p className="text-[16px] leading-6">
            Восход {t(sunrise)}, закат {t(sunset)}. Точки на дуге — восход и закат; золото до восхода и после заката приглушено.
          </p>
        </div>
      )}
      <p className="text-[13px] leading-5 text-faint">
        Дуга — это день с {t(model.window.from)} до {t(model.window.to)}, как путь Солнца по небу. Золотые участки — время для важного, медный пунктир — Луна без курса, светящееся Солнце — «сейчас». Границы дня можно поменять в настройках.
      </p>
    </div>
  );
}

const SOON_MEANS = {
  new: 'Начало лунного месяца: задумать, спланировать, загадать.',
  full: 'Вершина месяца: эмоции ярче, время итогов.',
  eclipse: 'По традиции крупные решения в эти дни лучше отложить.',
} as const;

const GROUP_TITLE: Record<Verdict, string> = { good: 'Благоприятно', neutral: 'Нейтрально', bad: 'Лучше не стоит' };

/** 20 сфер плиткой по 4 в ряд, сгруппированы: сначала благоприятное, потом нейтральное, потом неблагоприятное. */
export function AreaGrid({ areas, lunarDay, onPick }: { areas: AreaVerdict[]; lunarDay: number; onPick?: (area: AreaKey) => void }) {
  const [open, setOpen] = useState<AreaVerdict | null>(null);
  const [dreamsOpen, setDreamsOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const dreams = dreamsVerdict(lunarDay);
  const groups = (['good', 'neutral', 'bad'] as const).map((v) => ({ v, rows: areas.filter((a) => a.verdict === v) })).filter((g) => g.rows.length);
  return (
    <Panel className="rise-in p-4">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-[15px] font-semibold">Сферы дня</span>
        <button onClick={() => setHelp(true)} className="text-[13px] text-faint">
          как читать ›
        </button>
      </div>
      {/* Сводка-полоска: сколько зелёного, нейтрального и красного. */}
      <div className="mx-1 mb-4 mt-2 flex h-1.5 gap-[3px] overflow-hidden rounded-full">
        {groups.map((g) => (
          <span key={g.v} className="h-full rounded-full" style={{ flex: g.rows.length, background: V[g.v].color, opacity: g.v === 'neutral' ? 0.45 : 0.9 }} />
        ))}
      </div>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.v}>
            <div className="mb-2 flex items-center gap-2 px-1 text-[13px] font-semibold" style={{ color: g.v === 'neutral' ? 'var(--muted)' : V[g.v].color }}>
              <span className="h-2 w-2 rounded-full" style={{ background: V[g.v].color }} />
              {GROUP_TITLE[g.v]}
              <span className="tabular-nums opacity-70">· {g.rows.length}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {g.rows.map((a) => (
                <button
                  key={a.key}
                  onClick={() => {
                    haptic.select();
                    setOpen(a);
                  }}
                  className="relative flex h-[70px] flex-col items-center justify-center gap-1 rounded-2xl px-1 transition active:scale-95"
                  style={{
                    background: V[a.verdict].soft,
                    boxShadow: a.verdict === 'neutral' ? undefined : `inset 0 0 0 1px color-mix(in srgb, ${V[a.verdict].color} ${a.verdict === 'bad' ? 45 : 30}%, transparent)`,
                  }}
                  aria-label={`${a.title}: ${V[a.verdict].label}`}
                >
                  <span className="text-[20px] leading-none" style={a.verdict === 'neutral' ? { opacity: 0.75 } : undefined}>
                    {a.icon}
                  </span>
                  <span className="text-center text-[11.5px] font-medium leading-[1.15]" style={{ color: a.verdict === 'neutral' ? 'var(--muted)' : V[a.verdict].color }}>
                    {SHORT[a.key]}
                  </span>
                  {a.note && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full" style={{ background: V[a.verdict].color }} />}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => setDreamsOpen(true)} className="mt-4 flex w-full items-center gap-2 px-1 text-left text-[13px] leading-5 text-muted">
        <span>💭</span>
        <span className="truncate">Сны этой ночи: {dreams.verdict === 'good' ? 'значимые, запомни их' : dreams.verdict === 'neutral' ? 'обычные' : 'тревожные или пустые'}</span>
        <span className="ml-auto text-faint">›</span>
      </button>

      <Sheet open={open !== null} onClose={() => setOpen(null)}>
        {open && (
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-[24px]" style={{ background: V[open.verdict].soft }}>
                {open.icon}
              </span>
              <div>
                <div className="font-serif text-[24px] font-medium leading-tight">{open.title}</div>
                <div className="text-[14px] font-medium" style={{ color: V[open.verdict].color }}>
                  {V[open.verdict].label}
                </div>
              </div>
            </div>
            <p className="mt-4 text-[17px] leading-6">{open.text}.</p>
            {open.note && <p className="mt-2 text-[15px] leading-6 text-muted">{open.note}</p>}
            <p className="mt-4 text-[14px] leading-5 text-muted">
              <span className="text-faint">Что сюда входит: </span>
              {AREA_ABOUT[open.key]}
            </p>
            <p className="mt-3 text-[13px] leading-5 text-faint">По {lunarDay}-му лунному дню, по традиции. Это ориентир, решение за тобой.</p>
            {onPick && (
              <button
                onClick={() => {
                  const k = open.key;
                  setOpen(null);
                  onPick(k);
                }}
                className="mt-5 flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left text-[15px] font-medium text-accent"
                style={{ background: 'color-mix(in srgb, var(--accent) 13%, transparent)' }}
              >
                <span>📅 Когда для этого лучший день?</span>
                <span>›</span>
              </button>
            )}
          </div>
        )}
      </Sheet>
      <Sheet open={help} onClose={() => setHelp(false)} title="Как читать сферы дня">
        <div className="space-y-4">
          <p className="text-[16px] leading-6">{ABOUT.areas}</p>
          {(['good', 'neutral', 'bad'] as const).map((v) => (
            <div key={v} className="flex gap-3">
              <span className="mt-1 h-4 w-4 shrink-0 rounded-md" style={{ background: V[v].soft, boxShadow: `inset 0 0 0 1.5px ${V[v].color}` }} />
              <span className="text-[15px] leading-6">{VERDICT_ABOUT[v]}</span>
            </div>
          ))}
          <p className="text-[15px] leading-6">Точка в углу плитки — на сегодня есть уточнение, например время, когда лучше не начинать. Нажми на любую плитку — там объяснение.</p>
          <p className="text-[13px] leading-5 text-faint">Сегодня оценки даны по {lunarDay}-му лунному дню: он идёт большую часть светлого времени.</p>
        </div>
      </Sheet>
      <Sheet open={dreamsOpen} onClose={() => setDreamsOpen(false)} title="Сны этой ночи">
        <p className="text-[17px] leading-6">{dreams.text}.</p>
        <div className="mt-4">
          <About>{ABOUT.dreams}</About>
        </div>
        <p className="mt-3 text-[13px] text-faint">По {lunarDay}-му лунному дню, по традиции.</p>
      </Sheet>
    </Panel>
  );
}

function Tile({ icon, title, value, sub, onClick, wide }: { icon: ReactNode; title: string; value: string; sub?: string; onClick: () => void; wide?: boolean }) {
  return (
    <Panel onClick={onClick} className={cx('flex min-h-[104px] flex-col justify-between p-4', wide && 'col-span-2')}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted">{title}</span>
        <span className="text-[16px] leading-none">{icon}</span>
      </div>
      <div>
        <div className="line-clamp-2 text-[15px] font-medium leading-5">{value}</div>
        {sub && <div className="mt-0.5 truncate text-[12px] text-faint">{sub}</div>}
      </div>
    </Panel>
  );
}

/** Плитки «ещё на сегодня»: личный день, знак Луны, Дизайн человека, скоро, вопрос дня. */
export function MoreTiles({
  model,
  content,
  lifeAreas,
  plan,
  now,
  onOpenDay,
  onAllEvents,
  onWrite,
}: {
  model: DayModel;
  content: Content;
  lifeAreas: LifeArea[];
  plan: DayPlan;
  now: Date;
  onOpenDay: (d: A.DateKey) => void;
  onAllEvents: () => void;
  onWrite: () => void;
}) {
  const [sheet, setSheet] = useState<null | 'personal' | 'sign' | 'soon'>(null);
  const tz = model.location.timeZone;
  const p = model.personal ? content.personal(model.personal.day) : null;
  const sg = content.sign(model.dominantSign);

  const to = new Date(now.getTime() + 45 * A.MS_PER_DAY);
  const soon: { time: Date; title: string; angle: number | null }[] = [];
  for (const q of A.quartersBetween(now, to)) if (q.quarter === 0 || q.quarter === 2) soon.push({ time: q.time, title: A.QUARTER_NAMES[q.quarter], angle: q.quarter === 0 ? 0 : 180 });
  for (const e of A.eclipsesBetween(now, to)) soon.push({ time: e.peak, title: `${e.body === 'sun' ? 'Солнечное' : 'Лунное'} затмение`, angle: null });
  soon.sort((a, b) => a.time.getTime() - b.time.getTime());
  const todayKey = A.toDateKey(now, tz);
  const daysTo = (d: Date) => Math.round((A.dayBounds(A.toDateKey(d, tz), tz).start.getTime() - A.dayBounds(todayKey, tz).start.getTime()) / A.MS_PER_DAY);
  const when = (n: number) => (n === 0 ? 'сегодня' : n === 1 ? 'завтра' : `через ${n} ${plural(n, 'день', 'дня', 'дней')}`);
  const first = soon[0];

  return (
    <>
      <div className="rise-in grid grid-cols-2 gap-3">
        {p && model.personal && (
          <Tile
            icon={<span className="flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-semibold text-white" style={{ background: p.color.hex }}>{model.personal.day}</span>}
            title="Личный день"
            value={`${p.theme.charAt(0).toUpperCase()}${p.theme.slice(1)}: ${p.favorable.slice(0, 2).join(', ')}`}
            sub="что это значит ›"
            onClick={() => setSheet('personal')}
          />
        )}
        <Tile icon="🌙" title={`Луна ${A.inSign(model.dominantSign)}`} value={sg.coloring[0]!.toUpperCase() + sg.coloring.slice(1)} sub="что это значит ›" onClick={() => setSheet('sign')} />
        {first && <Tile wide={(Number(Boolean(p)) + 1) % 2 === 0} icon={first.angle !== null ? <MiniMoon angle={first.angle} size={18} /> : '◆'} title="Скоро" value={first.title} sub={`${when(daysTo(first.time))}, ${humanDate(A.toDateKey(first.time, tz), false)}`} onClick={() => setSheet('soon')} />}
        <Panel onClick={onWrite} className={cx('col-span-2 flex items-center gap-3 px-4 py-3.5')}>
          <span className="text-[18px]">✍️</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-muted">Вопрос дня · записать в дневник</span>
            <span className="block truncate text-[15px] italic">{plan.question}</span>
          </span>
          <span className="text-faint">›</span>
        </Panel>
      </div>

      <Sheet open={sheet === 'personal'} onClose={() => setSheet(null)}>
        <PersonalCard model={model} content={content} bare />
      </Sheet>
      <Sheet open={sheet === 'sign'} onClose={() => setSheet(null)}>
        <LifeCard areas={lifeAreas} sign={model.dominantSign} content={content} />
      </Sheet>
      <Sheet open={sheet === 'soon'} onClose={() => setSheet(null)} title="Скоро">
        <div className="space-y-1">
          {soon.slice(0, 4).map((x) => (
            <button
              key={x.time.getTime()}
              onClick={() => {
                setSheet(null);
                onOpenDay(A.toDateKey(x.time, tz));
              }}
              className="flex w-full items-center gap-3 py-2.5 text-left"
            >
              <span className="flex h-8 w-8 items-center justify-center">{x.angle !== null ? <MiniMoon angle={x.angle} size={24} /> : <span className="h-3 w-3 rotate-45 bg-accent" />}</span>
              <span className="flex-1">
                <span className="block text-[16px]">{x.title}</span>
                <span className="block text-[14px] text-muted">
                  {humanDate(A.toDateKey(x.time, tz))}, {A.formatTime(x.time, tz)}
                </span>
                <span className="mt-0.5 block text-[13px] leading-5 text-faint">{SOON_MEANS[x.angle === 0 ? 'new' : x.angle === 180 ? 'full' : 'eclipse']}</span>
              </span>
              <span className="text-[13px] text-faint">{when(daysTo(x.time))}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setSheet(null);
            onAllEvents();
          }}
          className="mt-3 text-[15px] text-accent"
        >
          Все события
        </button>
        <div className="mt-4">
          <About>{ABOUT.soon}</About>
        </div>
      </Sheet>
    </>
  );
}

/** «Подробнее о дне»: лунный день, настроение, что делать, фаза, знак, практика — всё простыми словами. */
export function DayStorySheet({
  open,
  onClose,
  onWhy,
  model,
  plan,
  card,
  content,
  current,
}: {
  open: boolean;
  onClose: () => void;
  onWhy: () => void;
  model: DayModel;
  plan: DayPlan;
  card: EnergyCard;
  content: Content;
  /** Лунный день, который идёт сейчас (может отличаться от основного). */
  current: number;
}) {
  const tz = model.location.timeZone;
  const ld = content.lunarDay(plan.lunarDay);
  const ph = content.phase(model.phase.phase);
  const sg = content.sign(model.dominantSign);
  const t = (d: Date) => A.formatTime(d, tz);
  const timing =
    card.base.prev !== null && card.base.changesAt
      ? `До ${t(card.base.changesAt)} ещё идёт ${card.base.prev}-й лунный день, потом начнётся ${plan.lunarDay}-й. Советы даны по ${plan.lunarDay}-му: он идёт большую часть светлого времени.`
      : card.base.next !== null && card.base.changesAt
        ? `В ${t(card.base.changesAt)} начнётся ${card.base.next}-й лунный день. Советы даны по ${plan.lunarDay}-му: он идёт большую часть светлого времени.`
        : null;
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="space-y-6">
        <div>
          <div className="text-[13px] uppercase tracking-[0.14em] text-faint">Твой день подробно</div>
          <div className="mt-1 font-serif text-[28px] font-medium leading-tight">{plan.lunarDay}-й лунный день</div>
          <div className="text-[14px] text-muted">
            символ — {ld.symbols.join(', ')}
            {current !== plan.lunarDay ? ` · сейчас идёт ${current}-й` : ''}
          </div>
        </div>

        <div>
          <p className="text-[17px] leading-[1.5]">{plainText(ld.essence)}</p>
          {timing && <p className="mt-2 text-[14px] leading-5 text-muted">{timing}</p>}
        </div>

        <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--surface-2)' }}>
          <div className="text-[15px] font-semibold" style={{ color: MOOD[plan.mood.kind] }}>
            {plan.mood.title}
          </div>
          <p className="mt-1 text-[15px] leading-6">{moodAbout(plan.mood)}</p>
          <p className="mt-1 text-[13px] leading-5 text-faint">{ABOUT.mood}</p>
        </div>

        <GoodBad good={ld.favorable} bad={ld.mindful} badTitle="Лучше поберечься" />

        <div>
          <SubTitle>
            Луна {model.phase.waxing ? 'растёт' : 'убывает'} · {ph.name.toLowerCase()}
          </SubTitle>
          <p className="text-[15px] leading-6">{ph.essence}</p>
          <p className="mt-1 text-[14px] leading-5 text-muted">Хорошо: {ph.favorable.join(', ')}.</p>
        </div>

        <div>
          <SubTitle>Луна {A.inSign(model.dominantSign)}</SubTitle>
          <p className="text-[15px] leading-6">
            {sg.essence} Добавляет дню {sg.coloring}.
          </p>
        </div>

        <Tip title="Практика дня">{ld.practice}</Tip>

        <div>
          <SubTitle>Вопрос себе вечером</SubTitle>
          <p className="text-[16px] italic leading-6 text-silver">{ld.reflection}</p>
        </div>

        <About>{ABOUT.lunarDay} {ABOUT.phase}</About>

        <button
          onClick={() => {
            onClose();
            onWhy();
          }}
          className="text-[14px] text-accent"
        >
          Как это посчитано ›
        </button>
      </div>
    </Sheet>
  );
}

/**
 * «Сейчас уже другой лунный день» (D-145): советы дня даны по лунному дню, который идёт большую часть суток,
 * а когда лунный день сменился (или ещё не сменился) — отдельная карточка с энергией того дня, что идёт прямо сейчас.
 */
export function NowDayCard({ current, dominant, dayStart, now, content, timeZone }: { current: A.LunarDay; dominant: number; dayStart: Date; now: Date; content: Content; timeZone: string }) {
  if (current.number === dominant) return null;
  const ld = content.lunarDay(current.number);
  // Начался сегодня — значит, это следующий за основным; начался раньше — ещё идёт вчерашний.
  const began = current.start >= dayStart;
  const t = (d: Date) => A.formatTime(d, timeZone);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return (
    <Panel className="rise-in space-y-2.5 p-4">
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">
        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--accent)' }} />
        {began ? `Энергия сменилась в ${t(current.start)}` : `Сейчас ещё до ${t(current.end)}`}
      </div>
      <div className="font-serif text-[24px] font-medium leading-tight">
        {began ? 'Сейчас уже' : 'Сейчас ещё идёт'} {current.number}-й лунный день
      </div>
      <p className="text-[15px] leading-[1.45]">{plainText(ld.essence)}</p>
      <div className="grid gap-1.5 text-[14.5px] leading-5">
        {ld.favorable.slice(0, 3).map((x) => (
          <div key={x} className="flex gap-2">
            <span className="text-good">✓</span>
            <span>{cap(x)}</span>
          </div>
        ))}
        {ld.mindful.slice(0, 2).map((x) => (
          <div key={x} className="flex gap-2">
            <span className="text-care">!</span>
            <span>{cap(x)}</span>
          </div>
        ))}
      </div>
      <p className="text-[13.5px] leading-5 text-muted">🌱 {ld.practice}</p>
      <p className="text-[12px] leading-5 text-faint">
        {began ? `Продлится до ${t(current.end)}${A.toDateKey(current.end, timeZone) !== A.toDateKey(now, timeZone) ? ' завтра' : ''}.` : `Потом начнётся ${dominant}-й.`} Остальные советы на странице — по {dominant}-му: он идёт большую часть суток.
      </p>
    </Panel>
  );
}
