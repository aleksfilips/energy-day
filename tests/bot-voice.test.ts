import { describe, expect, it } from 'vitest';
import { decodeSubscription, encodeSubscription, extrasFit, MAX_START, type Subscription } from '../src/bot/payload';
import { applyUpdate, emptyState } from '../src/bot/state';
import { hdMorning } from '../src/bot/hd';
import { morningSpeech, ordinalM, ordinalN } from '../src/bot/speech';
import { chunks } from '../scripts/tts';
import { birthToUtc } from '../src/humandesign/chart';
import { EKB } from './astro/helpers';

// Эталон — публичная карта Ра Уру Ху (D-131), не данные владельца.
const RA = birthToUtc({ year: 1948, month: 4, day: 9, hour: 5, minute: 5, timeZone: 'UTC' } as never);
const base: Subscription = { latitude: 56.83, longitude: 60.6, timeZone: 'Asia/Yekaterinburg', birthDay: 9, birthMonth: 4, hour: 7, minute: 30 };

describe('код подписки с голосом и Дизайном человека (D-137)', () => {
  it('голос и момент рождения проходят туда и обратно с точностью до минуты', () => {
    for (const voice of [0, 1, 2, 3] as const) {
      const s = { ...base, voice, hd: true, birthUtc: RA.getTime() };
      const code = encodeSubscription(s);
      expect(code[0]).toBe('d');
      expect(code.length).toBeLessThanOrEqual(MAX_START);
      expect(decodeSubscription(code)).toEqual(s);
    }
  });
  it('без голоса и Дизайна человека остаётся старый короткий код', () => {
    expect(encodeSubscription({ ...base, voice: 0, hd: false })[0]).toBe('a');
  });
  it('слишком длинный часовой пояс — старый код без добавок', () => {
    const s = { ...base, timeZone: 'America/Argentina/ComodRivadavia', voice: 1 as const, hd: true, birthUtc: RA.getTime() };
    expect(extrasFit(s)).toBe(false);
    expect(encodeSubscription(s)[0]).toBe('a');
  });
  it('бот принимает новый код и команду голосов', () => {
    const st = emptyState();
    const code = encodeSubscription({ ...base, voice: 2, hd: true, birthUtc: RA.getTime() });
    const msg = (id: number, text: string) => ({ update_id: id, message: { chat: { id: 7, type: 'private' }, text } });
    expect(applyUpdate(st, msg(1, `/start ${code}`), new Date())).toMatchObject({ kind: 'subscribed' });
    expect(st.subs['7']!.sub.voice).toBe(2);
    expect(applyUpdate(st, msg(2, '/start golos'), new Date())).toEqual({ kind: 'voices', chatId: '7' });
    expect(applyUpdate(st, msg(3, '/golos'), new Date())).toEqual({ kind: 'voices', chatId: '7' });
  });
});

describe('голосовой текст', () => {
  it('порядковые числительные', () => {
    expect(ordinalM(1)).toBe('первый');
    expect(ordinalM(14)).toBe('четырнадцатый');
    expect(ordinalM(23)).toBe('двадцать третий');
    expect(ordinalM(30)).toBe('тридцатый');
    expect(ordinalN(23)).toBe('двадцать третье');
    expect(ordinalN(2)).toBe('второе');
    expect(ordinalN(31)).toBe('тридцать первое');
  });
  it('без значков, кавычек и скобок; с Дизайном человека', () => {
    const hd = hdMorning(RA, '2026-11-23', 'Asia/Yekaterinburg', 'Понедельник, 23 ноября');
    const p = morningSpeech({ loc: EKB, date: '2026-11-23', birthday: { day: 9, month: 4 }, firstName: 'Тест' }, hd.story);
    const all = p.join(' ');
    expect(all).toMatch(/^Доброе утро, Тест! Сегодня понедельник, двадцать третье ноября/);
    expect(all).toContain('Дизайн человека');
    expect(all).not.toMatch(/[«»()<>•✅⛔]|,,/);
    expect(all.length).toBeLessThan(6000);
  });
  it('куски для Яндекса не длиннее лимита', () => {
    const long = Array.from({ length: 40 }, (_, i) => `Предложение номер ${i} довольно длинное, чтобы набрать объём.`).join(' ');
    for (const c of chunks([long, 'Коротко.', long], 500)) expect(c.length).toBeLessThanOrEqual(500);
  });
});

describe('Дизайн человека в утреннем сообщении', () => {
  const hd = hdMorning(RA, '2026-11-23', 'Asia/Yekaterinburg', 'Понедельник, 23 ноября');
  it('подпись и разбор помещаются в лимиты Telegram', () => {
    expect(hd.caption.replace(/<[^>]+>/g, '').length).toBeLessThan(1024);
    expect(hd.text.replace(/<[^>]+>/g, '').length).toBeLessThan(4096);
    expect(hd.text).toContain('Как прожить день');
  });
  it('картинка — SVG 1080×1350 с бодиграфом, датой и легендой', () => {
    expect(hd.svg).toMatch(/^<svg[^>]*viewBox="0 0 1080 1350"/);
    expect(hd.svg).toContain('Понедельник, 23 ноября');
    expect(hd.svg).toContain('Транзит дня');
  });
});
