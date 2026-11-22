import type { ResolvedLocation } from '../../src/astro';

/** Опорные места для тестов (в самом приложении готовых мест нет, D-120). */
export const KALINOVO: ResolvedLocation = { id: 'kalinovo', name: 'Калиново', latitude: 57.1401, longitude: 60.1476, elevation: 0, timeZone: 'Asia/Yekaterinburg' };
export const EKB: ResolvedLocation = { id: 'yekaterinburg', name: 'Екатеринбург', latitude: 56.84, longitude: 60.61, elevation: 0, timeZone: 'Asia/Yekaterinburg' };
export const SOCHI: ResolvedLocation = { id: 'sochi', name: 'Сочи', latitude: 43.5855, longitude: 39.7231, elevation: 0, timeZone: 'Europe/Moscow' };
/** Высокие широты: Мурманск. Здесь Луна регулярно не восходит по суткам. */
export const MURMANSK: ResolvedLocation = {
  id: 'murmansk', name: 'Мурманск', latitude: 68.97, longitude: 33.08, elevation: 0, timeZone: 'Europe/Moscow',
};

export const minutesDiff = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 60_000;
export const utc = (s: string) => new Date(s);
