import { describe, expect, it } from 'vitest';
import { applyOverrides, BASE, COLLECTIONS, makeContent, type CollectionName } from '../../src/content';

describe.each(Object.keys(COLLECTIONS) as CollectionName[])('контент: %s', (name) => {
  const def = COLLECTIONS[name];
  const entries = BASE[name] as unknown[];

  it(`ровно ${def.count} записей`, () => {
    expect(entries).toHaveLength(def.count);
  });

  it('каждая запись валидна по схеме', () => {
    for (const e of entries) {
      const r = def.schema.safeParse(e);
      if (!r.success) throw new Error(JSON.stringify(r.error.issues.slice(0, 3)));
    }
  });

  it('у каждой записи есть school, confidence, consensus', () => {
    for (const e of entries as Record<string, unknown>[]) {
      expect(e.school).toBeTruthy();
      expect(e.confidence).toBeTruthy();
      expect(e.consensus).toBeTruthy();
    }
  });

  it('id уникальны', () => {
    const ids = entries.map((e) => (def.id as (x: unknown) => string)(e));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('правила слоя Б', () => {
  const all = JSON.stringify(BASE).toLowerCase();
  it('нет медицинских обещаний', () => {
    for (const w of ['лечит', 'вылечит', 'диагноз', 'исцеляет болезн', 'опасно для здоровья']) expect(all).not.toContain(w);
  });
  it('тяжёлые дни 9, 15, 23, 29 поданы нейтрально, как дни внимания', () => {
    const c = makeContent();
    for (const n of [9, 15, 23, 29]) {
      const d = c.lunarDay(n);
      expect(d.attention).toBe(true);
      expect(d.essence).toContain('повышенного внимания');
      expect(d.energy.tone).toBe('бережная');
    }
  });
  it('у лунных суток основной символ первым, авестийская школа', () => {
    const c = makeContent();
    expect(c.lunarDay(1).symbols[0]).toBe('светильник');
    expect(c.lunarDay(30).symbols[0]).toBe('золотой лебедь');
    expect(c.lunarDay(31).day).toBe(30);
  });
  it('цвета личного дня ждут сверки', () => {
    for (const e of BASE['personal-numbers']) expect(e.needsReview).toBe(true);
  });
});

describe('правки пользователя (overrides)', () => {
  it('правка ложится поверх базы, невалидная — игнорируется', () => {
    const c = applyOverrides([
      { key: 'lunar-days:5', collection: 'lunar-days', id: '5', patch: { essence: 'Моя формулировка', needsReview: false }, updatedAt: 1 },
      { key: 'lunar-days:6', collection: 'lunar-days', id: '6', patch: { essence: '' }, updatedAt: 1 },
    ]);
    const m = makeContent(c);
    expect(m.lunarDay(5).essence).toBe('Моя формулировка');
    expect(m.lunarDay(5).needsReview).toBe(false);
    expect(m.lunarDay(6).essence).toBe(BASE['lunar-days'][5]!.essence);
    expect(BASE['lunar-days'][4]!.essence).not.toBe('Моя формулировка');
  });
});
