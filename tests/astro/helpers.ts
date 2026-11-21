import { requireResolved, LOCATION_PRESETS, type ResolvedLocation } from '../../src/astro';

export const EKB: ResolvedLocation = requireResolved(LOCATION_PRESETS.find((l) => l.id === 'yekaterinburg')!);
export const SOCHI: ResolvedLocation = requireResolved(LOCATION_PRESETS.find((l) => l.id === 'sochi')!);
/** Высокие широты: Мурманск. Здесь Луна регулярно не восходит по суткам. */
export const MURMANSK: ResolvedLocation = {
  id: 'murmansk', name: 'Мурманск', latitude: 68.97, longitude: 33.08, elevation: 0, timeZone: 'Europe/Moscow',
};

export const minutesDiff = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 60_000;
export const utc = (s: string) => new Date(s);
