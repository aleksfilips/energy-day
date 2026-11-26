import { describe, expect, it } from 'vitest';
import { encodeSubscription, type Subscription } from '../src/bot/payload';
import { applyUpdate, emptyState, ensurePeople, placeKey, type BotState } from '../src/bot/state';
import { adminSetupText, newcomersText, panelList, panelStats, panelSvg, panelText, zoneName } from '../src/bot/admin';

const sub: Subscription = { latitude: 57.1401, longitude: 60.1476, timeZone: 'Asia/Yekaterinburg', birthDay: 30, birthMonth: 6, hour: 7, minute: 30 };
const msg = (id: number, text: string, chat: number, name = 'Мария', username?: string) => ({
  update_id: id,
  message: { chat: { id: chat, type: 'private' }, from: { first_name: name, ...(username ? { username } : {}) }, text },
});
const now = new Date('2026-11-26T20:00:00Z'); // 27 ноября, 01:00 в Екатеринбурге
const ADMIN = '999';

describe('панель владельца: доступ', () => {
  it('/admin открывается только владельцу, остальным — обычное приветствие', () => {
    const s = emptyState();
    expect(applyUpdate(s, msg(1, '/admin', 999, 'Александр'), now, ADMIN)).toEqual({ kind: 'admin', chatId: '999', full: false });
    expect(applyUpdate(s, msg(2, '/admin_vse', 999, 'Александр'), now, ADMIN)).toEqual({ kind: 'admin', chatId: '999', full: true });
    expect(applyUpdate(s, msg(3, '/admin', 111), now, ADMIN)).toEqual({ kind: 'welcome', chatId: '111', firstName: 'Мария' });
    expect(applyUpdate(s, msg(4, '/admin_vse', 111), now, ADMIN).kind).toBe('welcome');
  });
  it('пока владелец не вписан — подсказываем номер чата', () => {
    const s = emptyState();
    expect(applyUpdate(s, msg(1, '/admin', 999), now)).toEqual({ kind: 'admin-setup', chatId: '999' });
    expect(adminSetupText('999')).toContain('ADMIN_ID=999');
  });
});

