/**
 * Автоматическая копия дневника в личном облаке Telegram (D-141).
 * После каждой записи (с паузой 3 с) дневник сохраняется в CloudStorage под ключом «diary».
 * На новом телефоне, если дневник пуст, а в облаке есть копия, записи возвращаются сами.
 * Работает только внутри Telegram; настройки и профиль хранятся отдельно (state/profile.ts).
 */
import { db } from '../db';
import { migrateSettings } from '../state/settings';
import { cloudAvailable, cloudLoad, cloudSave } from '../telegram';
import type { DiaryEntry } from './types';

const KEY = 'diary';
let timer: ReturnType<typeof setTimeout> | null = null;

async function enabled(): Promise<boolean> {
  if (!cloudAvailable()) return false;
  const s = migrateSettings((await db.settings.get('main'))?.value);
  return s.autoBackup;
}

export async function backupDiaryNow(): Promise<boolean> {
  if (!(await enabled())) return false;
  const entries = await db.entries.toArray();
  await cloudSave(KEY, JSON.stringify({ v: 1, at: new Date().toISOString(), entries }));
  return true;
}

export function scheduleDiaryBackup(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void backupDiaryNow().catch(() => undefined);
  }, 3000);
}

/** Если дневник на устройстве пуст, а в облаке есть копия — вернуть записи. Возвращает число восстановленных. */
export async function restoreDiaryIfEmpty(): Promise<number> {
  if (!(await enabled())) return 0;
  if ((await db.entries.count()) > 0) return 0;
  try {
    const raw = await cloudLoad(KEY);
    if (!raw) return 0;
    const data = JSON.parse(raw) as { v: number; entries: DiaryEntry[] };
    const entries = (data.entries ?? []).filter((e) => typeof e?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.snapshot);
    if (!entries.length) return 0;
    await db.entries.bulkPut(entries);
    return entries.length;
  } catch {
    return 0;
  }
}
