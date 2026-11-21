import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import * as A from '../../astro';
import { addDays, type DateKey } from '../../astro/time';
import { db } from '../../db';
import { LAYER_NAMES, MIN_ENTRIES, MIN_PER_CATEGORY, patterns, type Metric } from '../../diary/patterns';
import { EVENT_TAGS, type DiaryEntry } from '../../diary/types';
import { computeDay } from '../../synthesis/day';
import { haptic } from '../../telegram';
import { humanDate } from '../format';
import { useDay, useToday } from '../hooks';
import { useStore } from '../store';
import { Button, Card, cx, Label, Rating, Segmented } from '../ui';
import type { Nav } from '../App';

export function EntryScreen({ date, nav }: { date: DateKey; nav: Nav }) {
  const { location, dayOptions, settings, content } = useStore();
  const existing = useLiveQuery(() => db.entries.get(date), [date]);
  const data = useDay(date);
  const [draft, setDraft] = useState<Partial<DiaryEntry> | null>(null);
  const e: Partial<DiaryEntry> = draft ?? existing ?? { energy: null, mood: null, sleep: null, note: '', tags: [], decision: null };
  const set = (p: Partial<DiaryEntry>) => setDraft({ ...e, ...p });
  const [weeks, setWeeks] = useState<'1' | '2' | '3' | '4'>('2');
  if (!location || !data) return null;
  const reflection = content.lunarDay(data.model.dominant.number).reflection;

  const save = async () => {
    const m = data.model.dominant ? data.model : computeDay(location, date, dayOptions);
    const entry: DiaryEntry = {
      date,
      energy: e.energy ?? null,
      mood: e.mood ?? null,
      sleep: e.sleep ?? null,
      note: e.note ?? '',
      tags: e.tags ?? [],
      decision: e.decision ? { ...e.decision, followUpOn: e.decision.followUpOn || addDays(date, Number(weeks) * 7) } : null,
      snapshot: {
        lunarDay: m.dominant.number,
        phase: m.phase.phase,
        sign: m.dominantSign,
        voc: m.vocDaylightShare > 0,
        personalDay: m.personal?.day ?? null,
        locationId: settings.activeLocationId,
      },
      updatedAt: Date.now(),
    };
    await db.entries.put(entry);
    haptic.success();
    nav.pop();
  };

  return (
    <div className="space-y-4 pb-8">
      <header className="pt-2">
        <div className="font-display text-[26px] font-semibold">{humanDate(date, false)}</div>
        <div className="text-[14px] text-muted">
          {data.model.dominant.number}-й лунный день · {A.PHASE_NAMES[data.model.phase.phase]} · Луна {A.inSign(data.model.dominantSign)}
        </div>
      </header>
      <Card className="space-y-6">
        <Rating label="Энергия" value={e.energy ?? null} onChange={(v) => set({ energy: v })} />
        <Rating label="Настроение" value={e.mood ?? null} onChange={(v) => set({ mood: v })} />
        <Rating label="Сон" value={e.sleep ?? null} onChange={(v) => set({ sleep: v })} />
      </Card>
      <Card>
        <Label className="mb-3">События</Label>
        <div className="flex flex-wrap gap-2">
          {EVENT_TAGS.map((t) => {
            const on = e.tags?.includes(t);
            return (
              <button
                key={t}
                onClick={() => {
                  haptic.select();
                  const tags = on ? e.tags!.filter((x) => x !== t) : [...(e.tags ?? []), t];
                  set({ tags, decision: t === 'важное решение' && !on && !e.decision ? { text: '', followUpOn: '', outcome: null } : e.decision });
                }}
                className={cx('rounded-full px-3.5 py-1.5 text-[14px] transition', on ? 'bg-accent text-bg' : 'bg-surface-2 text-ink')}
              >
                {t}
              </button>
            );
          })}
        </div>
        {e.decision && (
          <div className="mt-5 space-y-3">
            <Label>Решение принято</Label>
            <input
              value={e.decision.text}
              onChange={(ev) => set({ decision: { ...e.decision!, text: ev.target.value } })}
              placeholder="Какое решение?"
              className="h-12 w-full rounded-xl bg-surface-2 px-4 text-[15px] outline-none placeholder:text-faint"
            />
            {!existing?.decision && (
              <>
                <div className="text-[13px] text-muted">Через сколько недель спросить, как оно сработало?</div>
                <Segmented value={weeks} onChange={setWeeks} options={['1', '2', '3', '4'].map((w) => ({ value: w as '1', label: `${w} нед` }))} />
              </>
            )}
          </div>
        )}
      </Card>
      <Card>
        <Label className="mb-2">Заметка</Label>
        <div className="mb-3 text-[14px] italic text-silver">{reflection}</div>
        <textarea
          value={e.note ?? ''}
          onChange={(ev) => set({ note: ev.target.value })}
          rows={4}
          placeholder="Пара строк о дне…"
          className="w-full resize-none rounded-xl bg-surface-2 p-4 text-[15px] leading-6 outline-none placeholder:text-faint"
        />
      </Card>
      <Button className="w-full" onClick={save}>
        Сохранить
      </Button>
      {existing && (
        <button
          className="mx-auto block text-[14px] text-faint"
          onClick={async () => {
            await db.entries.delete(date);
            nav.pop();
          }}
        >
          Удалить запись
        </button>
      )}
    </div>
  );
}

