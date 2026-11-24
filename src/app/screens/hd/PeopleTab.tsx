/** «Мои люди» (D-148): карты близких на этом телефоне, поиск по профилю, каналу, воротам, типу, тегу и заметке. */
import { useMemo, useState } from 'react';
import { bodygraph, type Bodygraph } from '../../../humandesign/chart';
import type { HdPerson } from '../../../state/settings';
import { haptic } from '../../../telegram';
import { useStore } from '../../store';
import { cx, Sheet } from '../../ui';
import type { Nav } from '../../App';
import { BirthForm, birthResult, birthValueOf, field, type BirthValue } from '../Profile';
import { AUTH_NAME, ChartGraph, Header, I, sideMarks, typeName, useTone } from './common';
import { ChartTab } from './ChartTab';

export const PEOPLE_TAGS = ['семья', 'работа', 'друзья'] as const;

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

export function chartOf(p: HdPerson): Bodygraph | null {
  try {
    return bodygraph(p.birth);
  } catch {
    return null;
  }
}

/** Поиск: части через запятую, все должны совпасть. «5/1» — профиль, «25-51» — канал, «34» — ворота, иначе — текст. */
export function matchPerson(p: HdPerson, g: Bodygraph | null, q: string): boolean {
  const parts = norm(q)
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.every((part) => {
    const prof = /(\d)\s*\/\s*(\d)/.exec(part);
    if (prof) return !!g && g.profile[0] === +prof[1]! && g.profile[1] === +prof[2]!;
    const ch = /(\d{1,2})\s*[-–—]\s*(\d{1,2})/.exec(part);
    if (ch) {
      const a = +ch[1]!;
      const b = +ch[2]!;
      return !!g && g.channels.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    }
    const gate = /^(?:ворота\s*)?(\d{1,2})$/.exec(part);
    if (gate) return !!g && g.gates.has(+gate[1]!);
    const words = part.replace(/^(профиль|канал|тип|авторитет)\s*/, '');
    const hay = norm([p.name, p.note, ...p.tags, g ? typeName(g.type) : '', g ? AUTH_NAME[g.authority] : ''].join(' '));
    return hay.includes(words);
  });
}

function Sky() {
  const st: [number, number, number][] = [[40, 120, 2.2], [78, 70, 3], [126, 96, 2.4], [170, 44, 3.4], [214, 82, 2.4], [232, 140, 2.8], [150, 150, 2], [98, 160, 1.8], [20, 60, 1.4], [250, 30, 1.6], [196, 176, 1.6], [60, 30, 1.4]];
  const ln = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 5]];
  return (
    <svg viewBox="0 0 260 190" fill="none" className="mx-auto mb-1.5 block h-[190px] w-[260px]" aria-hidden>
      <circle cx={130} cy={95} r={88} fill="var(--accent)" opacity={0.05} />
      {ln.map(([a, b], i) => (
        <line key={i} x1={st[a!]![0]} y1={st[a!]![1]} x2={st[b!]![0]} y2={st[b!]![1]} stroke="var(--accent)" strokeWidth={1} opacity={0.45} strokeDasharray="2 4" />
      ))}
      {st.map(([x, y, r], i) => (
        <circle key={i} className="hd-twinkle" style={{ animationDelay: `${(i * 0.37).toFixed(2)}s`, animationDuration: '3.6s' }} cx={x} cy={y} r={r} fill={i < 7 ? 'var(--accent)' : 'var(--faint)'} />
      ))}
      <circle cx={170} cy={44} r={9} fill="var(--accent)" opacity={0.18} />
    </svg>
  );
}

const Plus = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
    <path d={I.plus} />
  </svg>
);

export function Privacy() {
  return (
    <div className="mt-5 flex items-center justify-center gap-2 text-[12px] text-faint">
      <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
        <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      </svg>
      Данные людей хранятся только на этом телефоне
    </div>
  );
}

