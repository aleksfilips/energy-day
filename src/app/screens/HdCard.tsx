/**
 * «Дизайн человека»: карточка-вход на «Сегодня», полный лист и режим Рефлектора (D-133).
 * Данные рождения — в «Мои данные».
 */
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { formatTime, toDateKey, type DateKey } from '../../astro/time';
import { bodygraph, type Bodygraph } from '../../humandesign/chart';
import { dayTransits } from '../../humandesign/transits';
import { centerTitle, channelTitle, gateInfo, REFLECTOR, transitStory, type HdItem, type HdStory } from '../../humandesign/summary';
import { lunarMonth, moonGateAt, moonReturn } from '../../humandesign/reflector';
import { CENTERS, type Center } from '../../humandesign/graph';
import { HD_BODY_NAMES, type HdBody } from '../../humandesign/positions';
import type { GraphLayer, GraphView, NatalMark } from '../../humandesign/overlay';
import type { LunarDay } from '../../humandesign/reflector';
import { ABOUT } from '../../synthesis/explain';
import { useStore } from '../store';
import { haptic } from '../../telegram';
import { cx, Sheet } from '../ui';
import { About, SubTitle } from './Explain';
import { SilhouettePick } from './Profile';
import { BodygraphSvg, CENTER_FILL, NIGHT, PALETTE, type GraphTone } from './Bodygraph';
import { humanDate } from '../format';

/** Карта человека (null, если нет данных рождения). */
export function useHdChart(): Bodygraph | null {
  const { settings } = useStore();
  const birth = settings.humanDesign;
  return useMemo(() => (birth ? bodygraph(birth) : null), [birth]);
}

/** Транзиты Дизайна человека на дату (null, если дата рождения не задана). */
export function useHdStory(date: DateKey): HdStory | null {
  const { location } = useStore();
  const chart = useHdChart();
  const tz = location?.timeZone;
  return useMemo(() => {
    if (!chart || !tz) return null;
    try {
      return transitStory(chart, dayTransits(chart, date, tz), tz, new Date());
    } catch {
      return null;
    }
  }, [chart, date, tz]);
}

/* ───────────── «Ночная» карточка: одинаковая в тёмной и светлой теме ───────────── */

export function NightCard({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cx('relative overflow-hidden rounded-[28px]', onClick && 'cursor-pointer transition-transform active:scale-[0.985]', className)}
      style={{
        background: `radial-gradient(120% 80% at 50% 0%, #2a3566 0%, transparent 60%), linear-gradient(160deg, ${NIGHT.bgA}, ${NIGHT.bgB})`,
        color: NIGHT.ink,
        boxShadow: '0 0 0 1px rgba(236,201,143,0.22) inset, 0 18px 40px rgba(8,12,30,0.35)',
      }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <div className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: light ? 'var(--accent)' : NIGHT.gold }}>
      {children}
    </div>
  );
}