function FollowUps() {
  const today = useToday();
  const due = useLiveQuery(() => db.entries.filter((e) => !!e.decision && e.decision.outcome === null && !!e.decision.followUpOn && e.decision.followUpOn <= today).toArray(), [today], []);
  if (!due.length) return null;
  return (
    <Card className="space-y-4">
      <Label>Как сработало решение?</Label>
      {due.map((e) => (
        <div key={e.date}>
          <div className="text-[15px]">{e.decision!.text || 'Решение без описания'}</div>
          <div className="text-[13px] text-muted">
            {humanDate(e.date, false)} · {e.snapshot.lunarDay}-й лунный день{e.snapshot.voc ? ' · Луна без курса' : ''}
          </div>
          <div className="mt-2 flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={async () => {
                  haptic.success();
                  await db.entries.update(e.date, { decision: { ...e.decision!, outcome: n } });
                }}
                className="h-10 flex-1 rounded-xl bg-surface-2 text-[15px] active:bg-accent active:text-bg"
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-faint">
            <span>не сработало</span>
            <span>отлично</span>
          </div>
        </div>
      ))}
    </Card>
  );
}

export function DiaryScreen({ nav }: { nav: Nav }) {
  const [tab, setTab] = useState<'entries' | 'patterns'>('entries');
  const today = useToday();
  const entries = useLiveQuery(() => db.entries.orderBy('date').reverse().toArray(), [], [] as DiaryEntry[]);
  const hasToday = entries.some((e) => e.date === today);

  return (
    <div className="space-y-4 pb-6">
      <header className="pt-2">
        <div className="font-display text-[28px] font-semibold">Дневник</div>
        <div className="text-[14px] text-muted">проверка на собственном опыте</div>
      </header>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'entries', label: 'Записи' },
          { value: 'patterns', label: 'Мои закономерности' },
        ]}
      />
      {tab === 'entries' ? (
        <>
          <FollowUps />
          {!hasToday && (
            <Button className="w-full" onClick={() => nav.push({ name: 'entry', date: today })}>
              Записать сегодня
            </Button>
          )}
          {entries.length === 0 && (
            <Card className="text-[15px] leading-6 text-muted">
              Три касания в день: энергия, настроение, сон. Через {MIN_ENTRIES} записей здесь появятся твои закономерности: какие лунные сутки, фазы и знаки на самом деле совпадают с твоими днями.
            </Card>
          )}
          <div className="space-y-2">
            {entries.map((e) => (
              <Card key={e.date} className="!p-4" onClick={() => nav.push({ name: 'entry', date: e.date })}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[15px]">{humanDate(e.date)}</div>
                    <div className="text-[13px] text-muted">
                      {e.snapshot.lunarDay}-й лунный день · {A.PHASE_NAMES[e.snapshot.phase as A.PhaseKey]} · {A.SIGN_NAMES[e.snapshot.sign as A.Sign]}
                    </div>
                  </div>
                  <div className="flex gap-3 text-right font-display tabular-nums">
                    {(['energy', 'mood', 'sleep'] as const).map((k) => (
                      <div key={k}>
                        <div className="text-[18px] font-light">{e[k] ?? '—'}</div>
                        <div className="text-[10px] uppercase tracking-wider text-faint">{k === 'energy' ? 'энерг' : k === 'mood' ? 'настр' : 'сон'}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {e.note && <div className="mt-2 line-clamp-2 text-[14px] text-muted">{e.note}</div>}
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Patterns entries={entries} />
      )}
    </div>
  );
}

const CAT_NAME = (layer: string, c: string) => {
  if (layer === 'phase') return A.PHASE_NAMES[c as A.PhaseKey] ?? c;
  if (layer === 'sign') return A.SIGN_NAMES[c as A.Sign] ?? c;
  if (layer === 'lunarDay') return `${c}-е`;
  if (layer === 'personalDay') return `число ${c}`;
  if (layer === 'voc') return c === 'да' ? 'был период без курса' : 'без периода';
  return c;
};

function Patterns({ entries }: { entries: DiaryEntry[] }) {
  const [metric, setMetric] = useState<Metric>('overall');
  const r = useMemo(() => patterns(entries, metric), [entries, metric]);
  return (
    <div className="space-y-4">
      <Segmented
        value={metric}
        onChange={setMetric}
        options={[
          { value: 'overall', label: 'Общая' },
          { value: 'energy', label: 'Энергия' },
          { value: 'mood', label: 'Настр.' },
          { value: 'sleep', label: 'Сон' },
        ]}
      />
      {!r.enough && (
        <Card className="text-[15px] leading-6">
          <div className="font-display text-[34px] font-extralight">
            {r.total}
            <span className="text-[17px] text-muted"> / {MIN_ENTRIES}</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-surface-2">
            <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.min(100, (r.total / MIN_ENTRIES) * 100)}%` }} />
          </div>
          <p className="mt-3 text-muted">Выводы появятся после {MIN_ENTRIES} записей. Ниже уже видны средние, но данных мало, вывод ненадёжен.</p>
        </Card>
      )}
      {r.enough && (
        <Card>
          <Label>Что сильнее всего влияет на твоё самочувствие</Label>
          {r.best ? (
            <p className="mt-2 font-display text-[20px] leading-snug">
              {LAYER_NAMES[r.best.layer]}: объясняет {Math.round(r.best.omega2! * 100)}% разброса оценок.
            </p>
          ) : (
            <p className="mt-2 text-[16px]">Пока явной связи нет: твоё самочувствие не зависит заметно ни от одного лунного признака. Продолжай записывать.</p>
          )}
          <div className="mt-4 space-y-2">
            {[...r.layers]
              .sort((a, b) => (b.omega2 ?? -1) - (a.omega2 ?? -1))
              .map((l) => (
                <div key={l.layer}>
                  <div className="flex justify-between text-[13px]">
                    <span>{LAYER_NAMES[l.layer]}</span>
                    <span className="tabular-nums text-muted">{l.omega2 === null ? 'мало данных' : `${Math.round(l.omega2 * 100)}%`}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                    <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.round((l.omega2 ?? 0) * 100)}%` }} />
                  </div>
                </div>
              ))}
          </div>
          <p className="mt-4 text-[12px] leading-5 text-faint">
            Мера — ω² (омега-квадрат): доля разброса твоих оценок, которую объясняет слой, с поправкой на число категорий. Около 0% — совпадений нет, выше 6% — заметная связь, выше 14% — сильная. Связь не означает причину.
          </p>
        </Card>
      )}
      {r.layers.map((l) => (
        <Card key={l.layer}>
          <div className="flex items-baseline justify-between">
            <Label>{LAYER_NAMES[l.layer]}</Label>
            <span className="text-[12px] text-faint">n = {l.n}</span>
          </div>
          <div className="mt-3 space-y-1.5">
            {l.categories.length === 0 && <div className="text-[14px] text-faint">нет данных</div>}
            {l.categories.map((c) => (
              <div key={c.category} className={cx('flex items-center gap-3 text-[14px]', !c.reliable && 'opacity-50')}>
                <span className="w-36 shrink-0 truncate">{CAT_NAME(l.layer, c.category)}</span>
                <span className="relative h-1.5 flex-1 rounded-full bg-surface-2">
                  <span className="absolute h-1.5 rounded-full bg-silver" style={{ width: `${(c.mean / (metric === 'overall' ? 10 : 10)) * 100}%` }} />
                </span>
                <span className="w-16 shrink-0 text-right tabular-nums text-muted">
                  {c.mean.toFixed(1)} <span className="text-faint">·{c.n}</span>
                </span>
              </div>
            ))}
          </div>
          {l.categories.some((c) => !c.reliable) && <p className="mt-3 text-[12px] text-faint">Бледным — меньше {MIN_PER_CATEGORY} наблюдений: данных мало, вывод ненадёжен.</p>}
        </Card>
      ))}
      {r.decisions.n > 0 && (
        <Card>
          <Label>Решения и Луна без курса</Label>
          <div className="mt-3 space-y-1 text-[14px]">
            {r.decisions.byVoc.map((d) => (
              <div key={String(d.voc)} className="flex justify-between">
                <span>{d.voc ? 'в дни Луны без курса' : 'в обычные дни'}</span>
                <span className="tabular-nums text-muted">{d.n ? `${d.mean.toFixed(1)} из 5 · ${d.n}` : 'нет данных'}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
