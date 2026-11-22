import { describe, expect, it } from 'vitest';
import { decodeSubscription, encodeSubscription, MAX_START, subscribeLink, type Subscription } from '../src/bot/payload';
import { applyUpdate, emptyState, isDue } from '../src/bot/state';
import { morningText } from '../src/bot/message';
import { parseProfile, profileOf } from '../src/state/profile';
import { DEFAULT_SETTINGS } from '../src/state/settings';
import { inviteLink } from '../src/config';
import { KALINOVO } from './astro/helpers';

const sub: Subscription = { latitude: 57.1317, longitude: 60.1464, timeZone: 'Asia/Yekaterinburg', birthDay: 30, birthMonth: 6, hour: 7, minute: 30 };

describe('код подписки для бота', () => {
  it('туда и обратно без потерь (координаты до 1 м)', () => {
    const code = encodeSubscription(sub);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeSubscription(code)).toEqual(sub);
  });
  it('укладывается в 64 символа для всех поясов, которые знает Intl', () => {
    for (const tz of Intl.supportedValuesOf('timeZone')) {
      const c = encodeSubscription({ ...sub, timeZone: tz, latitude: -89.99999, longitude: -179.99999 });
      expect(c.length).toBeLessThanOrEqual(MAX_START);
      expect(decodeSubscription(c)?.timeZone).toBe(tz);
    }
  });
  it('южное и западное полушарие, без дня рождения', () => {
    const s = { ...sub, latitude: -33.8688, longitude: -70.6693, timeZone: 'America/Santiago', birthDay: 0, birthMonth: 0, hour: 6, minute: 5 };
    expect(decodeSubscription(encodeSubscription(s))).toEqual(s);
  });
  it('мусор не принимается', () => {
    for (const c of ['', 'stop', 'a', 'a!!!', 'b' + encodeSubscription(sub).slice(1), 'aAAAA']) expect(decodeSubscription(c)).toBeNull();
  });
  it('ссылки', () => {
    expect(subscribeLink('@EnergyDayFilips_bot', sub)).toMatch(/^https:\/\/t\.me\/EnergyDayFilips_bot\?start=a/);
    expect(inviteLink('EnergyDayFilips_bot')).toBe('https://t.me/EnergyDayFilips_bot?startapp=invite');
    expect(inviteLink('')).toMatch(/^https:\/\/aleksfilips\.github\.io/);
  });
});

