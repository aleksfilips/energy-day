/** «Циклы жизни» (D-148): шкала 0–90 лет, карточки циклов с датами, прогрессом и картой неба на точную дату. */
import { useEffect, useMemo, useState } from 'react';
import { activationsAt, type Bodygraph } from '../../../humandesign/chart';
import { ageAt, cycleState, lifeCycles, type LifeCycle } from '../../../humandesign/cycles';
import { cx, Sheet } from '../../ui';
import { ChartGraph, dFull, dShort, gatesLayer, Info, Legend, PlanetIcon, plural, Rubric, SIDE_COLOR, sideMarks, useTone, years } from './common';

const aheadText = (yrs: number) => {
  if (yrs < 1) {
    const m = Math.max(1, Math.round(yrs * 12));
    return `Впереди · через ${m} ${plural(m, 'месяц', 'месяца', 'месяцев')}`;
  }
  return `Впереди · через ${years(Math.round(yrs))}`;
};

function Timeline({ cycles, age }: { cycles: LifeCycle[]; age: number }) {
  const now = new Date();
  const x = (a: number) => `${((Math.min(Math.max(a, 0), 90) / 90) * 100).toFixed(2)}%`;
  return (
    <div className="relative mx-2 mt-1.5 h-[150px]">
      {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((a) => (
        <span key={a}>
          <span className="absolute top-[80px] h-[9px] w-px bg-accent opacity-40" style={{ left: x(a) }} />
          <span className="absolute top-[94px] -translate-x-1/2 text-[10px] tabular-nums text-faint" style={{ left: x(a) }}>
            {a}
          </span>
        </span>
      ))}
      <div className="absolute inset-x-0 top-[84px] h-[1.5px] opacity-65" style={{ background: 'linear-gradient(90deg, transparent, var(--accent) 6%, var(--accent) 94%, transparent)' }} />
      {cycles.map((c, i) => {
        const st = cycleState(c, now).state;
        const up = i % 2 === 1;
        const n = Math.round(c.ageExact);
        return (
          <span key={c.key}>
            <span className="absolute w-px bg-line" style={{ left: x(c.ageExact), top: up ? 36 : 72, height: up ? 42 : 6 }} />
            <span
              className={cx('absolute top-[78px] -ml-[6.5px] h-[13px] w-[13px] rounded-full border-[1.5px]', st === 'now' ? 'border-accent bg-accent' : 'bg-surface', st === 'past' ? 'border-faint' : st === 'ahead' ? 'border-[var(--tone-calm)]' : '')}
              style={{ left: x(c.ageExact) }}
            />
            <span className={cx('absolute -translate-x-1/2 whitespace-nowrap text-center text-[11px] leading-[1.25] text-muted', up ? 'top-1' : 'top-10')} style={{ left: x(c.ageExact) }}>
              <b className="block font-medium text-ink">{c.short}</b>
              {years(n)}
            </span>
          </span>
        );
      })}
      <span className="hd-you absolute top-[75px] -ml-[9.5px] h-[19px] w-[19px] rounded-full bg-accent" style={{ left: x(age) }} aria-label="Ты сейчас" />
      <span className="absolute top-[112px] -translate-x-1/2 whitespace-nowrap text-center text-[11px] leading-[1.25] text-accent" style={{ left: x(Math.min(Math.max(age, 5), 85)) }}>
        <b className="block font-medium">Ты сейчас</b>
        {years(Math.floor(age))}
      </span>
    </div>
  );
}

function Arc({ p, st, delay }: { p: number; st: 'past' | 'now' | 'ahead'; delay: number }) {
  const r = 23;
  const C = 2 * Math.PI * r;
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), 120 + delay);
    return () => clearTimeout(t);
  }, [delay]);
  const col = st === 'now' ? 'var(--accent)' : st === 'past' ? 'var(--faint)' : 'var(--tone-calm)';
  return (
    <div className="relative h-14 w-14 shrink-0" aria-label={`Пройдено ${Math.round(p * 100)}%`}>
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx={28} cy={28} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={4} />
        <circle
          cx={28}
          cy={28}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={C.toFixed(2)}
          strokeDashoffset={(on ? C * (1 - p) : C).toFixed(2)}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[12px] font-semibold tabular-nums" style={{ color: col }}>
        {Math.round(p * 100)}%
      </span>
    </div>
  );
}

