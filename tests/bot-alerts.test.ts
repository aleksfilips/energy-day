import { describe, expect, it } from 'vitest';
import * as A from '../src/astro';
import { changeSpeech, eveningDue, eveningText, remindersDue, reminderText, sunGateAt, sunGateDue, sunGateText, vocDue, vocText } from '../src/bot/alerts';
import { decodeSubscription, encodeSubscription, type Subscription } from '../src/bot/payload';
import { decodeReminder, encodeReminder } from '../src/bot/reminder';
import { applyUpdate, emptyState, type Subscriber } from '../src/bot/state';
import { birthToUtc } from '../src/humandesign/chart';

// Екатеринбург и публичная карта Ра Уру Ху — не данные владельца.
const RA = birthToUtc({ year: 1948, month: 4, day: 9, hour: 5, minute: 5, timeZone: 'UTC' } as never).getTime();
const TZ = 'Asia/Yekaterinburg';
const sub: Subscription = { latitude: 56.84, longitude: 60.6, timeZone: TZ, birthDay: 0, birthMonth: 0, hour: 7, minute: 30, voc: true, sunGate: true, birthUtc: RA, evening: 21 * 60 };
const who = (over: Partial<Subscriber> = {}): Subscriber => ({ sub, firstName: '', lastSent: null, since: '', ...over });
const at = (y: number, m: number, d: number, h: number, mi = 0) => A.zonedTimeToUtc(y, m, d, h, mi, TZ);

describe('код подписки версии d (D-146)', () => {
  it('переносит все новые настройки', () => {
    const code = encodeSubscription({ ...sub, voice: 2, hd: true, changes: false });
    expect(code[0]).toBe('d');
    expect(code.length).toBeLessThanOrEqual(64);
    expect(decodeSubscription(code)).toMatchObject({ voice: 2, hd: true, changes: false, voc: true, sunGate: true, evening: 1260, timeZone: TZ });
  });
  it('вечер с шагом 15 минут, без вечера — поля нет', () => {
    expect(decodeSubscription(encodeSubscription({ ...sub, evening: 20 * 60 + 45 }))?.evening).toBe(20 * 60 + 45);
    expect(decodeSubscription(encodeSubscription({ ...sub, evening: undefined }))?.evening).toBeUndefined();
  });
});

describe('напоминание о выбранном дне', () => {
  it('код туда и обратно', () => {
    const code = encodeReminder({ date: '2026-11-27', area: 'talk' });
    expect(code).toMatch(/^r[\w-]{4}$/);
    expect(decodeReminder(code)).toEqual({ date: '2026-11-27', area: 'talk' });
  });
  it('бот запоминает напоминание подписчика', () => {
    const st = emptyState();
    st.subs['1'] = who();
    const a = applyUpdate(st, { update_id: 1, message: { chat: { id: 1, type: 'private' }, text: `/start ${encodeReminder({ date: '2026-11-27', area: 'talk' })}` } }, new Date());
    expect(a).toMatchObject({ kind: 'remind', subscribed: true, date: '2026-11-27' });
    expect(st.subs['1']!.reminders).toEqual([{ date: '2026-11-27', area: 'talk' }]);
  });
  it('присылается накануне с 20:00 и с советами', () => {
    const s = who({ reminders: [{ date: '2026-11-27', area: 'talk' }] });
    expect(remindersDue(s, at(2026, 11, 26, 19, 30))).toHaveLength(0);
    const due = remindersDue(s, at(2026, 11, 26, 20, 5));
    expect(due).toHaveLength(1);
    const txt = reminderText(s, due[0]!);
    expect(txt).toMatch(/Завтра, 27 ноября/);
    expect(txt).toMatch(/Лучшее время/);
    expect(remindersDue(s, at(2026, 11, 28, 20, 5))).toHaveLength(0);
    expect(s.reminders).toHaveLength(0);
  });
});

describe('Луна без курса за 15 минут', () => {
  const ps = A.vocPeriodsBetween(at(2026, 12, 1, 0), at(2027, 1, 1, 0), 'modern').filter((p) => {
    const w = A.wallClock(p.start, TZ);
    return w.hour >= 9 && w.hour < 20;
  });
  const p = ps[0]!;
  it('предупреждает один раз и только если включено', () => {
    const t = new Date(p.start.getTime() - 15 * 60000);
    expect(vocDue(who(), t)?.start.getTime()).toBe(p.start.getTime());
    expect(vocDue(who({ lastVoc: p.start.toISOString() }), t)).toBeNull();
    expect(vocDue(who({ sub: { ...sub, voc: false } }), t)).toBeNull();
    expect(vocDue(who(), new Date(p.start.getTime() - 60 * 60000))).toBeNull();
    expect(vocText(p, t, TZ)).toMatch(/Через 15 мин Луна без курса/);
  });
});

describe('вечер с дневником', () => {
  it('в выбранное время, раз в день', () => {
    expect(eveningDue(who(), at(2026, 11, 24, 20, 50))).toBe(false);
    expect(eveningDue(who(), at(2026, 11, 24, 21, 1))).toBe(true);
    expect(eveningDue(who({ lastEvening: '2026-11-24' }), at(2026, 11, 24, 21, 1))).toBe(false);
    expect(eveningText(who(), at(2026, 11, 24, 21, 1))).toMatch(/Вопрос \d+-го лунного дня/);
  });
});

describe('Солнце в новых воротах', () => {
  it('первый раз только запоминает, потом сообщает о смене днём', () => {
    const t = at(2026, 11, 24, 12);
    const g = sunGateAt(t);
    expect(sunGateDue(who(), t)).toEqual({ gate: g, silent: true });
    expect(sunGateDue(who({ lastSunGate: g }), t)).toBeNull();
    expect(sunGateDue(who({ lastSunGate: g + 100 }), t)).toEqual({ gate: g, silent: false });
    expect(sunGateDue(who({ lastSunGate: g + 100 }), at(2026, 11, 24, 23))).toBeNull();
    const txt = sunGateText(who(), g, t);
    expect(txt).toMatch(new RegExp(`Солнце вошло в ворота ${g}`));
  });
});

describe('голос о смене дня', () => {
  it('три абзаца, номер дня словами', () => {
    const loc = { id: 'x', name: '', latitude: 56.84, longitude: 60.6, elevation: 0, timeZone: TZ };
    const p = changeSpeech(A.lunarDayAt(loc, new Date('2026-11-23T12:00:00Z')), TZ);
    expect(p).toHaveLength(3);
    expect(p[0]).toMatch(/пятнадцатый лунный день/);
  });
});
