/**
 * Компактный «Сегодня»: всё главное на первом экране, подробности — по нажатию.
 * Герой (Луна, лунный день, настроение, суть), полоска времени, плитки 20 сфер, плитки «ещё на сегодня».
 */
import { useState, type ReactNode } from 'react';
import * as A from '../../astro';
import type { Content } from '../../content';
import { dreamsVerdict, type AreaKey, type AreaVerdict, type Verdict } from '../../synthesis/areas';
import type { DayModel } from '../../synthesis/day';
import { goodWindows, spanText, vocInDaylight, type DayPlan, type LifeArea } from '../../synthesis/life';
import { humanDate, humanIn, plural } from '../format';
import { cx, MiniMoon, Moon, Sheet } from '../ui';
import { haptic } from '../../telegram';
import { LifeCard, ord, PersonalCard } from './DayParts';

const SHORT: Record<AreaKey, string> = {
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
  neutral: { label: 'Нейтрально', color: 'var(--accent)', soft: 'var(--accent-soft)' },
  bad: { label: 'Лучше не стоит', color: 'var(--care)', soft: 'var(--care-soft)' },
};

const MOOD: Record<DayPlan['mood']['kind'], string> = { active: 'var(--accent)', even: 'var(--silver)', calm: 'var(--tone-calm)' };