function NightToggle<T extends string>({ value, options, onChange, light = false }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; light?: boolean }) {
  return (
    <div className="mx-auto flex w-fit rounded-full p-1" style={light ? { background: 'var(--surface-2)' } : { background: 'rgba(255,255,255,0.06)', boxShadow: '0 0 0 1px rgba(255,255,255,0.08) inset' }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={(e) => {
            e.stopPropagation();
            haptic.select();
            onChange(o.value);
          }}
          className="h-8 rounded-full px-4 text-[13px] font-medium transition"
          style={value === o.value ? { background: `linear-gradient(180deg, ${NIGHT.goldA}, ${NIGHT.goldB})`, color: NIGHT.pin } : { color: light ? 'var(--muted)' : NIGHT.muted }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Цвета карточки с бодиграфом: светлая тема — белая «бумага», тёмная — ночь. */
function useHeroTone() {
  const { theme } = useStore();
  const tone: GraphTone = theme === 'light' ? 'light' : 'night';
  return { tone, P: PALETTE[tone], ink: tone === 'light' ? 'var(--ink)' : NIGHT.ink, muted: tone === 'light' ? 'var(--muted)' : NIGHT.muted, faint: tone === 'light' ? 'var(--faint)' : NIGHT.faint };
}

function HeroCard({ children, className }: { children: ReactNode; className?: string }) {
  const { tone } = useHeroTone();
  if (tone === 'night') return <NightCard className={className}>{children}</NightCard>;
  return (
    <div className={cx('relative overflow-hidden rounded-[28px]', className)} style={{ background: '#ffffff', color: 'var(--ink)', boxShadow: '0 0 0 1px rgba(60,40,10,0.08) inset, 0 14px 34px rgba(60,40,10,0.08)' }}>
      {children}
    </div>
  );
}

function Legend() {
  const { P, muted, tone } = useHeroTone();
  const chip = tone === 'light' ? 'rgba(20,20,40,0.05)' : 'rgba(255,255,255,0.06)';
  const sw = (bg: string, extra?: CSSProperties) => <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: bg, ...extra }} />;
  const items: [ReactNode, string][] = [
    [sw(P.personality), 'Личность'],
    [sw(P.design), 'Дизайн'],
    [sw(P.transit), 'транзит'],
    [<span key="s" className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: `linear-gradient(180deg, ${CENTER_FILL.transit[0]}, ${CENTER_FILL.transit[1]})` }} />, 'центр от транзита'],
  ];
  return (
    <div className="flex flex-wrap justify-center gap-1.5 text-[12px]" style={{ color: muted }}>
      {items.map(([icon, label]) => (
        <span key={label} className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: chip }}>
          {icon}
          {label}
        </span>
      ))}
    </div>
  );
}