describe('логика бота', () => {
  const msg = (id: number, text: string, chat = 111) => ({ update_id: id, message: { chat: { id: chat, type: 'private' }, from: { first_name: 'Мария' }, text } });
  const now = new Date('2026-11-21T02:35:00Z'); // 07:35 в Екатеринбурге

  it('подписка, повторная подписка, отписка', () => {
    const s = emptyState();
    expect(applyUpdate(s, msg(5, `/start ${encodeSubscription(sub)}`), now)).toEqual({ kind: 'subscribed', chatId: '111', isNew: true });
    expect(s.subs['111']!.sub).toEqual(sub);
    expect(s.subs['111']!.firstName).toBe('Мария');
    expect(applyUpdate(s, msg(6, `/start ${encodeSubscription({ ...sub, hour: 8 })}`), now)).toMatchObject({ kind: 'subscribed', isNew: false });
    expect(s.subs['111']!.sub.hour).toBe(8);
    expect(applyUpdate(s, msg(7, '/start stop'), now)).toEqual({ kind: 'unsubscribed', chatId: '111', wasSubscribed: true });
    expect(s.subs['111']).toBeUndefined();
    expect(s.offset).toBe(7);
  });
  it('/stop, /today, приветствие, плохой код, группы игнорируются', () => {
    const s = emptyState();
    expect(applyUpdate(s, msg(1, '/stop'), now).kind).toBe('unsubscribed');
    expect(applyUpdate(s, msg(2, '/today'), now)).toEqual({ kind: 'today', chatId: '111', subscribed: false });
    expect(applyUpdate(s, msg(3, '/start'), now).kind).toBe('welcome');
    expect(applyUpdate(s, msg(4, '/start invite'), now).kind).toBe('welcome');
    expect(applyUpdate(s, msg(5, '/start aXXXX'), now).kind).toBe('bad-code');
    expect(applyUpdate(s, { update_id: 6, message: { chat: { id: -5, type: 'group' }, text: '/start' } }, now).kind).toBe('ignore');
  });
  it('человек заблокировал бота — удаляем', () => {
    const s = emptyState();
    applyUpdate(s, msg(1, `/start ${encodeSubscription(sub)}`), now);
    applyUpdate(s, { update_id: 2, my_chat_member: { chat: { id: 111, type: 'private' }, new_chat_member: { status: 'kicked' } } }, now);
    expect(s.subs).toEqual({});
  });
  it('время отправки — по местному времени каждого', () => {
    const ekb = { sub, firstName: '', lastSent: null, since: '' };
    const msk = { sub: { ...sub, timeZone: 'Europe/Moscow', latitude: 55.75, longitude: 37.62 }, firstName: '', lastSent: null, since: '' };
    expect(isDue(ekb, new Date('2026-11-21T02:29:00Z'))).toBe(false); // 07:29 Екб
    expect(isDue(ekb, new Date('2026-11-21T02:30:00Z'))).toBe(true); // 07:30 Екб
    expect(isDue(msk, new Date('2026-11-21T02:30:00Z'))).toBe(false); // 05:30 Мск
    expect(isDue(msk, new Date('2026-11-21T04:40:00Z'))).toBe(true); // 07:40 Мск
    expect(isDue({ ...ekb, lastSent: '2026-11-21' }, new Date('2026-11-21T03:00:00Z'))).toBe(false); // уже отправлено
    expect(isDue(ekb, new Date('2026-11-21T06:31:00Z'))).toBe(false); // 11:31 — окно прошло
  });
  it('текст сообщения: обращение по имени, личный день, без падений для разных мест', () => {
    const t = morningText({ loc: KALINOVO, date: '2026-11-21', birthday: { day: 30, month: 6 }, firstName: 'Мария' });
    expect(t).toContain('Доброе утро, Мария!');
    expect(t).toContain('лунный день');
    expect(t).toContain('Твой личный день');
    for (const [lat, lon, tz] of [[68.97, 33.07, 'Europe/Moscow'], [-33.87, 151.21, 'Australia/Sydney'], [43.1, 131.9, 'Asia/Vladivostok'], [54.71, 20.51, 'Europe/Kaliningrad']] as const) {
      expect(morningText({ loc: { id: 'x', name: '', latitude: lat, longitude: lon, elevation: 0, timeZone: tz }, date: '2026-12-21', birthday: null }).length).toBeGreaterThan(100);
    }
  });
});

describe('профиль в облаке Telegram', () => {
  it('туда и обратно', () => {
    const s = { ...structuredClone(DEFAULT_SETTINGS), onboarded: true, name: 'Мария', locations: [KALINOVO], activeLocationId: 'kalinovo', homeLocationId: 'kalinovo', birthday: { day: 1, month: 2 } };
    expect(parseProfile(JSON.stringify(profileOf(s)))).toEqual(profileOf(s));
  });
  it('мусор и пустое — null', () => {
    for (const t of [null, '', '{', '{"v":2}', '{"v":1,"locations":[]}', '{"v":1,"locations":[{"id":1}]}']) expect(parseProfile(t)).toBeNull();
  });
});

describe('переход владельца на новую версию', () => {
  it('старые настройки сохраняются, новые поля дополняются', async () => {
    const { migrateSettings } = await import('../src/state/settings');
    const old = { version: 1, onboarded: true, locations: [KALINOVO], activeLocationId: 'kalinovo', homeLocationId: 'kalinovo', birthday: { day: 30, month: 6 } } as never;
    const s = migrateSettings(old);
    expect(s.onboarded).toBe(true);
    expect(s.locations).toEqual([KALINOVO]);
    expect(s.birthday).toEqual({ day: 30, month: 6 });
    expect(s.name).toBeNull();
    expect(s.morning).toEqual({ enabled: false, hour: 7, minute: 30, code: null });
    expect(s.cloudProfile).toBe(true);
  });
  it('у нового человека нет ни одного готового места', async () => {
    const { migrateSettings, DEFAULT_SETTINGS: D } = await import('../src/state/settings');
    expect(D.locations).toEqual([]);
    expect(migrateSettings(undefined).onboarded).toBe(false);
    expect(JSON.stringify(D)).not.toMatch(/Калинов|1994|57\.14/);
  });
});