function Panel({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
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
}: {
  model: DayModel;
  plan: DayPlan;
  number: number;
  sign: A.Sign;
  until: Date | null;
  next: number | null;
  now?: Date;
  onWhy: () => void;
}) {
  const tz = model.location.timeZone;
  const phase = now ? A.phaseInfo(now) : model.phase;
  return (
    <section className="hero rise-in relative overflow-hidden rounded-[28px] border border-line p-5" style={{ boxShadow: 'var(--shadow)' }}>
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
        <button onClick={onWhy} className="text-[13px] text-faint underline decoration-dotted underline-offset-4">
          почему так
        </button>
      </div>
      <p className="mt-1.5 text-[17px] leading-[1.45]">{plan.headline}</p>
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

/** Полоска времени в одну строку: удачное окно, Луна без курса, Солнце, «сейчас». */
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
  return (
    <Panel className="rise-in px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold">Время дня</span>
        {sunrise && sunset && (
          <span className="text-[13px] tabular-nums text-muted">
            ☀️ {t(sunrise)} – {t(sunset)}
          </span>
        )}
      </div>
      <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-good-soft">
        {sunrise && sunrise > from && <div className="absolute inset-y-0 left-0 bg-[var(--night)]" style={{ width: `${pos(sunrise)}%` }} />}
        {sunset && sunset < to && <div className="absolute inset-y-0 right-0 bg-[var(--night)]" style={{ left: `${pos(sunset)}%` }} />}
        {voc.map((w) => (
          <div key={w.from.getTime()} className="absolute inset-y-0 bg-care" style={{ left: `${pos(w.from)}%`, width: `${pos(w.to) - pos(w.from)}%`, opacity: 0.75 }} />
        ))}
        {changes.map((c) => (
          <span key={c.from.getTime()} className="absolute inset-y-0 w-[2px] bg-accent" style={{ left: `${pos(c.from)}%` }} />
        ))}
        {now && now > from && now < to && <span className="absolute -inset-y-0 w-[3px] -translate-x-1/2 rounded bg-ink" style={{ left: `${pos(now)}%` }} />}
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-faint">
        <span>{t(from)}</span>
        <span>{t(new Date(from.getTime() + span / 2))}</span>
        <span>{t(to)}</span>
      </div>
      <div className="mt-2 space-y-1 text-[14px] leading-5">
        <div>
          <span className="text-good">●</span> Для важного: {good.length ? good.map((w) => spanText(w, tz)).join(', ') : 'сегодня лучше без начинаний'}
        </div>
        {voc.length > 0 && (
          <div>
            <span className="text-care">●</span> Луна без курса {voc.map((w) => spanText(w, tz)).join(', ')}: новое не начинать
          </div>
        )}
      </div>
    </Panel>
  );
}

/** 20 сфер плиткой 4×5 в постоянном порядке. Нажатие открывает пояснение. */
export function AreaGrid({ areas, lunarDay }: { areas: AreaVerdict[]; lunarDay: number }) {
  const [open, setOpen] = useState<AreaVerdict | null>(null);
  const [dreamsOpen, setDreamsOpen] = useState(false);
  const dreams = dreamsVerdict(lunarDay);
  const count = (v: Verdict) => areas.filter((a) => a.verdict === v).length;
  return (
    <Panel className="rise-in p-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-[15px] font-semibold">Сферы дня</span>
        <span className="flex items-center gap-3 text-[12px] tabular-nums text-muted">
          {(['good', 'neutral', 'bad'] as const).map((v) => (
            <span key={v} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: V[v].color }} />
              {count(v)}
            </span>
          ))}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {areas.map((a) => (
          <button
            key={a.key}
            onClick={() => {
              haptic.select();
              setOpen(a);
            }}
            className="relative flex h-[70px] flex-col items-center justify-center gap-1 rounded-2xl px-1 transition active:scale-95"
            style={{ background: V[a.verdict].soft, boxShadow: a.verdict === 'neutral' ? undefined : `inset 0 0 0 1px color-mix(in srgb, ${V[a.verdict].color} 30%, transparent)` }}
            aria-label={`${a.title}: ${V[a.verdict].label}`}
          >
            <span className="text-[20px] leading-none">{a.icon}</span>
            <span className="text-center text-[11.5px] leading-[1.15]" style={{ color: a.verdict === 'neutral' ? 'var(--muted)' : V[a.verdict].color }}>
              {SHORT[a.key]}
            </span>
            {a.note && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full" style={{ background: V[a.verdict].color }} />}
          </button>
        ))}
      </div>
      <button onClick={() => setDreamsOpen(true)} className="mt-3 flex w-full items-center gap-2 px-1 text-left text-[13px] leading-5 text-muted">
        <span>💭</span>
        <span className="truncate">Сны этой ночи: {dreams.verdict === 'good' ? 'значимые, запомни их' : dreams.verdict === 'neutral' ? 'обычные' : 'тревожные или пустые'}</span>
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
            <p className="mt-4 text-[13px] leading-5 text-faint">По {lunarDay}-му лунному дню, по традиции. Это ориентир, решение за тобой.</p>
          </div>
        )}
      </Sheet>
      <Sheet open={dreamsOpen} onClose={() => setDreamsOpen(false)} title="Сны этой ночи">
        <p className="text-[17px] leading-6">{dreams.text}.</p>
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
  hd,
  now,
  onOpenDay,
  onAllEvents,
  onWrite,
}: {
  model: DayModel;
  content: Content;
  lifeAreas: LifeArea[];
  plan: DayPlan;
  hd: string[] | null;
  now: Date;
  onOpenDay: (d: A.DateKey) => void;
  onAllEvents: () => void;
  onWrite: () => void;
}) {
  const [sheet, setSheet] = useState<null | 'personal' | 'sign' | 'hd' | 'soon'>(null);
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
            value={p.essence.replace(/\.$/, '')}
            sub={`цвет ${p.color.name}`}
            onClick={() => setSheet('personal')}
          />
        )}
        <Tile icon="🌙" title={`Луна ${A.inSign(model.dominantSign)}`} value={sg.coloring[0]!.toUpperCase() + sg.coloring.slice(1)} sub="подсказки по сферам" onClick={() => setSheet('sign')} />
        {hd && <Tile icon="◈" title="Дизайн человека" value={hd[0]!} onClick={() => setSheet('hd')} />}
        {first && <Tile wide={(Number(Boolean(p)) + 1 + Number(Boolean(hd))) % 2 === 0} icon={first.angle !== null ? <MiniMoon angle={first.angle} size={18} /> : '◆'} title="Скоро" value={first.title} sub={`${when(daysTo(first.time))}, ${humanDate(A.toDateKey(first.time, tz), false)}`} onClick={() => setSheet('soon')} />}
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
        <PersonalCard model={model} content={content} />
      </Sheet>
      <Sheet open={sheet === 'sign'} onClose={() => setSheet(null)}>
        <LifeCard areas={lifeAreas} sign={model.dominantSign} />
      </Sheet>
      <Sheet open={sheet === 'hd'} onClose={() => setSheet(null)} title="Дизайн человека сегодня">
        {hd && (
          <div className="space-y-2.5">
            <p className="text-[17px] leading-6">{hd[0]}</p>
            {hd.slice(1).map((l) => (
              <p key={l} className="flex gap-2 text-[15px] leading-6">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {l}
              </p>
            ))}
          </div>
        )}
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
      </Sheet>
    </>
  );
}
