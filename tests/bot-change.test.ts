import { describe, expect, it } from 'vitest';
import * as A from '../src/astro';
import { changeDue, changeText } from '../src/bot/change';
import { decodeSubscription, encodeSubscription, type Subscription } from '../src/bot/payload';
import type { Subscriber } from '../src/bot/state';

// Екатеринбург (не адрес владельца). 23.11.2026: 14-й лунный день до восхода Луны около 15:08, потом 15-й.
const sub: Subscription = { latitude: 56.84, longitude: 60.6, timeZone: 'Asia/Yekaterinburg', birthDay: 0, birthMonth: 0, hour: 7, minute: 30 };
const who = (over: Partial<Subscriber> = {}): Subscriber => ({ sub, firstName: '', lastSent: null, since: '', ...over });
const loc = { id: 'x', name: '', latitude: sub.latitude, longitude: sub.longitude, elevation: 0, timeZone: sub.timeZone };

describe('уведомление о смене лунного дня (D-145)', () => {
  const start = A.lunarDayAt(loc, new Date('2026-11-23T12:00:00Z')).start;
  it('сообщает сразу после смены днём, и только один раз', () => {
    const t = new Date(start.getTime() + 60_000);
    const d = changeDue(who(), t);
    expect(d?.number).toBe(15);
    expect(changeDue(who({ lastChange: d!.start.toISOString() }), t)).toBeNull();
  });
  it('не сообщает спустя долгое время и до смены', () => {
    expect(changeDue(who(), new Date(start.getTime() + 3 * 3600_000))).toBeNull();
    expect(changeDue(who(), new Date(start.getTime() - 60_000))).toBeNull();
  });
  it('можно выключить', () => {
    expect(changeDue(who({ sub: { ...sub, changes: false } }), new Date(start.getTime() + 60_000))).toBeNull();
  });
  it('не сообщает о дне, который уже описан утром, и ночью', () => {
    // Проверяем каждый день месяца: если сообщаем — смена днём и новый день не основной для этих суток.
    for (let i = 0; i < 30; i++) {
      const t0 = new Date(Date.UTC(2026, 11, 1 + i, 2, 0));
      const day = A.lunarDayAt(loc, t0);
      const nxt = A.lunarDayAt(loc, new Date(day.end.getTime() + 1000));
      const d = changeDue(who(), new Date(nxt.start.getTime() + 60_000));
      const w = A.wallClock(nxt.start, sub.timeZone);
      const mins = w.hour * 60 + w.minute;
      if (mins < 7 * 60 || mins >= 22 * 60) expect(d).toBeNull();
    }
  });
  it('текст: номер дня, время и советы', () => {
    const d = changeDue(who(), new Date(start.getTime() + 60_000))!;
    const txt = changeText(d, sub.timeZone);
    expect(txt).toMatch(/Энергия сменилась/);
    expect(txt).toMatch(/15-й лунный день/);
    expect(txt).toMatch(/Хорошо сейчас/);
    expect(txt.length).toBeLessThan(1500);
  });
  it('код подписки переносит выключение уведомлений, старые коды — включены', () => {
    expect(decodeSubscription(encodeSubscription(sub))?.changes).toBeUndefined();
    expect(decodeSubscription(encodeSubscription({ ...sub, changes: false }))?.changes).toBe(false);
    expect(decodeSubscription(encodeSubscription({ ...sub, voice: 1, changes: false }))).toMatchObject({ voice: 1, changes: false });
  });
});
