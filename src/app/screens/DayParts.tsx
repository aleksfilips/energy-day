/** Общие блоки экранов «Сегодня» и «День»: простой план, время дня, сферы жизни, личный день, «скоро». */
import { useState, type ReactNode } from 'react';
import * as A from '../../astro';
import type { Content } from '../../content';
import type { DayModel } from '../../synthesis/day';
import type { EnergyCard } from '../../synthesis/rules';
import { AREAS_SOURCE, dreamsVerdict, type AreaVerdict, type Verdict } from '../../synthesis/areas';
import { goodWindows, spanText, vocInDaylight, type DayPlan, type LifeArea } from '../../synthesis/life';
import { humanDate, humanIn, plural } from '../format';
import { Card, cx, MiniMoon, Moon } from '../ui';
import { useStore } from '../store';
import { ABOUT, personalStory } from '../../synthesis/explain';
import { About, GoodBad, SubTitle, Tip } from './Explain';

export const ord = (n: number) => `${n}-й`;

export function Section({ title, right, children, className }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cx('rise-in', className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
        {right}
      </div>
      {children}
    </Card>
  );
}

const MOOD_STYLE: Record<DayPlan['mood']['kind'], { bg: string; fg: string }> = {
  active: { bg: 'var(--accent-soft)', fg: 'var(--accent)' },
  even: { bg: 'var(--surface-2)', fg: 'var(--silver)' },
  calm: { bg: 'rgba(143,179,217,0.14)', fg: 'var(--tone-calm)' },
};

/** Луна и номер лунного дня крупно. */
export function MoonHero({
  model,
  number,
  until,
  next,
  now,
  sign,
}: {
  model: DayModel;
  sign: A.Sign;
  number: number;
  until: Date | null;
  next: number | null;
  now?: Date;
}) {
  const tz = model.location.timeZone;
  const phase = now ? A.phaseInfo(now) : model.phase;
  return (
    <section className="rise-in flex items-center gap-4 pt-1">
      <div className="shrink-0">
        <Moon angle={phase.angle} size={132} southern={model.location.latitude < 0} />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[56px] font-extralight leading-none tracking-tight">{number}</span>
          <span className="text-[16px] leading-tight text-muted">
            лунный
            <br />
            день
          </span>
        </div>
        <div className="mt-2 text-[15px] leading-snug">
          Луна {phase.waxing ? 'растёт' : 'убывает'} · {Math.round(phase.illuminationPct)}%
        </div>
        <div className="text-[15px] leading-snug text-muted">Луна {A.inSign(sign)}</div>
        {until && next !== null && (
          <div className="mt-1 text-[13px] leading-snug text-faint">
            {ord(next)} день начнётся в {A.formatTime(until, tz)}
            {now && until > now ? ` (${humanIn(until.getTime() - now.getTime())})` : ''}
          </div>
        )}
      </div>
    </section>
  );
}

