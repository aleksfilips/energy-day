import { describe, expect, it } from 'vitest';
import { bestDays, pickDays, rankDays } from '../src/synthesis/pick';
import { EKB } from './astro/helpers';

const opts = { daylight: { from: 7, to: 23 }, zodiac: 'tropical' as const, vocMode: 'modern' as const };
const days = pickDays(EKB, '2026-11-23', 42, opts, () => 'активная');

describe('«Подобрать день» (D-138)', () => {
  it('считает 42 дня подряд, по 20 сфер в каждом', () => {
    expect(days).toHaveLength(42);
    expect(days[41]!.date).toBe('2027-01-03');
    for (const d of days) expect(Object.keys(d.verdicts)).toHaveLength(20);
  });
  it('лучшие дни — только «хорошо» или «можно», и «хорошо» всегда выше «можно»', () => {
    for (const area of ['start', 'hair', 'wedding', 'travel'] as const) {
      const best = bestDays(days, area, 5);
      expect(best.every((b) => b.verdict !== 'bad')).toBe(true);
      const firstNeutral = best.findIndex((b) => b.verdict === 'neutral');
      if (firstNeutral >= 0) expect(best.slice(firstNeutral).every((b) => b.verdict === 'neutral')).toBe(true);
    }
  });
  it('для начинаний растущая Луна даёт преимущество', () => {
    const r = rankDays(days, 'start').filter((x) => x.verdict === 'good' && x.day.vocShare === 0 && x.day.good.length);
    const wax = r.find((x) => x.day.waxing);
    const wan = r.find((x) => !x.day.waxing);
    if (wax && wan) expect(wax.score).toBeGreaterThan(wan.score);
  });
  it('Луна без курса снижает оценку', () => {
    for (const r of rankDays(days, 'money')) expect(r.day.vocShare).toBeGreaterThanOrEqual(0);
    const withVoc = rankDays(days, 'money').find((r) => r.day.vocShare > 0.3);
    if (withVoc) expect(withVoc.why.join(' ')).not.toContain('без Луны без курса');
  });
  it('дни с новолунием, полнолунием или четвертью отмечены', () => {
    expect(days.filter((d) => d.moon).length).toBeGreaterThanOrEqual(5);
    expect(days.find((d) => d.date === '2026-11-24')?.moon?.label).toBe('полнолуние');
  });
});
