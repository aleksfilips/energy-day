import { useMemo, useState } from 'react';
import { COLLECTIONS, entryId, type CollectionName } from '../../content';
import { SCHOOL_NAMES } from '../../content/schema';
import { db } from '../../db';
import { downloadText, haptic } from '../../telegram';
import { useStore } from '../store';
import { Button, Card, cx, Label, Segmented } from '../ui';
import type { Nav } from '../App';

const COLLECTION_NAMES: Record<CollectionName, string> = {
  'lunar-days': 'Лунные сутки',
  phases: 'Фазы',
  signs: 'Знаки',
  special: 'Особые периоды',
  tithis: 'Титхи',
  nakshatras: 'Накшатры',
  'personal-numbers': 'Личные числа',
  garden: 'Сад',
};

type AnyEntry = Record<string, unknown> & { needsReview: boolean; school: keyof typeof SCHOOL_NAMES; confidence: string };

function titleOf(c: CollectionName, e: AnyEntry): string {
  switch (c) {
    case 'lunar-days':
      return `${e.day}-е сутки · ${(e.symbols as string[])[0]}`;
    case 'phases':
      return String(e.name);
    case 'signs':
      return String(e.name);
    case 'special':
      return String(e.title);
    case 'tithis':
      return `${e.number}. ${e.name}`;
    case 'nakshatras':
      return `${e.number}. ${e.name}`;
    case 'personal-numbers':
      return `Число ${e.number} · ${(e.color as { name: string }).name}`;
    case 'garden':
      return String(e.title);
  }
}

/** Редактируемые текстовые поля: строки и списки строк (по одному пункту в строке). */
const EDITABLE = ['essence', 'note', 'theme', 'coloring', 'short', 'practice', 'reflection', 'affirmation', 'favorable', 'mindful', 'themes', 'symbols', 'body'] as const;
const FIELD_NAMES: Record<string, string> = {
  essence: 'Суть',
  note: 'Фраза для карточки',
  theme: 'Тема',
  coloring: 'Окраска (родительный падеж)',
  short: 'Коротко для карточки',
  practice: 'Практика',
  reflection: 'Вопрос для дневника',
  affirmation: 'Аффирмация',
  favorable: 'Время для (по пункту в строке)',
  mindful: 'Чему уделить внимание (по пункту в строке)',
  themes: 'Темы (по пункту в строке)',
  symbols: 'Символы (основной первым)',
  body: 'Зона тела по традиции',
};

