import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { WIDGET_HTML, widgetCaption, widgetData } from '../src/bot/widget';

const loc = { id: 't', name: '', latitude: 56.84, longitude: 60.6, elevation: 0, timeZone: 'Asia/Yekaterinburg' };

describe('живая карточка дня (виджет)', () => {
  it('HTML укладывается в лимиты Telegram и без запрещённого', () => {
    expect(Buffer.byteLength(WIDGET_HTML)).toBeLessThanOrEqual(32768);
    expect(deflateSync(WIDGET_HTML, { level: 9 }).length).toBeLessThanOrEqual(4096);
    for (const bad of ['clip-path', 'clipPath', 'mask', 'color-mix', 'text-shadow', 'vh', '@font-face', 'fetch(']) expect(WIDGET_HTML).not.toContain(bad);
  });
  it('данные дня до 1024 байт в разные дни', () => {
    for (let d = 1; d <= 30; d++) {
      const w = widgetData(loc as never, `2026-12-${String(d).padStart(2, '0')}` as never);
      expect(Buffer.byteLength(JSON.stringify(w))).toBeLessThanOrEqual(1024);
      expect(w.L.length).toBeGreaterThan(0);
      expect(w.z).toBe(300);
    }
  });
  it('24.11.2026: 15-й и 16-й лунные дни, подпись с окнами', () => {
    const w = widgetData(loc as never, '2026-11-24' as never);
    expect(w.L.map((l) => l[0])).toEqual([15, 16]);
    expect(w.d).toBe('Вторник, 24 ноября');
    expect(widgetCaption(w)).toContain('15-й лунный день');
    expect(widgetCaption(w)).toContain('Для важного: 7:00–');
  });
});
