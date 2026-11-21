import { describe, expect, it } from 'vitest';
import { Body, Equator, Horizon, Observer } from 'astronomy-engine';
import * as A from '../src/astro';
import { makeContent } from '../src/content';
import { computeDay } from '../src/synthesis/day';
import { synthesize } from '../src/synthesis/rules';
import { dayMood, dayPlan, goodWindows, LIFE_AREAS, LIFE_TABLE, lifeAreas, vocInDaylight } from '../src/synthesis/life';
import { DEFAULT_NUMEROLOGY } from '../src/personal/numerology';
import { MURMANSK } from './astro/helpers';

const loc = A.requireResolved(A.LOCATION_PRESETS[0]!);
const opts = { daylight: { from: 7, to: 23 }, vocMode: 'modern' as const, zodiac: 'tropical' as const, vedic: false, garden: false, birthday: null, numerology: DEFAULT_NUMEROLOGY };
const content = makeContent();

describe('Солнце: восход, заход, длина дня', () => {
  it('в момент восхода и захода центр Солнца на −0,83° (рефракция 34′ + радиус 16′)', () => {
    const d = computeDay(loc, '2026-11-21', opts);
    const obs = new Observer(loc.latitude, loc.longitude, 0);
    for (const t of [d.sun.sunrise!, d.sun.sunset!]) {
      const eq = Equator(Body.Sun, t, obs, true, true);
      const h = Horizon(t, obs, eq.ra, eq.dec).altitude;
      expect(h).toBeGreaterThan(-0.9);
      expect(h).toBeLessThan(-0.77);
    }
  });

  it('Калиново, 21 ноября: восход около 9 утра, день примерно 7,5 часов', () => {
    const d = computeDay(loc, '2026-11-21', opts);
    const rise = A.wallClock(d.sun.sunrise!, loc.timeZone);
    expect(rise.hour).toBe(8);
    expect(d.sun.dayLengthMin!).toBeGreaterThan(6.5 * 60);
    expect(d.sun.dayLengthMin!).toBeLessThan(8 * 60);
  });

  it('летом день длиннее 17 часов', () => {
    expect(computeDay(loc, '2026-06-21', opts).sun.dayLengthMin!).toBeGreaterThan(17 * 60);
  });

  it('полярная ночь в Мурманске: восхода нет, длина дня неизвестна', () => {
    const d = computeDay(MURMANSK, '2026-12-21', opts);
    expect(d.sun.sunrise).toBeNull();
    expect(d.sun.dayLengthMin).toBeNull();
  });
});

describe('удачное время и Луна без курса', () => {
  it.each(A.monthDateKeys(2026, 11))('%s: окна не пересекаются с Луной без курса и лежат в светлом окне', (date) => {
    const d = computeDay(loc, date, opts);
    for (const w of goodWindows(d)) {
      expect(w.from >= d.window.from && w.to <= d.window.to).toBe(true);
      expect(w.to.getTime() - w.from.getTime()).toBeGreaterThanOrEqual(30 * 60_000);
      for (const v of d.voc) expect(w.to <= v.start || w.from >= v.end).toBe(true);
    }
  });

  it('20 ноября 2026: Луна без курса до 10:52, удачное время начинается в 10:52', () => {
    const d = computeDay(loc, '2026-11-20', opts);
    const voc = vocInDaylight(d);
    expect(A.formatTime(voc[0]!.to, loc.timeZone)).toBe('10:52');
    expect(A.formatTime(goodWindows(d)[0]!.from, loc.timeZone)).toBe('10:52');
    const work = lifeAreas(d).find((a) => a.key === 'work')!;
    expect(work.note).toContain('07:00–10:52');
  });
});

describe('сферы жизни и план дня', () => {
  it('таблица заполнена для всех 12 знаков и 5 сфер', () => {
    for (const s of A.SIGNS) for (const a of LIFE_AREAS) {
      expect(LIFE_TABLE[s][a.key].good.length).toBeGreaterThan(5);
      expect(LIFE_TABLE[s][a.key].careful.length).toBeGreaterThan(5);
    }
  });

  it.each(A.monthDateKeys(2026, 11))('%s: пять сфер и простой план', (date) => {
    const d = computeDay(loc, date, opts);
    expect(lifeAreas(d)).toHaveLength(5);
    const p = dayPlan(d, synthesize(d, content), content);
    expect(p.doList.length).toBeGreaterThan(0);
    expect(p.avoidList.length).toBeGreaterThan(0);
    expect(p.headline).not.toMatch(/авестийск|модификатор|титхи/);
  });

  it('настроение дня покрывает всю шкалу −3…+3', () => {
    for (let v = -3; v <= 3; v++) expect(dayMood(v).title).toMatch(/день$/);
  });
});
