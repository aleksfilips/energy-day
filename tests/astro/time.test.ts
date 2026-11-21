import { describe, expect, it } from 'vitest';
import { addDays, dayBounds, formatDateTime, formatTime, monthDateKeys, toDateKey, tzOffsetMinutes } from '../../src/astro';

describe('время и часовые пояса', () => {
  it('Екатеринбург: UTC+5 круглый год', () => {
    expect(tzOffsetMinutes(new Date('2026-01-15T12:00Z'), 'Asia/Yekaterinburg')).toBe(300);
    expect(tzOffsetMinutes(new Date('2026-07-15T12:00Z'), 'Asia/Yekaterinburg')).toBe(300);
  });

  it('границы календарного дня — местная полночь', () => {
    const { start, end } = dayBounds('2026-11-19', 'Asia/Yekaterinburg');
    expect(start.toISOString()).toBe('2026-11-18T19:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-19T19:00:00.000Z');
  });

  it('зона с летним временем: день 23 часа при переводе часов', () => {
    const { start, end } = dayBounds('2026-03-29', 'Europe/Berlin');
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });

  it('форматирование округляет до минуты', () => {
    expect(formatTime(new Date('2026-11-19T09:41:31Z'), 'Asia/Yekaterinburg')).toBe('14:42');
    expect(formatTime(new Date('2026-11-19T09:41:29Z'), 'Asia/Yekaterinburg')).toBe('14:41');
    expect(formatDateTime(new Date('2026-11-19T18:59:45Z'), 'Asia/Yekaterinburg')).toBe('2026-11-20 00:00');
  });

  it('даты', () => {
    expect(toDateKey(new Date('2026-11-19T19:30Z'), 'Asia/Yekaterinburg')).toBe('2026-11-20');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(monthDateKeys(2028, 2)).toHaveLength(29);
  });
});
