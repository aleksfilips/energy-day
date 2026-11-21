import Dexie, { type Table } from 'dexie';
import type { ContentOverride } from './content';
import type { DiaryEntry } from './diary/types';
import type { Settings } from './state/settings';

interface SettingsRow {
  id: 'main';
  value: Settings;
}

class EnergyDb extends Dexie {
  settings!: Table<SettingsRow, string>;
  entries!: Table<DiaryEntry, string>;
  overrides!: Table<ContentOverride, string>;

  constructor() {
    super('energy-day');
    this.version(1).stores({
      settings: 'id',
      entries: 'date, updatedAt',
      overrides: 'key, collection',
    });
  }
}

export const db = new EnergyDb();