/** Главное на сегодня: настроение, суть, что делать и что отложить. */
export function PlanCard({ plan, onWhy, personal }: { plan: DayPlan; onWhy?: () => void; personal?: EnergyCard['personal'] }) {
  const st = MOOD_STYLE[plan.mood.kind];
  return (
    <Card className="rise-in relative overflow-hidden">
      {personal && <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full opacity-[0.12] blur-3xl" style={{ background: personal.color.hex }} />}
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full px-3 py-1 text-[14px] font-medium" style={{ background: st.bg, color: st.fg }}>
          {plan.mood.title}
        </span>
        {onWhy && (
          <button onClick={onWhy} className="text-[14px] text-accent">
            Почему так?
          </button>
        )}
      </div>
      <p className="mt-3 text-[18px] leading-[1.5]">{plan.headline}</p>
      <p className="mt-1.5 text-[13px] text-faint">Главное на день — по {plan.lunarDay}-му лунному дню: он идёт большую часть дня.</p>
      <div className="mt-5 grid gap-4">
        <div>
          <div className="mb-2 text-[14px] font-medium text-good">Хорошо сегодня</div>
          <ul className="space-y-2">
            {plan.doList.map((x) => (
              <li key={x} className="flex gap-2.5 text-[16px] leading-6">
                <span className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-good-soft text-[11px] text-good">✓</span>
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-2 text-[14px] font-medium text-care">Лучше поберечься</div>
          <ul className="space-y-2">
            {plan.avoidList.map((x) => (
              <li key={x} className="flex gap-2.5 text-[16px] leading-6">
                <span className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-care-soft text-[11px] text-care">!</span>
                {x}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

/** Полоска дня: светлое время, Луна без курса, смена лунного дня, «сейчас». */
function DayBar({ model, now }: { model: DayModel; now?: Date }) {
  const { from, to } = model.window;
  const span = to.getTime() - from.getTime();
  const pos = (d: Date) => Math.max(0, Math.min(100, ((d.getTime() - from.getTime()) / span) * 100));
  const tz = model.location.timeZone;
  const voc = vocInDaylight(model);
  const changes = model.lunarDays.filter((s) => s.startsToday && s.from > from && s.from < to);
  const { sunrise, sunset } = model.sun;
  const hours = [0, 0.25, 0.5, 0.75, 1].map((k) => new Date(from.getTime() + k * span));
  return (
    <div className="pt-1">
      <div className="relative h-9 overflow-hidden rounded-xl bg-good-soft">
        {/* ночь до восхода и после заката */}
        {sunrise && sunrise > from && <div className="absolute inset-y-0 left-0 bg-[var(--night)]" style={{ width: `${pos(sunrise)}%` }} />}
        {sunset && sunset < to && <div className="absolute inset-y-0 right-0 bg-[var(--night)]" style={{ left: `${pos(sunset)}%` }} />}
        {voc.map((w) => (
          <div
            key={w.from.getTime()}
            className="absolute inset-y-0"
            style={{
              left: `${pos(w.from)}%`,
              width: `${pos(w.to) - pos(w.from)}%`,
              background: 'repeating-linear-gradient(135deg, var(--care-soft) 0 6px, transparent 6px 11px), var(--care-soft)',
              borderLeft: '2px solid var(--care)',
              borderRight: '2px solid var(--care)',
            }}
          />
        ))}
        {sunrise && sunrise > from && sunrise < to && <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[13px]" style={{ left: `${pos(sunrise)}%` }}>☀️</span>}
        {changes.map((c) => (
          <span key={c.from.getTime()} className="absolute inset-y-1 w-[2px] rounded bg-accent" style={{ left: `${pos(c.from)}%` }} />
        ))}
        {now && now > from && now < to && (
          <span className="absolute inset-y-0 w-[3px] -translate-x-1/2 bg-ink shadow" style={{ left: `${pos(now)}%` }} />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[12px] tabular-nums text-faint">
        {hours.map((h, i) => (
          <span key={i}>{A.formatTime(h, tz)}</span>
        ))}
      </div>
    </div>
  );
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} ${plural(h, 'час', 'часа', 'часов')}${m ? ` ${m} мин` : ''}`;
}

export function TimeCard({ model, now }: { model: DayModel; now?: Date }) {
  const tz = model.location.timeZone;
  const t = (d: Date) => A.formatTime(d, tz);
  const good = goodWindows(model);
  const voc = vocInDaylight(model);
  const changes = model.lunarDays.filter((s) => s.startsToday && s.from > model.bounds.start);
  const { sunrise, sunset, dayLengthMin } = model.sun;
  return (
    <Section title="Время дня">
      <DayBar model={model} now={now} />
      <div className="mt-4 space-y-3 text-[15px] leading-6">
        <Row dot="var(--good)">
          <b className="font-medium">Для важных дел:</b> {good.length ? good.map((w) => spanText(w, tz)).join(', ') : 'сегодня лучше без важных начинаний'}
        </Row>
        {voc.length > 0 ? (
          <Row dot="var(--care)">
            <b className="font-medium">Луна без курса:</b> {voc.map((w) => spanText(w, tz)).join(', ')}. В это время дела идут «вхолостую»: занимайся привычным, новое не начинай.
          </Row>
        ) : (
          <Row dot="var(--good)">Луны без курса днём нет: весь день подходит для дел.</Row>
        )}
        {changes.map((c) => (
          <Row key={c.from.getTime()} dot="var(--accent)">
            В {t(c.from)} начнётся {ord(c.day.number)} лунный день.
          </Row>
        ))}
        {sunrise && sunset && (
          <Row dot="var(--tone-active)">
            Солнце: восход {t(sunrise)}, закат {t(sunset)}
            {dayLengthMin ? `, светло ${fmtDuration(dayLengthMin)}` : ''}.
          </Row>
        )}
      </div>
    </Section>
  );
}

function Row({ dot, children }: { dot: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-[9px] h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
      <span>{children}</span>
    </div>
  );
}

export function LifeCard({ areas, sign, collapsed = false, content }: { areas: LifeArea[]; sign: A.Sign; collapsed?: boolean; content?: Content }) {
  const [open, setOpen] = useState(!collapsed);
  const sg = content?.sign(sign);
  return (
    <Section
      title={`Луна ${A.inSign(sign)}: подсказки`}
      right={
        <button onClick={() => setOpen(!open)} className="text-[14px] text-accent">
          {open ? 'свернуть' : 'открыть'}
        </button>
      }
    >
      {!open ? (
        <button onClick={() => setOpen(true)} className="w-full text-left text-[15px] leading-6 text-muted">
          Работа, деньги, здоровье, люди, дом: что добавляет дню знак Луны.
        </button>
      ) : (
      <>
      {sg && (
        <div className="mb-5 space-y-4">
          <p className="text-[16px] leading-6">{sg.essence} Луна добавляет дню {sg.coloring}.</p>
          <GoodBad good={sg.favorable} bad={sg.mindful} goodTitle="Хорошо для" badTitle="Осторожно" />
          <About>{ABOUT.sign}</About>
          <div className="pt-1 text-[15px] font-semibold">По сферам жизни</div>
        </div>
      )}
      <div className="divide-y divide-[var(--line)]">
        {areas.map((a) => (
          <div key={a.key} className="py-3.5 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2 text-[16px] font-medium">
              <span className="text-[18px]">{a.icon}</span>
              {a.title}
            </div>
            <div className="mt-1.5 space-y-1 pl-[30px] text-[15px] leading-6">
              <div>
                <span className="text-good">Хорошо:</span> {a.good}
              </div>
              <div>
                <span className="text-care">Осторожно:</span> {a.careful}
              </div>
              {a.note && <div className="text-[14px] leading-5 text-muted">{a.note}</div>}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[12px] leading-5 text-faint">Знак Луны меняется раз в 2–3 дня и окрашивает день. Это традиция, ориентир, а не правило. В вопросах здоровья главный — врач.</p>
      </>
      )}
    </Section>
  );
}

export function PersonalCard({ model, content, bare = false }: { model: DayModel; content: Content; bare?: boolean }) {
  const { settings } = useStore();
  const st = personalStory(model, content, settings.birthday);
  if (!st) return null;
  const body = (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-serif text-[28px] font-medium text-white" style={{ background: st.colorHex, boxShadow: `0 0 28px ${st.colorHex}55` }}>
          {st.number}
        </span>
        <div>
          <div className="font-serif text-[24px] font-medium leading-tight">Твой личный день — {st.number}</div>
          <div className="text-[14px] text-muted">цвет дня — {st.colorName}</div>
        </div>
      </div>
      <div>
        <SubTitle>Что значит день {st.number}</SubTitle>
        <p className="text-[16px] leading-6">{st.about}</p>
      </div>
      <GoodBad good={st.favorable} bad={st.mindful} badTitle="Не стоит" />
      <Tip>{st.tip}</Tip>
      <About>{ABOUT.personal}</About>
      <div>
        <SubTitle>Как получилось число {st.number}</SubTitle>
        <ul className="space-y-1.5 text-[14px] leading-5 text-muted">
          {st.steps.map((x) => (
            <li key={x} className="flex gap-2">
              <span className="text-faint">·</span>
              {x}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[15px] italic leading-6 text-silver">«{st.affirmation}» — фраза-настрой на день.</p>
    </div>
  );
  return bare ? body : <Card className="rise-in">{body}</Card>;
}

export function QuestionCard({ plan, onWrite }: { plan: DayPlan; onWrite: () => void }) {
  return (
    <Section title="Вечером, для себя">
      <p className="text-[16px] leading-6">{plan.practice}</p>
      <p className="mt-3 text-[16px] italic leading-6 text-silver">{plan.question}</p>
      <button onClick={onWrite} className="mt-4 h-12 w-full rounded-2xl bg-accent text-[16px] font-medium text-[#1b1608] transition active:scale-[0.98]">
        Записать, как прошёл день
      </button>
    </Section>
  );
}

/** Ближайшие новолуние, полнолуние и затмения (до 45 дней). */
export function SoonCard({ now, tz, onOpen, onAll }: { now: Date; tz: string; onOpen: (d: A.DateKey) => void; onAll: () => void }) {
  const to = new Date(now.getTime() + 45 * A.MS_PER_DAY);
  const items: { time: Date; title: string; angle: number | null }[] = [];
  for (const q of A.quartersBetween(now, to)) {
    if (q.quarter === 0 || q.quarter === 2) items.push({ time: q.time, title: A.QUARTER_NAMES[q.quarter], angle: q.quarter === 0 ? 0 : 180 });
  }
  for (const e of A.eclipsesBetween(now, to)) items.push({ time: e.peak, title: `${e.body === 'sun' ? 'Солнечное' : 'Лунное'} затмение`, angle: null });
  items.sort((a, b) => a.time.getTime() - b.time.getTime());
  const top = items.slice(0, 3);
  return (
    <Section
      title="Скоро"
      right={
        <button onClick={onAll} className="text-[14px] text-accent">
          Все события
        </button>
      }
    >
      <div className="space-y-1">
        {top.map((x) => {
          const key = A.toDateKey(x.time, tz);
          const days = Math.round((A.dayBounds(key, tz).start.getTime() - A.dayBounds(A.toDateKey(now, tz), tz).start.getTime()) / A.MS_PER_DAY);
          return (
            <button key={x.time.getTime()} onClick={() => onOpen(key)} className="flex w-full items-center gap-3 rounded-xl py-2 text-left">
              <span className="flex h-8 w-8 items-center justify-center">
                {x.angle !== null ? <MiniMoon angle={x.angle} size={24} /> : <span className="h-3 w-3 rotate-45 bg-accent" />}
              </span>
              <span className="flex-1">
                <span className="block text-[16px]">{x.title}</span>
                <span className="block text-[14px] text-muted">
                  {humanDate(key)}, {A.formatTime(x.time, tz)}
                </span>
              </span>
              <span className="text-[14px] text-faint">{days === 0 ? 'сегодня' : days === 1 ? 'завтра' : `через ${days} ${plural(days, 'день', 'дня', 'дней')}`}</span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

const VERDICT: Record<Verdict, { title: string; color: string; soft: string; mark: string }> = {
  good: { title: 'Благоприятно', color: 'var(--good)', soft: 'var(--good-soft)', mark: '✓' },
  neutral: { title: 'Нейтрально', color: 'var(--silver)', soft: 'var(--surface-2)', mark: '~' },
  bad: { title: 'Лучше не стоит', color: 'var(--bad)', soft: 'var(--bad-soft)', mark: '✕' },
};

/** Таблица сфер на лунный день: сначала благоприятное, потом нейтральное (свёрнуто), потом то, чего лучше избегать. */
export function AreasCard({ areas, lunarDay, prev, changesAt, tz }: { areas: AreaVerdict[]; lunarDay: number; prev?: number | null; changesAt?: Date | null; tz: string }) {
  const dreams = dreamsVerdict(lunarDay);
  const [openNeutral, setOpenNeutral] = useState(false);
  return (
    <Section title="Что сегодня благоприятно">
      <p className="-mt-1 mb-4 text-[14px] leading-5 text-muted">
        По {lunarDay}-му лунному дню{prev && changesAt ? ` (до ${A.formatTime(changesAt, tz)} ещё идёт ${prev}-й)` : ''}.
      </p>
      <div className="space-y-5">
        {(['good', 'neutral', 'bad'] as const).map((v) => {
          const rows = areas.filter((a) => a.verdict === v);
          if (!rows.length) return null;
          const st = VERDICT[v];
          return (
            <div key={v}>
              <div className="mb-2 flex items-center gap-2 text-[14px] font-semibold" style={{ color: st.color }}>
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px]" style={{ background: st.soft }}>
                  {st.mark}
                </span>
                {st.title} · {rows.length}
              </div>
              {v === 'neutral' && !openNeutral ? (
                <button onClick={() => setOpenNeutral(true)} className="flex w-full flex-wrap gap-1.5 text-left">
                  {rows.map((a) => (
                    <span key={a.key} className="rounded-full border border-line px-2.5 py-1 text-[14px] text-muted">
                      {a.icon} {a.title}
                    </span>
                  ))}
                  <span className="px-1 py-1 text-[14px] text-accent">подробнее</span>
                </button>
              ) : (
              <div className="overflow-hidden rounded-2xl border border-line">
                {rows.map((a) => (
                  <div key={a.key} className="flex gap-3 border-t border-line px-3.5 py-3 first:border-t-0" style={{ boxShadow: `inset 3px 0 0 ${st.color}` }}>
                    <span className="w-6 shrink-0 text-center text-[18px] leading-6">{a.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium leading-6">{a.title}</span>
                      <span className="block text-[14px] leading-5 text-muted">{a.text}</span>
                      {a.note && <span className="mt-1 block text-[13px] leading-5" style={{ color: st.color }}>{a.note}</span>}
                    </span>
                  </div>
                ))}
              </div>
              )}
            </div>
          );
        })}
        <div className="flex gap-3 rounded-2xl bg-surface-2 px-3.5 py-3">
          <span className="w-6 shrink-0 text-center text-[18px] leading-6">💭</span>
          <span>
            <span className="block text-[15px] font-medium leading-6">Сны этой ночи</span>
            <span className="block text-[14px] leading-5 text-muted">{dreams.text}</span>
          </span>
        </div>
      </div>
      <p className="mt-4 text-[12px] leading-5 text-faint">{AREAS_SOURCE}</p>
    </Section>
  );
}
