import { describe, expect, it } from 'vitest';
import * as A from '../src/astro';
import { makeContent } from '../src/content';
import { DEFAULT_NUMEROLOGY } from '../src/personal/numerology';
import { computeDay, type DayOptions } from '../src/synthesis/day';
import { synthesize } from '../src/synthesis/rules';
import { dayPlan } from '../src/synthesis/life';
import { dayAreas } from '../src/synthesis/areas';
import { morningText } from '../src/bot/message';
import { morningSpeech } from '../src/bot/speech';
import { changeDue } from '../src/bot/change';
import type { Subscriber } from '../src/bot/state';

// Случай из жизни (25.11.2026, Средний Урал): в 16:05 начался 17-й лунный день, а советы оставались по 16-му.
const loc: A.ResolvedLocation = { id: 'x', name: '', latitude: 57.14, longitude: 60.15, elevation: 0, timeZone: 'Asia/Yekaterinburg' };
const opts: DayOptions = { daylight: { from: 7, to: 23 }, vocMode: 'modern', zodiac: 'tropical', vedic: false, garden: false, birthday: null, numerology: DEFAULT_NUMEROLOGY };
const content = makeContent();
const date = '2026-11-25';
const change = A.lunarDaysForDate(loc, date)[1]!.from; // начало 17-го

describe('«Сегодня» показывает лунный день, который идёт сейчас (D-149)', () => {
  it('исходные данные: днём 25.11 смена 16-го на 17-й', () => {
    expect(A.lunarDaysForDate(loc, date).map((s) => s.day.number)).toEqual([16, 17]);
    expect(A.formatTime(change, loc.timeZone)).toMatch(/^16:0\d$/);
  });

  it('до смены — всё по 16-му, после смены — всё по 17-му', () => {
    const before = computeDay(loc, date, { ...opts, at: new Date(change.getTime() - 60_000) });
    const after = computeDay(loc, date, { ...opts, at: new Date(change.getTime() + 60_000) });
    expect(before.focus).toBe('now');
    expect(before.dominant.number).toBe(16);
    expect(after.dominant.number).toBe(17);
    const card = synthesize(after, content);
    const plan = dayPlan(after, card, content);
    expect(card.base.day).toBe(17);
    expect(plan.lunarDay).toBe(17);
    expect(card.summary).toMatch(/17-е сутки/);
    expect(card.summary).not.toMatch(/основная часть дня/);
    expect(card.why[0]!.effect).toMatch(/^Сейчас идут 17-е/);
    // сферы дня — по таблице 17-го
    const day17 = computeDay(loc, '2026-11-26', { ...opts, at: new Date(change.getTime() + 20 * 3600_000) });
    expect(day17.dominant.number).toBe(17);
    expect(dayAreas(after).map((a) => a.verdict)).toEqual(dayAreas(day17).map((a) => a.verdict));
  });

  it('без «сейчас» (календарь, другие дни) — прежнее правило большей части светлого времени', () => {
    const m = computeDay(loc, date, opts);
    expect(m.focus).toBe('majority');
    expect(m.dominant.number).toBe(16);
    // момент из других суток не влияет
    expect(computeDay(loc, date, { ...opts, at: new Date('2026-11-26T12:00:00Z') }).focus).toBe('majority');
  });

  it('ночью, до смены, советы по ещё идущему вчерашнему лунному дню', () => {
    const night = A.lunarDaysForDate(loc, '2026-11-26');
    const m = computeDay(loc, '2026-11-26', { ...opts, at: new Date(night[0]!.from.getTime() + 60_000) });
    expect(m.dominant.number).toBe(night[0]!.day.number);
  });

  it('утреннее сообщение бота — по дню, который идёт в момент отправки', () => {
    const late = new Date(change.getTime() + 30 * 60_000);
    const txt = morningText({ loc, date, birthday: null, at: late });
    expect(txt).toMatch(/17-й лунный день<\/b> \(с 16:0\d, до этого 16-й\)/);
    const early = morningText({ loc, date, birthday: null, at: new Date(change.getTime() - 6 * 3600_000) });
    expect(early).toMatch(/16-й лунный день<\/b> \(в 16:0\d начнётся 17-й\)/);
    const speech = morningSpeech({ loc, date, birthday: null, at: late }).join(' ');
    expect(speech).toMatch(/начался в 16:0\d, а до этого шёл/);
  });
});

describe('уведомление о смене при новом правиле', () => {
  const sub = { latitude: loc.latitude, longitude: loc.longitude, timeZone: loc.timeZone, birthDay: 0, birthMonth: 0, hour: 7, minute: 30 };
  const who = (over: Partial<Subscriber> = {}): Subscriber => ({ sub, firstName: '', lastSent: null, since: '', ...over });
  it('смена днём после утреннего сообщения — сообщаем', () => {
    expect(changeDue(who(), new Date(change.getTime() + 60_000))?.number).toBe(17);
  });
  it('смена раньше утреннего времени человека — молчим: утро и так расскажет о новом дне', () => {
    expect(changeDue(who({ sub: { ...sub, hour: 17, minute: 0 } }), new Date(change.getTime() + 60_000))).toBeNull();
  });
});