const GLYPH: Record<HdBody, string> = {
  sun: '\u2609', earth: '\u2295', northNode: '\u260A', southNode: '\u260B', moon: '\u263D', mercury: '\u263F', venus: '\u2640',
  mars: '\u2642', jupiter: '\u2643', saturn: '\u2644', uranus: '\u2645', neptune: '\u2646', pluto: '\u2647',
};
const COLUMN_ORDER: HdBody[] = ['sun', 'earth', 'northNode', 'southNode', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

/** Колонка планет: Дизайн (бордо, слева) или Личность (справа). */
function PlanetColumn({ marks, side, named = false }: { marks: NatalMark[]; side: 'design' | 'personality'; named?: boolean }) {
  const { P, tone } = useHeroTone();
  const color = side === 'design' ? P.design : P.personality;
  const glyphInk = side === 'design' ? '#fff' : NIGHT.pin;
  const by = new Map(marks.map((m) => [m.body, m]));
  return (
    <div className={cx('flex h-full flex-col justify-between py-1', side === 'personality' && 'items-end')}>
      {COLUMN_ORDER.map((b) => {
        const m = by.get(b);
        if (!m) return null;
        const glyph = (
          <span className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full text-[12px] leading-none" style={{ background: color, color: glyphInk }} title={HD_BODY_NAMES[b]}>
            {GLYPH[b] + '\uFE0E'}
          </span>
        );
        const val = (
          <span className="text-[11.5px] font-semibold tabular-nums" style={{ color }}>
            {named && side === 'personality' && <span className="mr-1.5 font-normal opacity-70">{HD_BODY_NAMES[b]}</span>}
            {m.gate}.{m.line}
            {named && side === 'design' && <span className="ml-1.5 font-normal opacity-70">{HD_BODY_NAMES[b]}</span>}
          </span>
        );
        return (
          <div key={b} className="flex items-center gap-1">
            {side === 'design' ? (
              <>
                {glyph}
                {val}
              </>
            ) : (
              <>
                {val}
                {glyph}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

const BODY_ORDER: HdBody[] = ['sun', 'earth', 'moon', 'northNode', 'southNode', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

/** «Солнце 34 · Земля 8 · Луна 3 …» — планета и её ворота, без переноса внутри пары. */
function planetsLine(layer: GraphLayer): string {
  const at = new Map<HdBody, number[]>();
  for (const [g, bs] of Object.entries(layer.gates)) for (const b of bs as HdBody[]) at.set(b, [...(at.get(b) ?? []), Number(g)]);
  return BODY_ORDER.filter((b) => at.has(b))
    .map((b) => `${HD_BODY_NAMES[b]}\u00a0${at.get(b)!.join(',\u00a0')}`)
    .join(' · ');
}

/** Колонки + бодиграф: как на классической карте рейв-чарта. */
function GraphWithColumns({ g, layer, col = 48 }: { g: GraphView; layer: GraphLayer; col?: number }) {
  const { settings } = useStore();
  const { tone, P } = useHeroTone();
  return (
    <>
      <div className="flex items-baseline justify-between px-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
        <span style={{ color: P.design }}>Дизайн</span>
        <span style={{ color: P.personality }}>Личность</span>
      </div>
      <div className="mt-1 grid items-stretch gap-0.5" style={{ gridTemplateColumns: `${col}px 1fr ${col}px` }}>
        <PlanetColumn marks={g.design} side="design" />
        <BodygraphSvg g={g} layer={layer} tone={tone} silhouette={settings.hdSilhouette ?? 'm'} className="block w-full" />
        <PlanetColumn marks={g.personality} side="personality" />
      </div>
    </>
  );
}

/** Большой бодиграф: силуэт, колонки Дизайна и Личности, транзит поверх. Нажатие — во весь экран. */
function HdHero({ story }: { story: HdStory }) {
  const g = story.graph;
  const { settings } = useStore();
  const { tone, faint } = useHeroTone();
  const [mode, setMode] = useState<'now' | 'day'>(g.now ? 'now' : 'day');
  const [zoom, setZoom] = useState(false);
  const layer = mode === 'now' && g.now ? g.now : g.day;
  const toggle = g.now && (
    <NightToggle light={tone === 'light'} value={mode} options={[{ value: 'now', label: 'Сейчас' }, { value: 'day', label: 'За весь день' }]} onChange={setMode} />
  );
  return (
    <HeroCard className="-mx-3 px-2 pb-5 pt-5">
      <div className="text-center">
        <Eyebrow light={tone === 'light'}>
          {story.type.name} · {story.type.profile}
        </Eyebrow>
        <div className="mt-1 font-serif text-[26px] leading-tight">Твоя карта сегодня</div>
      </div>
      {toggle && <div className="mt-3">{toggle}</div>}
      <button className="mt-3 block w-full text-left" onClick={() => setZoom(true)} aria-label="Открыть бодиграф во весь экран">
        <GraphWithColumns g={g} layer={layer} />
      </button>
      <div className="mt-1 text-center text-[11.5px]" style={{ color: faint }}>
        нажми на карту, чтобы рассмотреть крупнее
      </div>
      <div className="mt-3">
        <Legend />
      </div>
      {settings.hdSilhouette == null && (
        <div className="mx-auto mt-3 max-w-[300px]">
          <div className="mb-1.5 text-center text-[12px]" style={{ color: faint }}>
            Какой силуэт рисовать?
          </div>
          <SilhouettePick />
        </div>
      )}
      <p className="mx-auto mt-3 max-w-[340px] text-center text-[11.5px] leading-[1.6]" style={{ color: faint }}>
        Транзит: {planetsLine(layer)}
      </p>
      {zoom && <GraphZoom onClose={() => setZoom(false)} toggle={toggle} g={g} layer={layer} />}
    </HeroCard>
  );
}

/** Бодиграф во весь экран: крупно, с колонками; прокручивается, если не помещается. */
function GraphZoom({ onClose, toggle, g, layer }: { onClose: () => void; toggle: ReactNode; g: GraphView; layer: GraphLayer }) {
  const { tone, ink } = useHeroTone();
  const { settings } = useStore();
  return createPortal(
    <div
      className="fade-in fixed inset-0 z-[60] overflow-auto"
      style={tone === 'light' ? { background: '#ffffff', color: 'var(--ink)' } : { background: `linear-gradient(160deg, ${NIGHT.bgA}, ${NIGHT.bgB})`, color: NIGHT.ink }}
    >
      <div className="safe-bottom mx-auto max-w-[640px] px-2 pb-8 pt-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <div className="font-serif text-[22px]">Твоя карта</div>
          <button onClick={onClose} className="h-9 rounded-full px-4 text-[14px] font-medium" style={{ background: tone === 'light' ? 'var(--surface-2)' : 'rgba(255,255,255,0.08)', color: ink }}>
            Закрыть
          </button>
        </div>
        {toggle && <div className="mb-3">{toggle}</div>}
        <BodygraphSvg g={g} layer={layer} tone={tone} silhouette={settings.hdSilhouette ?? 'm'} className="mx-auto block w-full max-w-[520px]" />
        <div className="mx-auto mt-3 grid max-w-[420px] grid-cols-2 gap-6 px-4">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: PALETTE[tone].design }}>
              Дизайн
            </div>
            <div className="h-[330px]">
              <PlanetColumn marks={g.design} side="design" named />
            </div>
          </div>
          <div>
            <div className="mb-1 text-right text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: PALETTE[tone].personality }}>
              Личность
            </div>
            <div className="h-[330px]">
              <PlanetColumn marks={g.personality} side="personality" named />
            </div>
          </div>
        </div>
        <div className="mt-3">
          <Legend />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ───────────── Лист «Дизайн человека» ───────────── */

function Pill({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'calm' }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium"
      style={tone === 'accent' ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : { background: 'color-mix(in srgb, var(--tone-calm) 16%, transparent)', color: 'var(--tone-calm)' }}
    >
      {children}
    </span>
  );
}

function Items({ items, tone }: { items: HdItem[]; tone: 'accent' | 'calm' }) {
  return (
    <div className="space-y-2.5">
      {items.map((x) => (
        <div key={x.when + x.title} className="relative overflow-hidden rounded-2xl border border-line bg-surface-2/50 py-3 pl-4 pr-3">
          <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full" style={{ background: tone === 'accent' ? 'var(--accent)' : 'var(--tone-calm)' }} />
          <div className="flex items-start justify-between gap-2">
            <div className="text-[15px] font-semibold leading-5">{x.title}</div>
            <Pill tone={tone}>{x.when.toLowerCase()}</Pill>
          </div>
          <div className="mt-1.5 text-[14px] leading-[1.5] text-muted">{x.text}</div>
        </div>
      ))}
    </div>
  );
}

function ThemeCard({ story }: { story: HdStory }) {
  const { theme } = story;
  return (
    <div className="rounded-[24px] border border-line bg-surface px-4 py-4" style={{ boxShadow: 'var(--shadow)' }}>
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-faint">Тема дня для всех · Солнце</div>
      <div className="mt-2 flex items-center gap-4">
        <div className="font-serif text-[54px] leading-none text-accent">{theme.gate}</div>
        <div className="min-w-0">
          <div className="text-[19px] font-semibold leading-6">{theme.name}</div>
          <div className="text-[13px] text-faint">И-Цзин: «{theme.iching}»</div>
        </div>
      </div>
      <p className="mt-2.5 text-[15px] leading-6">
        {theme.gist.charAt(0).toUpperCase() + theme.gist.slice(1)}.{theme.mine ? ' Это и твои ворота, поэтому тема звучит лично для тебя.' : ''}
      </p>
      {theme.periods.length > 1 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {theme.periods.map((p) => (
            <Pill key={p.gate}>
              {p.when.toLowerCase()} · {p.gate} {p.name}
            </Pill>
          ))}
        </div>
      )}
    </div>
  );
}

function TypeCard({ story }: { story: HdStory }) {
  const t = story.type;
  return (
    <div className="rounded-[24px] px-4 py-4" style={{ background: 'var(--accent-soft)', boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent) inset' }}>
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Как прожить день · {t.name}</div>
      <p className="mt-2 text-[15px] leading-6">
        <b className="font-semibold">Стратегия:</b> {t.strategy}.
      </p>
      <p className="mt-1 text-[15px] leading-6">
        <b className="font-semibold">Решения:</b> {t.authority.split(': ').slice(1).join(': ') || t.authority}.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
        <div className="rounded-xl bg-surface/70 px-3 py-2">
          <div className="text-faint">Ты в своём</div>
          <div className="font-medium">{t.signature}</div>
        </div>
        <div className="rounded-xl bg-surface/70 px-3 py-2">
          <div className="text-faint">Сигнал «не своё»</div>
          <div className="font-medium">{t.notSelf}</div>
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-5 text-muted">Транзиты не меняют твой тип и авторитет: всё, что они приносят, проверяй стратегией и авторитетом.</p>
    </div>
  );
}

/** Полный разбор: бодиграф, тема, что включается в тебе, что приходит извне, общий фон, как прожить. */
export function HdStoryView({ story, date }: { story: HdStory; date?: DateKey }) {
  const { mine, open, shared } = story;
  return (
    <div className="space-y-5">
      <HdHero story={story} />
      {story.type.isReflector && date && <ReflectorPanel date={date} />}
      <ThemeCard story={story} />
      {mine.length > 0 && (
        <div>
          <SubTitle>Что сегодня включается в тебе</SubTitle>
          <Items items={mine} tone="accent" />
        </div>
      )}
      {open.length > 0 && (
        <div>
          <SubTitle>Что приходит извне</SubTitle>
          <p className="mb-3 text-[14px] leading-5 text-muted">
            Открытый центр — место, где ты впитываешь энергию людей и дня. Сегодня планеты делают его на время определённым. Это не твоё: можно прочувствовать и понаблюдать, но решения отсюда не принимай.
          </p>
          <Items items={open} tone="calm" />
        </div>
      )}
      {shared.length > 0 && (
        <div>
          <SubTitle>Общий фон для всех</SubTitle>
          <Items items={shared} tone="calm" />
        </div>
      )}
      {mine.length + open.length + shared.length === 0 && <p className="text-[15px] leading-6">Сегодня транзиты почти не задевают твою карту. Спокойный день, чтобы быть собой.</p>}
      <TypeCard story={story} />
      <About>{ABOUT.hd}</About>
    </div>
  );
}

/* ───────────── Вход на «Сегодня» и на экране дня ───────────── */

function sunNow(story: HdStory): number {
  const l = story.graph.now ?? story.graph.day;
  const e = Object.entries(l.gates).find(([, b]) => (b as HdBody[]).includes('sun'));
  return e ? Number(e[0]) : story.theme.gate;
}
function moonNow(story: HdStory): number | null {
  const l = story.graph.now;
  const e = l && Object.entries(l.gates).find(([, b]) => (b as HdBody[]).includes('moon'));
  return e ? Number(e[0]) : null;
}

function spotlightLines(story: HdStory): string[] {
  const layer = story.graph.now ?? story.graph.day;
  const lines: string[] = [];
  const chs = story.mine.filter((x) => x.title.startsWith('Канал'));
  if (chs.length) lines.push(`Включается: ${chs.slice(0, 2).map((x) => x.title.replace('Канал ', '')).join(', ')}`);
  if (layer.centers.length) lines.push(`${story.graph.now ? 'Сейчас извне' : 'Извне'}: ${layer.centers.map((c) => centerTitle(c).replace(' центр', '').replace(' (Эго)', '')).join(', ')}`);
  if (!lines.length) lines.push('Транзиты сегодня почти не задевают твою карту');
  return lines;
}

/** Заметная карточка «Твой дизайн сегодня» на главном экране. */
export function HdSpotlight({ date, onOpenChart }: { date: DateKey; onOpenChart?: () => void }) {
  const { settings } = useStore();
  const story = useHdStory(date);
  const [open, setOpen] = useState(false);
  if (!story) return null;
  const refl = story.type.isReflector;
  const moon = moonNow(story);
  const gate = refl && moon !== null ? moon : sunNow(story);
  return (
    <>
      <NightCard
        className="rise-in px-4 py-4"
        onClick={() => {
          haptic.tap();
          setOpen(true);
        }}
      >
        <div className="flex items-center gap-3">
          <BodygraphSvg g={story.graph} layer={story.graph.now ?? story.graph.day} mini silhouette={settings.hdSilhouette ?? 'm'} className="h-[132px] w-[88px] shrink-0" />
          <div className="min-w-0 flex-1">
            <Eyebrow>{refl ? 'Рефлектор · Луна' : 'Дизайн человека'}</Eyebrow>
            <div className="mt-1 font-serif text-[23px] leading-[1.15]">
              {refl ? 'Луна' : 'Солнце'} в воротах {gate}
              <span style={{ color: NIGHT.gold }}> · {gateInfo(gate).name}</span>
            </div>
            <div className="mt-2 space-y-1 text-[13px] leading-[1.35]" style={{ color: NIGHT.muted }}>
              {spotlightLines(story).map((l) => (
                <div key={l} className="line-clamp-2">
                  {l}
                </div>
              ))}
            </div>
            <div className="mt-2.5 text-[13px] font-medium" style={{ color: NIGHT.gold }}>
              Открыть мою карту ›
            </div>
          </div>
        </div>
      </NightCard>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <HdStoryView story={story} date={date} />
        {onOpenChart && (
          <button
            onClick={() => {
              setOpen(false);
              onOpenChart();
            }}
            className="mt-4 h-[52px] w-full rounded-full bg-accent text-[16px] font-semibold text-bg active:scale-[0.98]"
          >
            Вся карта: мандала, циклы, мои люди
          </button>
        )}
      </Sheet>
    </>
  );
}

/** Блок на экране дня (подробно). */
export function HdCard({ date }: { date: DateKey }) {
  const story = useHdStory(date);
  if (!story) return null;
  return (
    <div className="rise-in">
      <HdStoryView story={story} date={date} />
    </div>
  );
}

/* ───────────── Рефлектор ───────────── */

/** Мини-бодиграф дня для лунного календаря: что определено в эти сутки (Луна и все планеты вместе). */
function LunarMini({ base, d, sil }: { base: GraphView; d: LunarDay; sil: 'm' | 'f' }) {
  const natal = new Set(base.natalGates);
  const gates: Record<number, HdBody[]> = {};
  for (const g of d.moonGates) gates[g] = ['moon'];
  for (const c of d.channels) for (const g of c.gates) if (!natal.has(g)) gates[g] ??= ['moon'];
  const layer: GraphLayer = { gates, channels: d.channels.map((c) => c.key), centers: d.centers };
  return (
    <div
      className="flex h-[64px] w-[46px] shrink-0 items-center justify-center rounded-xl"
      style={{ background: `linear-gradient(160deg, ${NIGHT.bgA}, ${NIGHT.bgB})` }}
      aria-label={d.centers.length ? `Определены: ${d.centers.map(centerTitle).join(', ')}` : 'Центры не определены'}
    >
      <BodygraphSvg g={base} layer={layer} mini silhouette={sil} className="h-[58px] w-[39px]" />
    </div>
  );
}

const WD_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const wdShort = (k: DateKey) => {
  const [y, m, dd] = k.split('-').map(Number) as [number, number, number];
  return WD_SHORT[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]!;
};

function ReflectorPanel({ date }: { date: DateKey }) {
  const { settings, update, location } = useStore();
  const chart = useHdChart();
  const tz = location?.timeZone ?? 'UTC';
  const [all, setAll] = useState(false);
  const [title, setTitle] = useState('');
  const month = useMemo(() => (chart ? lunarMonth(chart, date, tz, 28) : []), [chart, date, tz]);
  const now = new Date();
  const moon = moonGateAt(now);
  const dec = settings.hdDecision;
  const decEnd = useMemo(() => (dec ? moonReturn(new Date(dec.start)) : null), [dec]);
  const base: GraphView = useMemo(
    () => ({
      natalGates: chart ? [...chart.gates] : [],
      personalityGates: chart ? chart.personality.map((a) => a.gate) : [],
      designGates: chart ? chart.design.map((a) => a.gate) : [],
      personality: [],
      design: [],
      natalChannels: [],
      natalCenters: [],
      day: { gates: {}, channels: [], centers: [] },
      now: null,
    }),
    [chart],
  );
  if (!chart) return null;

  const dayN = dec ? Math.floor((now.getTime() - new Date(dec.start).getTime()) / 86_400_000) + 1 : 0;
  const total = dec && decEnd ? Math.round((decEnd.getTime() - new Date(dec.start).getTime()) / 86_400_000) : 28;
  const done = decEnd ? now >= decEnd : false;

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-line bg-surface px-4 py-4" style={{ boxShadow: 'var(--shadow)' }}>
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-faint">Ты Рефлектор</div>
        <p className="mt-2 text-[15px] leading-6">{REFLECTOR.intro}</p>
        <div className="mt-3 flex items-center gap-4 rounded-2xl bg-surface-2/60 px-3 py-3">
          <div className="font-serif text-[44px] leading-none text-accent">{moon.gate}</div>
          <div className="min-w-0 text-[14px] leading-5">
            <div className="font-semibold">Луна сейчас: {gateInfo(moon.gate).name}, линия {moon.line}</div>
            <div className="text-muted">{gateInfo(moon.gate).gist}</div>
          </div>
        </div>
        <p className="mt-3 text-[14px] leading-5 text-muted">{REFLECTOR.moon}</p>
      </div>

      {/* Таймер решения */}
      <div className="rounded-[24px] px-4 py-4" style={{ background: 'var(--accent-soft)', boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent) inset' }}>
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Лунный цикл решения</div>
        {dec && decEnd ? (
          <>
            <div className="mt-2 text-[17px] font-semibold leading-6">{dec.title}</div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (dayN / total) * 100)}%`, background: 'linear-gradient(90deg, var(--accent), var(--tone-calm))' }} />
            </div>
            <div className="mt-2 flex justify-between text-[13px] text-muted">
              <span>{done ? 'Цикл завершён' : `День ${Math.max(1, dayN)} из ${total}`}</span>
              <span>
                до {humanDate(toDateKey(decEnd, tz), false)}, {formatTime(decEnd, tz)}
              </span>
            </div>
            <p className="mt-3 text-[14px] leading-5">
              {done
                ? 'Луна вернулась в те же ворота: цикл прожит. Если ясность есть — решение созрело.'
                : `Цикл завершится, когда Луна вернётся в ворота ${moonGateAt(new Date(dec.start)).gate}, где была в начале. До этого живи с вопросом и обсуждай его с близкими.`}
            </p>
            <button onClick={() => void update({ hdDecision: null })} className="mt-3 text-[14px] font-medium text-accent">
              {done ? 'Закрыть цикл' : 'Отменить цикл'}
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-[14px] leading-5">{REFLECTOR.decision}</p>
            <div className="mt-3 flex gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Что ты решаешь?"
                className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[15px] outline-none"
              />
              <button
                disabled={!title.trim()}
                onClick={() => {
                  haptic.tap();
                  void update({ hdDecision: { title: title.trim(), start: new Date().toISOString() } });
                }}
                className="h-11 shrink-0 rounded-xl px-4 text-[14px] font-semibold disabled:opacity-40"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              >
                Начать
              </button>
            </div>
          </>
        )}
      </div>

      {/* Лунный календарь */}
      <div>
        <SubTitle>Твой лунный месяц</SubTitle>
        <p className="mb-3 text-[14px] leading-5 text-muted">{REFLECTOR.calendar}</p>
        <div className="overflow-hidden rounded-[20px] border border-line bg-surface">
          {month.slice(0, all ? 28 : 7).map((d, i) => {
            const byMoon = d.channels.filter((c) => c.moon);
            return (
              <div key={d.key} className={cx('flex items-center gap-3 px-3 py-2.5', i > 0 && 'border-t border-line', d.key === date && 'bg-accent-soft')}>
                <LunarMini base={base} d={d} sil={settings.hdSilhouette ?? 'm'} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[14px] font-semibold">
                      {humanDate(d.key, false)}
                      <span className="font-normal text-faint"> · {d.key === date ? 'сегодня' : wdShort(d.key)}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-faint">{d.centers.length} из 9</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[12px]">
                    <span className="text-faint">Луна</span>
                    {d.moonGates.map((g) => (
                      <span key={g} className="rounded-md px-1.5 py-[1px] font-semibold" style={{ background: 'color-mix(in srgb, var(--tone-calm) 16%, transparent)', color: 'var(--tone-calm)' }}>
                        {g}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 text-[12.5px] leading-[1.35] text-muted">
                    {byMoon.length ? `Луна замыкает: ${byMoon.map((c) => `${c.gates[0]}–${c.gates[1]} «${channelTitle(c.key)}»`).join(', ')}` : 'Луна не замыкает твоих каналов'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-start justify-between gap-3 text-[12px] leading-4 text-faint">
          <span>Мини-карта и «7 из 9» — сколько центров определено в этот день</span>
          <button onClick={() => setAll(!all)} className="shrink-0 whitespace-nowrap text-[13px] font-medium text-accent">
            {all ? 'Свернуть' : 'Весь цикл ›'}
          </button>
        </div>
      </div>

      <p className="rounded-2xl bg-surface-2 px-4 py-3 text-[14px] leading-5 text-muted">{REFLECTOR.environment}</p>
    </div>
  );
}