/** Шторка «Добавить человека» / «Изменить». */
export function PersonSheet({ open, onClose, person }: { open: boolean; onClose: () => void; person?: HdPerson }) {
  const { settings, update } = useStore();
  const [name, setName] = useState(person?.name ?? '');
  const [note, setNote] = useState(person?.note ?? '');
  const [tags, setTags] = useState<string[]>(person?.tags ?? []);
  const [birth, setBirth] = useState<BirthValue>(birthValueOf(null, person?.birth ?? null));
  const [err, setErr] = useState('');
  const r = birthResult(birth);
  const save = () => {
    if (!name.trim()) return setErr('Впиши имя');
    if (!r.birthday) return setErr('Укажи дату рождения');
    if (!r.humanDesign) return setErr('Для карты нужны время и город рождения. Если время неизвестно, поставь 12:00 — карта будет примерной.');
    haptic.tap('medium');
    const p: HdPerson = { id: person?.id ?? `p${Date.now().toString(36)}`, name: name.trim(), note: note.trim(), tags, birth: r.humanDesign };
    void update({ people: person ? settings.people.map((x) => (x.id === p.id ? p : x)) : [p, ...settings.people] });
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="font-serif text-[26px] font-medium">{person ? 'Изменить' : 'Добавить человека'}</div>
      <p className="mb-4 mt-1 text-[14px] text-muted">Карта рассчитается по дате, времени и месту рождения.</p>
      <div className="space-y-3">
        <input className={field} value={name} onChange={(e) => (setErr(''), setName(e.target.value))} placeholder="Имя, например Анна" aria-label="Имя" autoComplete="off" />
        <BirthForm value={birth} onChange={(v) => (setErr(''), setBirth(v))} />
        <input className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Заметка — что важно помнить" aria-label="Заметка" autoComplete="off" />
        <div className="flex flex-wrap gap-2">
          {PEOPLE_TAGS.map((t) => {
            const on = tags.includes(t);
            return (
              <button key={t} onClick={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])} className={cx('h-[34px] rounded-full px-3.5 text-[14px]', on ? 'bg-accent text-bg' : 'bg-surface-2 text-muted')}>
                {t}
              </button>
            );
          })}
        </div>
        {err && <div className="text-[14px] leading-5 text-care">{err}</div>}
        <button onClick={save} className="h-[52px] w-full rounded-full bg-accent text-[16px] font-semibold text-bg active:scale-[0.98]">
          Сохранить
        </button>
      </div>
    </Sheet>
  );
}

