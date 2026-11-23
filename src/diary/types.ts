export const EVENT_TAGS = ['важное решение', 'конфликт', 'прорыв', 'усталость', 'радость', 'встреча', 'дорога', 'болел'] as const;

export interface DecisionRecord {
  text: string;
  /** Когда спросить «как оно сработало?» (ISO-дата). */
  followUpOn: string;
  /** Оценка 1..5, когда ответил. */
  outcome: number | null;
  outcomeNote?: string;
}

/** Снимок слоёв на день записи: так закономерности не зависят от будущих правок алгоритма. */
export interface DaySnapshot {
  lunarDay: number;
  phase: string;
  sign: string;
  voc: boolean;
  personalDay: number | null;
  locationId: string;
  /**
   * Дизайн человека (D-140): какие из своих открытых центров в этот день определял транзит
   * (хотя бы часть дня). undefined — запись сделана без данных рождения или до этой версии.
   */
  hdOpen?: string[];
  /** Все свои открытые центры на момент записи (чтобы «открыт» отличать от «нет данных»). */
  hdOwnOpen?: string[];
}

export interface DiaryEntry {
  date: string; // YYYY-MM-DD, первичный ключ
  energy: number | null; // 1..10
  mood: number | null;
  sleep: number | null;
  note: string;
  tags: string[];
  decision: DecisionRecord | null;
  snapshot: DaySnapshot;
  updatedAt: number;
}
