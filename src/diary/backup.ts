import { db } from '../db';
import type { ContentOverride } from '../content';
import { migrateSettings, type Settings } from '../state/settings';
import type { DiaryEntry } from './types';

export interface Backup {
  app: 'energy-day';
  version: 1;
  exportedAt: string;
  settings: Settings | null;
  entries: DiaryEntry[];
  overrides: ContentOverride[];
}

export async function exportJson(): Promise<string> {
  const backup: Backup = {
    app: 'energy-day',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: (await db.settings.get('main'))?.value ?? null,
    entries: await db.entries.toArray(),
    overrides: await db.overrides.toArray(),
  };
  return JSON.stringify(backup, null, 1);
}

/** Импорт сливает данные: записи и правки с теми же ключами заменяются, остальные сохраняются. */
export async function importJson(text: string): Promise<{ entries: number; overrides: number }> {
  const b = JSON.parse(text) as Partial<Backup>;
  if (b.app !== 'energy-day') throw new Error('Это не резервная копия «Энергии дня»');
  await db.transaction('rw', db.entries, db.overrides, db.settings, async () => {
    if (b.entries?.length) await db.entries.bulkPut(b.entries);
    if (b.overrides?.length) await db.overrides.bulkPut(b.overrides);
    if (b.settings) await db.settings.put({ id: 'main', value: migrateSettings(b.settings) });
  });
  return { entries: b.entries?.length ?? 0, overrides: b.overrides?.length ?? 0 };
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function entriesToCsv(entries: DiaryEntry[]): string {
  const head = ['date', 'energy', 'mood', 'sleep', 'tags', 'note', 'lunar_day', 'phase', 'sign', 'voc', 'personal_day', 'location', 'decision', 'decision_followup', 'decision_outcome'];
  const rows = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) =>
      [e.date, e.energy, e.mood, e.sleep, e.tags.join('|'), e.note, e.snapshot.lunarDay, e.snapshot.phase, e.snapshot.sign, e.snapshot.voc ? 1 : 0, e.snapshot.personalDay, e.snapshot.locationId, e.decision?.text, e.decision?.followUpOn, e.decision?.outcome]
        .map(csvCell)
        .join(','),
    );
  return '﻿' + [head.join(','), ...rows].join('\n');
}

export async function exportCsv(): Promise<string> {
  return entriesToCsv(await db.entries.toArray());
}