describe('панель владельца: учёт людей', () => {
  it('каждый, кто написал боту, попадает в список; подписка, отписка, блокировка считаются', () => {
    const s = emptyState();
    applyUpdate(s, msg(1, '/start', 111, 'Мария', 'maria'), new Date('2026-11-20T10:00:00Z'), ADMIN);
    applyUpdate(s, msg(2, `/start ${encodeSubscription(sub)}`, 111, 'Мария', 'maria'), new Date('2026-11-20T10:05:00Z'), ADMIN);
    applyUpdate(s, msg(3, '/start invite', 222, 'Олег'), new Date('2026-11-26T08:00:00Z'), ADMIN);
    applyUpdate(s, msg(4, `/start ${encodeSubscription({ ...sub, timeZone: 'Europe/Moscow', latitude: 55.75, longitude: 37.62, voice: 1 })}`, 333, 'Ира'), new Date('2026-11-01T08:00:00Z'), ADMIN);
    applyUpdate(s, msg(5, '/stop', 333, 'Ира'), new Date('2026-11-25T08:00:00Z'), ADMIN);
    applyUpdate(s, msg(6, '/start', 444, 'Пётр'), new Date('2026-11-24T08:00:00Z'), ADMIN);
    applyUpdate(s, { update_id: 7, my_chat_member: { chat: { id: 444, type: 'private' }, new_chat_member: { status: 'kicked' } } }, new Date('2026-11-25T09:00:00Z'), ADMIN);
    s.places = { [placeKey(sub.latitude, sub.longitude)]: 'Калиново' };

    expect(s.people!['111']).toMatchObject({ n: 'Мария', u: 'maria', first: '2026-11-20T10:00:00.000Z' });
    const p = panelStats(s, now);
    expect(p.known).toBe(4);
    expect(p.subs).toBe(1);
    expect(p.notSubscribed).toBe(2); // Олег и Ира
    expect(p.blocked).toBe(1);
    expect(p.newPeople).toEqual({ day: 0, week: 3, month: 4 });
    expect(p.newPeople.week).toBe(3); // Мария 20.11, Олег 26.11, Пётр 24.11
    expect(p.left30).toEqual({ unsub: 1, blocked: 1, gone: 0 });
    expect(p.places).toEqual([['Калиново', 1]]);
    expect(p.series).toHaveLength(30);
    expect(p.series[29]!.total).toBe(4);
    expect(p.series.reduce((a, x) => a + x.added, 0)).toBe(4);

    const t = panelText(p);
    expect(t).toContain('Знают бота: <b>4</b>');
    expect(t).toContain('Получают утреннее сообщение: <b>1</b>');
    expect(t).toContain('Мария (@maria)');
    expect(t).toContain('Калиново');
    expect(t.length).toBeLessThan(4096);
    const list = panelList(p).join('\n');
    expect(list).toContain('Мария (@maria) — Калиново, в 07:30');
    expect(list).toContain('Олег — впервые вчера');
    expect(list).toContain('Заблокировали бота — 1');
  });
  it('старые данные без списка людей: подписчики становятся людьми', () => {
    const s = { v: 1, offset: 5, ownerSeeded: true, subs: { '111': { sub, firstName: 'Мария', lastSent: null, since: '2026-11-22T10:00:00Z' } } } as BotState;
    ensurePeople(s);
    expect(s.people).toEqual({ '111': { n: 'Мария', first: '2026-11-22T10:00:00Z', last: '2026-11-22T10:00:00Z' } });
    expect(panelStats(s, now).known).toBe(1);
  });
  it('без места в кэше — пояс', () => {
    expect(zoneName('Asia/Yekaterinburg', now)).toBe('пояс Екатеринбург (UTC+5)');
    expect(zoneName('America/New_York', now)).toBe('пояс New York (UTC−5)');
  });
  it('уведомление владельцу о новеньких', () => {
    const s = emptyState();
    applyUpdate(s, msg(1, '/start', 222, 'Олег', 'oleg'), now, ADMIN);
    applyUpdate(s, msg(2, `/start ${encodeSubscription(sub)}`, 111, 'Мария'), now, ADMIN);
    const t = newcomersText(s, [{ kind: 'start', id: '222' }, { kind: 'sub', id: '111' }], now)!;
    expect(t).toContain('Новый человек в боте: Олег (@oleg)');
    expect(t).toContain('Включил(а) утреннее сообщение: Мария — пояс Екатеринбург (UTC+5), в 07:30');
    expect(newcomersText(s, [], now)).toBeNull();
  });
  it('имена с HTML не ломают сообщение', () => {
    const s = emptyState();
    applyUpdate(s, msg(1, '/start', 222, '<b>Зло</b>&'), now, ADMIN);
    const t = panelText(panelStats(s, now));
    expect(t).toContain('&lt;b&gt;Зло&lt;/b&gt;&amp;');
    expect(panelSvg(panelStats(s, now))).not.toContain('<b>');
  });
  it('большой список делится на сообщения до 4096 знаков', () => {
    const s = emptyState();
    for (let i = 0; i < 400; i++) applyUpdate(s, msg(i + 1, i % 2 ? '/start' : `/start ${encodeSubscription(sub)}`, 1000 + i, `Человек-${i}-с-длинным-именем`, `user_${i}`), new Date(now.getTime() - i * 3_600_000), ADMIN);
    const p = panelStats(s, now);
    expect(panelText(p).length).toBeLessThan(4096);
    const parts = panelList(p);
    expect(parts.length).toBeGreaterThan(3);
    for (const part of parts) expect(part.length).toBeLessThan(4096);
  });
});
