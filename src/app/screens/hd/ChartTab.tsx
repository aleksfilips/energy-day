/** «Моя карта» (D-148): сводка, планеты по столбцам, переменные, из чего состоит карта. Тот же экран — для карты другого человека. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Bodygraph } from '../../../humandesign/chart';
import { chartStats, crossAngle, fullActivations, QUARTER_TEXT, QUARTERS, CIRCUIT_GROUPS, CIRCUIT_NAME, SIGN_GLYPH, SIGN_RU, variables, type FullActivation, type Variable } from '../../../humandesign/details';
import { haptic } from '../../../telegram';
import { cx, Sheet } from '../../ui';
import type { Nav } from '../../App';
import { AUTH_NAME, BODY_NAME, ChartGraph, DEF_NAME, gateText, HD, Info, Legend, lineName, PLANET_COLOR, PlanetIcon, planetMarks, Rubric, SIDE_COLOR, typeName, useTone } from './common';

const TYPE_INFO = (t: string) => {
  const x = (HD.types as Record<string, { name: string; strategy: string; signature: string; notSelf: string; purpose: string }>)[t];
  if (!x) return null;
  return (
    <>
      <p>Стратегия: {x.strategy}.</p>
      <p>Цель: {x.purpose}.</p>
      <p>
        Подпись (когда живёшь по себе): {x.signature}. Тема не-себя: {x.notSelf}.
      </p>
    </>
  );
};

export function Facts({ chart }: { chart: Bodygraph }) {
  const auth = (HD.authorities as Record<string, string>)[chart.authority];
  return (
    <div className="rounded-[24px] border border-line bg-surface p-3 shadow-[var(--shadow)]">
      <div className="grid grid-cols-2 gap-2.5">
        <Fact k="Тип" info={TYPE_INFO(chart.type)} v={typeName(chart.type)} />
        <Fact k="Авторитет" info={auth ? <p>{auth.charAt(0).toUpperCase() + auth.slice(1)}.</p> : null} v={AUTH_NAME[chart.authority]!} />
        <Fact
          k="Профиль"
          info={<p>Роль, в которой ты проживаешь жизнь. Первое число — линия Солнца Личности (сознательное), второе — линия Солнца Дизайна (бессознательное).</p>}
          v={chart.profile.join('/')}
          small={`${lineName(chart.profile[0])} / ${lineName(chart.profile[1])}`}
        />
        <Fact k="Определённость" info={<p>Как связаны твои определённые центры: в одну цепь или в несколько отдельных частей.</p>} v={DEF_NAME[chart.definition]!} />
        <Fact
          wide
          k="Инкарнационный крест"
          info={<p>Тема жизни. Его задают ворота Солнца и Земли в Личности и Дизайне. Угол креста — по профилю.</p>}
          v={crossAngle(chart.profile)}
          small={`${chart.cross[0]}/${chart.cross[1]} | ${chart.cross[2]}/${chart.cross[3]}`}
        />
      </div>
    </div>
  );
}

function Fact({ k, v, small, info, wide }: { k: string; v: string; small?: string; info: ReactNode; wide?: boolean }) {
  return (
    <div className={cx('rounded-2xl bg-surface-2 px-3.5 py-3', wide && 'col-span-2')}>
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
        {k}
        {info && <Info title={k} text={info} small />}
      </div>
      <div className={cx('mt-1 font-medium leading-6 [hyphens:auto]', v.length > 11 && !wide ? 'text-[14.5px] tracking-[-0.01em]' : 'text-[17px]')}>{v}</div>
      {small && <div className="text-[13px] leading-5 text-muted">{small}</div>}
    </div>
  );
}

// ---------- планеты по столбцам ----------

export function PlanetsCard({ chart, title = 'Планеты и ворота' }: { chart: Bodygraph; title?: string }) {
  const tone = useTone();
  const S = SIDE_COLOR[tone];
  const acts = useMemo(() => fullActivations(chart), [chart]);
  const marks = useMemo(() => planetMarks(chart, tone), [chart, tone]);
  const [sel, setSel] = useState<{ a: FullActivation; side: 'design' | 'personality' } | null>(null);
  const [big, setBig] = useState(false);
  const row = (a: FullActivation, side: 'design' | 'personality') => {
    const on = sel?.a === a;
    return (
      <button
        key={a.body}
        onClick={() => {
          haptic.select();
          setSel({ a, side });
        }}
        className={cx('flex h-[23px] w-full items-center gap-1 rounded-md text-[13px] tabular-nums transition', side === 'design' ? 'justify-start' : 'flex-row-reverse justify-start', on && 'bg-surface-2')}
        style={{ color: side === 'design' ? S.D : S.P }}
        aria-label={`${BODY_NAME[a.body]} ${a.gate}.${a.line}`}
      >
        <PlanetIcon body={a.body} size={13} />
        <span className="font-medium">
          {a.gate}.{a.line}
        </span>
        {a.retro && <span className="text-[10px] opacity-80">℞</span>}
      </button>
    );
  };
  return (
    <div className="rounded-[24px] border border-line bg-surface px-3 pb-4 pt-3.5 shadow-[var(--shadow)]">
      <div className="mx-1 mb-2.5 flex items-center justify-between">
        <Rubric>{title}</Rubric>
        <button onClick={() => setBig(true)} aria-label="Бодиграф крупно" className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-muted">
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
          </svg>
        </button>
      </div>
      <div className="mb-1 flex justify-between px-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]">
        <span className="flex items-center gap-1.5" style={{ color: S.D }}>
          Дизайн <Info small title="Дизайн" text={<p>Бессознательная часть: момент, когда Солнце было на 88° раньше, чем при рождении (примерно за три месяца). То, что живёт в теле и видно другим.</p>} />
        </span>
        <span className="flex items-center gap-1.5" style={{ color: S.P }}>
          <Info small title="Личность" text={<p>Сознательная часть — момент рождения. То, что ты знаешь о себе.</p>} /> Личность
        </span>
      </div>
      <div className="grid grid-cols-[52px_1fr_52px] items-center gap-1">
        <div className="space-y-[3px]">{acts.design.map((a) => row(a, 'design'))}</div>
        <button onClick={() => setBig(true)} aria-label="Открыть бодиграф крупно" className="min-w-0">
          <ChartGraph chart={chart} marks={marks} pulse={sel?.a.gate ?? null} className="mx-auto block w-full" />
        </button>
        <div className="space-y-[3px]">{acts.personality.map((a) => row(a, 'personality'))}</div>
      </div>
      <Legend
        items={[
          { color: S.P, label: 'Личность' },
          { color: S.D, label: 'Дизайн' },
          { color: S.P, dashed: S.D, label: 'Оба' },
          { color: 'linear-gradient(#F8E3B5,#C8924A)', label: 'Центр определён' },
        ]}
      />
      <PlanetSheet sel={sel} onClose={() => setSel(null)} />
      <Sheet open={big} onClose={() => setBig(false)}>
        <Rubric>Бодиграф</Rubric>
        <div className="mt-1 font-serif text-[28px] font-medium">
          {typeName(chart.type)} · {chart.profile.join('/')}
        </div>
        <ChartGraph chart={chart} marks={marks} className="mx-auto mt-2 block w-full max-w-[480px]" />
        <Legend
          items={[
            { color: S.P, label: 'Личность' },
            { color: S.D, label: 'Дизайн' },
            { color: 'linear-gradient(#F8E3B5,#C8924A)', label: 'Определённый центр' },
          ]}
        />
      </Sheet>
    </div>
  );
}

export function PlanetSheet({ sel, onClose, transit = false }: { sel: { a: FullActivation; side: 'design' | 'personality' } | null; onClose: () => void; transit?: boolean }) {
  const tone = useTone();
  if (!sel) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  const { a, side } = sel;
  const G = gateText(a.gate);
  const c = PLANET_COLOR[tone][a.body];
  const S = SIDE_COLOR[tone];
  const deg = `${Math.floor(a.degree)}°${String(Math.floor((a.degree % 1) * 60)).padStart(2, '0')}′`;
  return (
    <Sheet open onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: `${c}22`, color: c }}>
          <PlanetIcon body={a.body} size={28} />
        </div>
        <div className="mt-3 font-serif text-[26px] font-medium leading-tight">
          {transit ? 'Транзит: ' : ''}
          {BODY_NAME[a.body]} в воротах {a.gate}.{a.line}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5 text-[13px]">
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-muted">
            {SIGN_GLYPH[a.sign]}︎ {SIGN_RU[a.sign]} · {deg}
          </span>
          <span className="rounded-full px-2.5 py-1" style={{ background: `${transit ? S.T : side === 'design' ? S.D : S.P}22`, color: transit ? S.T : side === 'design' ? S.D : S.P }}>
            {transit ? 'Транзит сейчас' : side === 'design' ? 'Дизайн' : 'Личность'}
          </span>
          {a.retro && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-muted">℞ ретроградно</span>}
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-surface-2 px-4 py-3">
        <div className="text-[15px] font-semibold">
          Ворота {a.gate} · «{G.name}»
        </div>
        <p className="mt-1 text-[15px] leading-6 text-muted">
          {G.gist.charAt(0).toUpperCase() + G.gist.slice(1)}. Гексаграмма И-Цзин: «{G.iching}».
        </p>
      </div>
      <div className="mt-2 rounded-2xl bg-surface-2 px-4 py-3">
        <div className="text-[15px] font-semibold">
          Линия {a.line} · {lineName(a.line)}
        </div>
        {transit && <p className="mt-1 text-[15px] leading-6 text-muted">Сейчас эта планета временно включает в тебе ворота {a.gate}.</p>}
      </div>
      <p className="mt-3 text-center text-[13px] text-faint">
        Цвет {a.color} · тон {a.tone} · база {a.base}
      </p>
    </Sheet>
  );
}

// ---------- переменные ----------

const HEAD_VIEW = [524, 108, 308, 452] as const;

export function VariablesCard({ chart }: { chart: Bodygraph }) {
  const tone = useTone();
  const S = SIDE_COLOR[tone];
  const V = useMemo(() => variables(chart), [chart]);
  const [open, setOpen] = useState<Variable | null>(null);
  const box = (v: Variable, right: boolean) => (
    <button
      key={v.key}
      onClick={() => setOpen(v)}
      className={cx('w-full rounded-2xl bg-surface-2 px-3 py-2.5 transition active:scale-[0.97]', right ? 'text-right' : 'text-left')}
    >
      <Arrow dir={v.dir} color={v.side === 'design' ? S.D : S.P} className={right ? 'ml-auto' : ''} />
      <div className="mt-1 text-[14px] font-medium">{v.name}</div>
      <div className="text-[17px] tabular-nums">
        {v.detail.color} · {v.detail.tone} · {v.detail.base}
      </div>
      <div className="text-[11px] text-faint">цвет · тон · база</div>
    </button>
  );
  const arrowAt = (x: number, y: number, dir: 'left' | 'right', color: string) => {
    const L = 64;
    const s = dir === 'left' ? -1 : 1;
    const x0 = x - (s * L) / 2;
    const x1 = x + (s * L) / 2;
    return <path d={`M${x0} ${y}H${x1}M${x1 - s * 18} ${y - 16}L${x1} ${y}L${x1 - s * 18} ${y + 16}`} stroke={color} />;
  };
  return (
    <div className="rounded-[24px] border border-line bg-surface p-4 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-[26px] font-medium">Переменные</h2>
        <Info
          title="Переменные"
          text={
            <>
              <p>Четыре стрелки у головы бодиграфа. Их считают по цвету, тону и базе Солнца и Узлов: слева — Дизайн, справа — Личность.</p>
              <p>Стрелка влево — тон 1–3, вправо — тон 4–6.</p>
            </>
          }
        />
      </div>
      <div className="mt-3 grid grid-cols-[1fr_96px_1fr] items-center gap-2">
        <div className="space-y-2">{V.filter((v) => v.side === 'design').map((v) => box(v, false))}</div>
        <div className="relative">
          <ChartGraph chart={chart} viewBox={HEAD_VIEW} className="block w-full" />
          <svg viewBox={HEAD_VIEW.join(' ')} className="absolute inset-0 h-full w-full" fill="none" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
            {arrowAt(560, 160, V[0]!.dir, S.D)}
            {arrowAt(560, 420, V[1]!.dir, S.D)}
            {arrowAt(796, 160, V[2]!.dir, S.P)}
            {arrowAt(796, 420, V[3]!.dir, S.P)}
          </svg>
        </div>
        <div className="space-y-2">{V.filter((v) => v.side === 'personality').map((v) => box(v, true))}</div>
      </div>
      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <>
            <div className="font-serif text-[26px] font-medium">{open.name}</div>
            <p className="mt-2 text-[15px] leading-6 text-muted">
              {open.from}: цвет {open.detail.color}, тон {open.detail.tone}, база {open.detail.base}. Стрелка {open.dir === 'left' ? 'влево' : 'вправо'}.
            </p>
            <div className="mt-3 rounded-2xl border border-dashed border-line px-4 py-3 text-[14px] text-faint">Толкование — по материалам курса</div>
          </>
        )}
      </Sheet>
    </div>
  );
}

function Arrow({ dir, color, className }: { dir: 'left' | 'right'; color: string; className?: string }) {
  return (
    <svg viewBox="0 0 26 14" width={26} height={14} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={cx('block', className)}>
      <path d={dir === 'left' ? 'M24 7H3M8 2L3 7l5 5' : 'M2 7h21M18 2l5 5-5 5'} />
    </svg>
  );
}

// ---------- из чего состоит карта ----------

export function StatsCard({ chart }: { chart: Bodygraph }) {
  const st = useMemo(() => chartStats(chart), [chart]);
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setShown(true);
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (setShown(true), io.disconnect()), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const pct = (n: number) => Math.round((n / st.total) * 100);
  const bar = (label: string, n: number, color: string, i: number) => (
    <div key={label} className="grid grid-cols-[1fr_72px_78px] items-center gap-2.5 py-[5px] text-[15px]">
      <span className="truncate">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-surface-2">
        <span className="block h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: shown ? `${pct(n)}%` : 0, background: color, transitionDelay: `${i * 60}ms` }} />
      </span>
      <span className="whitespace-nowrap text-right tabular-nums text-muted">
        <b className="text-ink">{n}</b> · {pct(n)}%
      </span>
    </div>
  );
  const quarters = [...QUARTERS].sort((a, b) => st.quarters[b] - st.quarters[a]);
  return (
    <div ref={ref} className="rounded-[24px] border border-line bg-surface p-4 shadow-[var(--shadow)]">
      <h2 className="font-serif text-[26px] font-medium">Из чего состоит карта</h2>
      <p className="mt-0.5 text-[14px] text-muted">{st.total} активаций: 13 в Личности и 13 в Дизайне</p>
      <Group
        title="Контуры"
        info={<p>Каналы объединяются в контуры. Индивидуальный — про уникальность и мутацию, Коллективный — про общее дело и опыт, Племенной — про своих и поддержку, Интеграция — про выживание собственной индивидуальности. Ворота на стыке контуров считаются в каждом.</p>}
      >
        {CIRCUIT_GROUPS.map((g, i) => bar(CIRCUIT_NAME[g], st.circuits[g], 'var(--accent)', i))}
      </Group>
      <Group title="Четверти" info={<p>Сколько твоих активаций в каждой из четырёх четвертей мандалы.</p>}>
        {quarters.map((q, i) => bar(QUARTER_TEXT[q].name, st.quarters[q], 'var(--good)', i + 4))}
      </Group>
      <Group title="Линии" info={<p>Сколько активаций приходится на каждую из шести линий ворот.</p>}>
        {st.lines.map((n, i) => bar(`${i + 1} · ${lineName(i + 1)}`, n, 'var(--tone-gentle)', i + 8))}
      </Group>
    </div>
  );
}

function Group({ title, info, children }: { title: string; info: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-faint">{title}</span>
        <Info title={title} text={info} />
      </div>
      {children}
    </div>
  );
}

export function ChartTab({ chart, nav, self = true }: { chart: Bodygraph; nav: Nav; self?: boolean }) {
  return (
    <div className="space-y-4">
      <Facts chart={chart} />
      <PlanetsCard chart={chart} />
      <VariablesCard chart={chart} />
      <StatsCard chart={chart} />
      {self && (
        <button onClick={() => nav.push({ name: 'hdTime' })} className="flex w-full items-center gap-3 rounded-[24px] border border-line bg-surface p-4 text-left shadow-[var(--shadow)] active:scale-[0.99]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5V12l3 2" />
            </svg>
          </span>
          <span className="flex-1">
            <b className="block text-[16px] font-medium">Не знаешь точного времени?</b>
            <span className="text-[14px] text-muted">Посмотри, что в карте меняется за сутки</span>
          </span>
          <span className="text-faint">›</span>
        </button>
      )}
    </div>
  );
}