export function ReviewScreen({ nav }: { nav: Nav }) {
  const { content, overrides } = useStore();
  const [filter, setFilter] = useState<'review' | 'all'>('review');
  const [open, setOpen] = useState<{ c: CollectionName; id: string } | null>(null);

  const groups = useMemo(
    () =>
      (Object.keys(COLLECTIONS) as CollectionName[]).map((c) => ({
        c,
        items: (content.all[c] as unknown as AnyEntry[]).filter((e) => filter === 'all' || e.needsReview),
      })),
    [content, filter],
  );
  const total = groups.reduce((s, g) => s + g.items.length, 0);

  if (open) {
    const e = (content.all[open.c] as unknown as AnyEntry[]).find((x) => entryId(open.c, x as never) === open.id)!;
    return <Editor collection={open.c} entry={e} hasOverride={overrides.some((o) => o.key === `${open.c}:${open.id}`)} onClose={() => setOpen(null)} />;
  }

  return (
    <div className="space-y-4 pb-10">
      <header className="pt-2">
        <div className="font-display text-[26px] font-semibold">Ревизия контента</div>
        <div className="text-[14px] text-muted">правки хранятся поверх базы и попадают в экспорт</div>
      </header>
      <Segmented value={filter} onChange={setFilter} options={[{ value: 'review', label: 'Ждут проверки' }, { value: 'all', label: 'Все записи' }]} />
      <div className="px-1 text-[13px] text-faint">
        {total} {filter === 'review' ? 'ждут проверки' : 'записей'} · правок: {overrides.length}
      </div>
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <Card key={g.c} className="!py-1">
            <Label className="pb-1 pt-4">{COLLECTION_NAMES[g.c]}</Label>
            {g.items.map((e) => {
              const id = entryId(g.c, e as never);
              const edited = overrides.some((o) => o.key === `${g.c}:${id}`);
              return (
                <button key={id} className="flex w-full items-center justify-between border-t border-line py-3 text-left first:border-t-0" onClick={() => setOpen({ c: g.c, id })}>
                  <span>
                    <span className="block text-[15px]">{titleOf(g.c, e)}</span>
                    <span className="block text-[12px] text-faint">
                      {SCHOOL_NAMES[e.school]} · уверенность {e.confidence}
                      {edited && ' · твоя правка'}
                    </span>
                  </span>
                  <span className={cx('h-2 w-2 rounded-full', e.needsReview ? 'bg-accent' : 'bg-surface-2')} />
                </button>
              );
            })}
          </Card>
        ))}
      <Button variant="ghost" className="w-full" onClick={() => downloadText(`energy-day-overrides-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(overrides, null, 1))}>
        Экспорт правок в JSON
      </Button>
    </div>
  );
}

function Editor({ collection, entry, hasOverride, onClose }: { collection: CollectionName; entry: AnyEntry; hasOverride: boolean; onClose: () => void }) {
  const id = entryId(collection, entry as never);
  const fields = EDITABLE.filter((f) => f in entry);
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f, Array.isArray(entry[f]) ? (entry[f] as string[]).join('\n') : ((entry[f] as string | null) ?? '')])),
  );
  const [hex, setHex] = useState(collection === 'personal-numbers' ? (entry.color as { hex: string }).hex : '');
  const [colorName, setColorName] = useState(collection === 'personal-numbers' ? (entry.color as { name: string }).name : '');

  const save = async (clearFlag: boolean) => {
    const patch: Record<string, unknown> = {};
    for (const f of fields) {
      const orig = entry[f];
      const v = vals[f]!;
      patch[f] = Array.isArray(orig) ? v.split('\n').map((s) => s.trim()).filter(Boolean) : f === 'body' && !v.trim() ? null : v.trim();
    }
    if (collection === 'personal-numbers') patch.color = { name: colorName.trim(), hex };
    if (clearFlag) patch.needsReview = false;
    const parsed = COLLECTIONS[collection].schema.safeParse({ ...entry, ...patch });
    if (!parsed.success) return alertInline(parsed.error.issues[0]?.message ?? 'Ошибка');
    await db.overrides.put({ key: `${collection}:${id}`, collection, id, patch, updatedAt: Date.now() });
    haptic.success();
    onClose();
  };
  const [err, setErr] = useState<string | null>(null);
  const alertInline = (m: string) => setErr(`Не сохранено: ${m}. Поля не должны быть пустыми.`);

  return (
    <div className="space-y-4 pb-10">
      <header className="flex items-center justify-between pt-2">
        <button className="text-[15px] text-accent" onClick={onClose}>
          ‹ Назад
        </button>
        <div className="text-[13px] text-faint">{SCHOOL_NAMES[entry.school]}</div>
      </header>
      <div className="font-display text-[24px] font-semibold">{titleOf(collection, entry)}</div>
      {fields.map((f) => (
        <div key={f}>
          <Label className="mb-1.5">{FIELD_NAMES[f]}</Label>
          <textarea
            value={vals[f]}
            onChange={(e) => setVals({ ...vals, [f]: e.target.value })}
            rows={Math.min(6, Math.max(2, vals[f]!.split('\n').length + 1))}
            className="w-full resize-none rounded-xl bg-surface p-4 text-[15px] leading-6 outline-none"
          />
        </div>
      ))}
      {collection === 'personal-numbers' && (
        <div className="flex items-center gap-3">
          <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="h-12 w-14 rounded-xl bg-surface" />
          <input value={colorName} onChange={(e) => setColorName(e.target.value)} className="h-12 flex-1 rounded-xl bg-surface px-4 text-[15px] outline-none" />
        </div>
      )}
      {err && <div className="text-[14px] text-accent">{err}</div>}
      <Button className="w-full" onClick={() => save(true)}>
        Сохранить и отметить проверенным
      </Button>
      <Button variant="ghost" className="w-full" onClick={() => save(false)}>
        Сохранить без отметки
      </Button>
      {hasOverride && (
        <button
          className="mx-auto block text-[14px] text-faint"
          onClick={async () => {
            await db.overrides.delete(`${collection}:${id}`);
            onClose();
          }}
        >
          Вернуть исходный текст
        </button>
      )}
    </div>
  );
}
