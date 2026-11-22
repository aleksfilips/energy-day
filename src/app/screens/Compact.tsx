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
import { useStore } from '../store';
import { LifeCard, ord, PersonalCard } from './DayParts';
import { ABOUT, AREA_ABOUT, moodAbout, plainText, VERDICT_ABOUT } from '../../synthesis/explain';
import type { EnergyCard } from '../../synthesis/rules';
import { About, GoodBad, SubTitle, Tip } from './Explain';

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
  neutral: { label: 'Нейтрально', color: 'var(--silver)', soft: 'var(--surface-2)' },
  bad: { label: 'Лучше не стоит', color: 'var(--bad)', soft: 'var(--bad-soft)' },
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
    <Sheet open={open} onClose={() => setOpen(false)} title="Время дня">
      <TimeExplain model={model} />
    </Sheet>
    </>
  );
}

/** Полное пояснение к полоске времени. */
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
          <p className="text-[16px] leading-6">В {t(c.from)} взойдёт Луна, и начнётся {ord(c.day.number)} лунный день. Золотая черта на полоске — этот момент.</p>
        </div>
      ))}
      {sunrise && sunset && (
        <div>
          <SubTitle>☀️ Солнце</SubTitle>
          <p className="text-[16px] leading-6">
            Восход {t(sunrise)}, закат {t(sunset)}. Тёмные края полоски — время до восхода и после заката.
          </p>
        </div>
      )}
      <p className="text-[13px] leading-5 text-faint">
        Полоска — это день с {t(model.window.from)} до {t(model.window.to)}, яркая черта — «сейчас». Границы дня можно поменять в настройках.
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
export function AreaGrid({ areas, lunarDay }: { areas: AreaVerdict[]; lunarDay: number }) {
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