export function PeopleTab({ nav }: { nav: Nav }) {
  const { settings } = useStore();
  const tone = useTone();
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string>('all');
  const [adding, setAdding] = useState(false);
  const list = useMemo(() => settings.people.map((p) => ({ p, g: chartOf(p) })), [settings.people]);
  const res = list.filter(({ p, g }) => (tag === 'all' || p.tags.includes(tag)) && matchPerson(p, g, q));

  return (
    <div>
      {!list.length ? (
        <div className="rounded-[24px] border border-line bg-surface px-3 pb-5 pt-2 text-center shadow-[var(--shadow)]">
          <Sky />
          <h2 className="font-serif text-[26px] font-medium">Здесь будут твои люди</h2>
          <p className="mx-auto mb-5 mt-2 max-w-[340px] text-[15px] leading-6 text-muted">Добавь близких, коллег и друзей — их карты всегда будут под рукой, а совместимость — в одно касание.</p>
          <button onClick={() => setAdding(true)} className="inline-flex h-[52px] items-center gap-2 rounded-full bg-accent px-6 text-[16px] font-semibold text-bg active:scale-95">
            <Plus />
            Добавить человека
          </button>
        </div>
      ) : (
        <>
          <label className="mb-3 flex h-12 items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5">
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" className="shrink-0 text-faint">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l4.5 4.5" />
            </svg>
            <input type="search" inputMode="search" enterKeyHint="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти человека" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" />
            {q && (
              <button onClick={() => setQ('')} aria-label="Очистить" className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-surface-2 text-[12px] text-muted">
                ✕
              </button>
            )}
          </label>
          <div className="-mt-1 mb-3 px-1 text-[13px] text-faint">
            например:{' '}
            {['профиль 5/1', 'канал 43-23', 'генератор'].map((x, i) => (
              <span key={x}>
                {i > 0 && ', '}
                <button onClick={() => setQ(x)} className="text-accent underline decoration-accent/35 underline-offset-[3px]">
                  {x}
                </button>
              </span>
            ))}
          </div>
          <div className="mb-3 flex gap-2 overflow-x-auto [scrollbar-width:none]">
            {['all', ...PEOPLE_TAGS].map((t) => (
              <button key={t} onClick={() => setTag(t)} className={cx('h-9 shrink-0 rounded-full px-4 text-[14px]', t === tag ? 'bg-accent font-semibold text-bg' : 'border border-line bg-surface text-ink')}>
                {t === 'all' ? 'Все' : t}
              </button>
            ))}
          </div>
          {(q || tag !== 'all') && <p className="mx-1 mb-2.5 text-[13px] text-faint">Нашлось: {res.length}</p>}
          {res.length ? (
            <div className="space-y-2.5">
              {res.map(({ p, g }) => (
                <button key={p.id} onClick={() => nav.push({ name: 'person', id: p.id })} className="flex w-full items-center gap-3.5 rounded-[24px] border border-line bg-surface p-3.5 text-left shadow-[var(--shadow)] active:scale-[0.99]">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2">
                    {g && <ChartGraph chart={g} marks={sideMarks(g, tone)} hideNumbers className="block w-[46px]" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-medium">{p.name}</span>
                    <span className="block text-[14px] text-accent">{g ? `${typeName(g.type)} · ${g.profile.join('/')}` : 'Не удалось рассчитать карту'}</span>
                    <span className="mt-0.5 block truncate text-[13px] text-faint">{p.note || 'Без заметки'}</span>
                    {p.tags.length > 0 && (
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {p.tags.map((t) => (
                          <span key={t} className="inline-flex h-[22px] items-center rounded-full bg-surface-2 px-2.5 text-[12px] text-muted">
                            {t}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="text-faint">›</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-line bg-surface p-4 text-center">
              <h2 className="font-serif text-[24px] font-medium">Никого не нашлось</h2>
              <p className="mt-1.5 text-[14px] text-muted">Попробуй: «профиль 2/4», «канал 25-51», «проектор»</p>
            </div>
          )}
          <button onClick={() => setAdding(true)} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line text-[15px] active:scale-[0.98]">
            <Plus />
            Добавить человека
          </button>
        </>
      )}
      <Privacy />
      {adding && <PersonSheet open onClose={() => setAdding(false)} />}
    </div>
  );
}

/** Карта одного человека из «Моих людей». */
export function PersonScreen({ id, nav }: { id: string; nav: Nav }) {
  const { settings, update } = useStore();
  const p = settings.people.find((x) => x.id === id);
  const g = useMemo(() => (p ? chartOf(p) : null), [p]);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  if (!p) {
    return (
      <div className="pb-8">
        <Header title="Человек удалён" />
      </div>
    );
  }
  const dd = `${p.birth.day}.${String(p.birth.month).padStart(2, '0')}.${p.birth.year}, ${String(p.birth.hour).padStart(2, '0')}:${String(p.birth.minute).padStart(2, '0')}${p.birth.place ? ` · ${p.birth.place}` : ''}`;
  return (
    <div className="space-y-4 pb-8">
      <Header
        title={p.name}
        sub={dd}
        right={
          <button onClick={() => setEditing(true)} className="text-[15px] text-accent">
            Изменить
          </button>
        }
      />
      {p.note && <p className="px-1 text-[15px] italic text-muted">{p.note}</p>}
      <button
        onClick={() => {
          void update({ pair: { name: p.name, birth: p.birth } });
          nav.push({ name: 'pair' });
        }}
        className="h-[52px] w-full rounded-full bg-accent text-[16px] font-semibold text-bg active:scale-[0.98]"
      >
        Совместимость со мной
      </button>
      {g ? <ChartTab chart={g} nav={nav} self={false} /> : <p className="text-muted">Не удалось рассчитать карту. Проверь дату и место.</p>}
      <div className="pt-2 text-center">
        {confirmDel ? (
          <div className="space-y-2">
            <p className="text-[14px] text-muted">Удалить {p.name} из списка? Это нельзя отменить.</p>
            <div className="flex justify-center gap-2">
              <button onClick={() => setConfirmDel(false)} className="h-10 rounded-full border border-line px-5 text-[15px]">
                Оставить
              </button>
              <button
                onClick={() => {
                  void update({ people: settings.people.filter((x) => x.id !== p.id) });
                  nav.pop();
                }}
                className="h-10 rounded-full bg-bad-soft px-5 text-[15px] text-bad"
              >
                Удалить
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)} className="text-[14px] text-faint">
            Удалить из моих людей
          </button>
        )}
      </div>
      <Privacy />
      {editing && <PersonSheet open person={p} onClose={() => setEditing(false)} />}
    </div>
  );
}