export function CyclesTab({ chart }: { chart: Bodygraph }) {
  const tone = useTone();
  const S = SIDE_COLOR[tone];
  const cycles = useMemo(() => lifeCycles(chart.birthUtc), [chart]);
  const now = new Date();
  const age = ageAt(chart.birthUtc, now);
  const [open, setOpen] = useState<LifeCycle | null>(null);
  const sky = useMemo(() => (open ? activationsAt(open.exact[0]!) : []), [open]);

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-line bg-surface p-4 shadow-[var(--shadow)]">
        <div className="flex items-center justify-between">
          <Rubric>Шкала жизни · 0–90 лет</Rubric>
          <Info
            title="Циклы жизни"
            text={
              <>
                <p>Медленные планеты время от времени возвращаются туда, где стояли в момент твоего рождения. Это большие этапы жизни.</p>
                <p>Период цикла — пока планета ближе двух градусов к своей точке. Точные даты — дни, когда она проходит саму точку (из-за попятного движения их бывает до трёх).</p>
              </>
            }
          />
        </div>
        <Timeline cycles={cycles} age={age} />
      </div>
      {cycles.map((c, i) => {
        const s = cycleState(c, now);
        return (
          <div key={c.key} className="rounded-[24px] border border-line bg-surface p-4 shadow-[var(--shadow)]">
            <div className="flex items-start gap-3.5">
              <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-surface-2 text-accent">
                <PlanetIcon body={c.planet} size={24} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-serif text-[23px] font-semibold leading-[1.1]">{c.title}</div>
                <div className="mt-1 text-[14px] leading-[1.4] text-muted">
                  с {dFull(c.start)}
                  <br />
                  по {dFull(c.end)}
                </div>
                <span
                  className={cx(
                    'mt-2.5 inline-flex h-[26px] items-center gap-1.5 rounded-full px-[11px] text-[13px] font-medium',
                    s.state === 'past' && 'bg-surface-2 text-faint',
                    s.state === 'now' && 'hd-now-badge bg-accent-soft text-accent',
                    s.state === 'ahead' && 'text-[var(--tone-calm)]',
                  )}
                  style={s.state === 'ahead' ? { background: 'color-mix(in srgb, var(--tone-calm) 14%, transparent)' } : undefined}
                >
                  {s.state === 'now' && <span className="h-[7px] w-[7px] rounded-full bg-current" />}
                  {s.state === 'past' ? 'Прошёл' : s.state === 'now' ? 'Идёт сейчас' : aheadText(s.years)}
                </span>
              </div>
              <Arc p={s.progress} st={s.state} delay={90 * i} />
            </div>
            <p className="mt-3 text-[13px] leading-5 text-faint">
              Точн{c.exact.length > 1 ? 'ые даты' : 'ая дата'}: {c.exact.map(dShort).join(' · ')} · возраст {c.ageExact.toFixed(1).replace('.', ',')}
            </p>
            <div className="my-3 rounded-2xl border-[1.5px] border-dashed border-line px-3.5 py-3 text-[14px] text-faint">Описание цикла — по материалам курса</div>
            <button onClick={() => setOpen(c)} className="h-10 rounded-full border border-line px-4 text-[15px] text-ink active:scale-95">
              Показать карту цикла
            </button>
          </div>
        );
      })}
      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <>
            <Rubric>Карта цикла</Rubric>
            <div className="mt-1 font-serif text-[28px] font-medium leading-tight">{open.title}</div>
            <p className="mt-1 text-[15px] text-muted">Небо на {dFull(open.exact[0]!)} поверх твоей карты</p>
            <ChartGraph chart={chart} layer={gatesLayer(chart, sky)} marks={sideMarks(chart, tone, sky.map((a) => a.gate))} className="mx-auto mt-2 block w-full max-w-[440px]" />
            <Legend
              items={[
                { color: S.P, label: 'Личность' },
                { color: S.D, label: 'Дизайн' },
                { color: S.T, label: 'Небо цикла' },
              ]}
            />
            <div className="mt-4 rounded-2xl bg-surface-2 px-4 py-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Ворота цикла</div>
              <div className="flex flex-wrap gap-1.5">
                {sky.map((a) => (
                  <span key={a.body} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] tabular-nums" style={{ background: `${S.T}22`, color: S.T }}>
                    <PlanetIcon body={a.body} size={13} />
                    {a.gate}.{a.line}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
