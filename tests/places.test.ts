import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/places-tz.json';
import { RU_ADMIN1_TO_ISO, RU_SUBJECT_TZ } from '../src/places/regions';
import { SINGLE_ZONE_COUNTRY } from '../src/places/countries';
import { dedupe, fromOm, hasExact, mergeResults, nearestZone, tidyRegion, zoneForOm, zoneOffline, type Place } from '../src/places/geocode';
import { birthMoment, isValidTimeZone, offsetText, safeTimeZone } from '../src/places/timezone';
import { birthToUtc } from '../src/humandesign/chart';

interface Row { q: string; source: 'om' | 'osm'; name: string; lat: number; lon: number; country: string; iso?: string; admin1_id?: number; baseTz?: string; boundaryTz: string }
const rows = fixture.rows as Row[];

describe('часовые пояса субъектов России', () => {
  it('все 83 субъекта есть в таблице, и все пояса понимает Intl', () => {
    expect(Object.keys(RU_SUBJECT_TZ).length).toBe(83);
    for (const z of Object.values(RU_SUBJECT_TZ)) if (z) expect(isValidTimeZone(z), z).toBe(true);
  });
  it('id регионов Open-Meteo ведут на существующие субъекты', () => {
    expect(Object.keys(RU_ADMIN1_TO_ISO).length).toBe(83);
    for (const iso of Object.values(RU_ADMIN1_TO_ISO)) expect(iso in RU_SUBJECT_TZ, iso).toBe(true);
  });
  // Сравниваем смещения в разные годы (а не имена): Europe/Kyiv и Europe/Kiev — один пояс.
  const off = (z: string, d: Date) => new Intl.DateTimeFormat('en-US', { timeZone: z, timeZoneName: 'longOffset' }).format(d).split(' ').pop();
  const years = ['1985-07-01', '1994-01-15', '2005-07-01', '2012-07-01', '2015-01-15', '2017-01-15', '2019-01-15', '2026-07-01'].map((d) => new Date(`${d}T12:00:00Z`));
  const sameZone = (a: string, b: string) => a === b || years.every((d) => off(a, d) === off(b, d));

  it('пояс каждого места России совпадает с картой границ поясов (≈1000 мест, история с 1985 г.)', () => {
    let checked = 0;
    for (const r of rows.filter((x) => x.country === 'RU')) {
      const z = r.source === 'osm' ? zoneOffline('RU', r.iso, r.lat, r.lon)?.timeZone : zoneForOm({ name: r.name, latitude: r.lat, longitude: r.lon, country_code: 'RU', admin1_id: r.admin1_id, timezone: r.baseTz })?.timeZone;
      if (!z) continue;
      expect(sameZone(z, r.boundaryTz), `${r.q} → ${r.name} (${r.lat}, ${r.lon}): ${z} ≠ ${r.boundaryTz}`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(900);
  });
  it('места других стран: пояс из базы или по стране совпадает с картой границ', () => {
    let checked = 0;
    for (const r of rows.filter((x) => x.country !== 'RU' && x.source === 'om')) {
      const z = zoneForOm({ name: r.name, latitude: r.lat, longitude: r.lon, country_code: r.country, admin1_id: r.admin1_id, timezone: r.baseTz })?.timeZone;
      if (!z) continue;
      expect(sameZone(z, r.boundaryTz), `${r.q} → ${r.name} (${r.country}): ${z} ≠ ${r.boundaryTz}`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });
  it('Якутия и Курилы: пояс по сетке границ, а не устаревший из базы мест', () => {
    const at = (lat: number, lon: number, iso: string) => zoneOffline('RU', iso, lat, lon)?.timeZone;
    expect(at(62.03, 129.73, 'RU-SA')).toBe('Asia/Yakutsk');
    expect(at(63.462, 142.795, 'RU-SA')).toBe('Asia/Ust-Nera'); // Оймякон
    expect(at(67.456, 153.704, 'RU-SA')).toBe('Asia/Srednekolymsk');
    expect(at(62.66, 135.55, 'RU-SA')).toBe('Asia/Khandyga');
    expect(at(50.673, 156.124, 'RU-SAK')).toBe('Asia/Srednekolymsk'); // Северо-Курильск
    expect(at(46.96, 142.74, 'RU-SAK')).toBe('Asia/Sakhalin');
  });
  it('страны с одним поясом: пояс по стране совпадает с картой границ', () => {
    for (const r of rows.filter((x) => x.country !== 'RU' && SINGLE_ZONE_COUNTRY[x.country])) {
      expect(sameZone(SINGLE_ZONE_COUNTRY[r.country]!, r.boundaryTz), r.q).toBe(true);
    }
  });
  it('Якутия: в базе мест у Оймякона устаревший пояс Магадана — берём пояс по сетке', () => {
    expect(RU_SUBJECT_TZ.SA).toBeNull();
    const p = fromOm({ name: 'Оймякон', latitude: 63.46, longitude: 142.79, country_code: 'RU', admin1_id: Number(Object.entries(RU_ADMIN1_TO_ISO).find(([, v]) => v === 'SA')![0]), timezone: 'Asia/Magadan', feature_code: 'PPL' });
    expect(p?.timeZone).toBe('Asia/Ust-Nera');
  });
  it('если база мест ошиблась с поясом в России, побеждает таблица', () => {
    const svId = Number(Object.entries(RU_ADMIN1_TO_ISO).find(([, v]) => v === 'SVE')![0]);
    const z = zoneForOm({ name: 'Калиново', latitude: 57.13, longitude: 60.15, country_code: 'RU', admin1_id: svId, timezone: 'Europe/Moscow' });
    expect(z).toEqual({ timeZone: 'Asia/Yekaterinburg', tzSource: 'region' });
  });
  it('ближайший пояс страны — запасной вариант', () => {
    expect(nearestZone('KZ', 43.25, 76.95)).toBe('Asia/Almaty');
    expect(nearestZone('US', 40.7, -74)).toBe('America/New_York');
    expect(nearestZone('FR', 48.8, 2.3)).toBeNull();
  });
});

describe('поиск мест: обработка ответов', () => {
  it('подписи регионов без лишних заглавных', () => {
    expect(tidyRegion('Свердловская Область')).toBe('Свердловская область');
    expect(tidyRegion('Ханты-Мансийский Автономный Округ – Югра')).toBe('Ханты-Мансийский автономный округ – Югра');
    expect(tidyRegion('Республика Татарстан')).toBe('Республика Татарстан');
  });
  it('не населённые пункты (аэропорты и т.п.) отбрасываются', () => {
    expect(fromOm({ name: 'аэропорт Мурманск', latitude: 68.78, longitude: 32.75, country_code: 'RU', feature_code: 'AIRP', timezone: 'Europe/Moscow' })).toBeNull();
  });
  const p = (name: string, lat: number, lon: number): Place => ({ name, label: '', latitude: lat, longitude: lon, timeZone: 'Europe/Moscow', tzSource: 'base', countryCode: 'RU', source: 'geonames' });
  it('повторы одного места убираются, разные одноимённые места остаются', () => {
    expect(dedupe([p('Калиново', 57.1317, 60.1464), p('Калиново', 57.1354, 60.15), p('Калиново', 54.99, 36.57)]).length).toBe(2);
  });
  it('точные совпадения названия — первыми', () => {
    const list = [p('Мурманский', 46.27, 48.1), p('Мурманск', 68.97, 33.07)];
    expect(hasExact('мурманск', list)).toBe(true);
    expect(hasExact('Мурманск', [list[0]!])).toBe(false);
    expect(mergeResults('Мурманск', list)[0]!.name).toBe('Мурманск');
    expect(hasExact('Калиново Невьянский', [p('Калиново', 57.13, 60.15)])).toBe(true);
    expect(hasExact('орел', [p('Орёл', 52.97, 36.06)])).toBe(true);
  });
});

describe('исторические переводы часов (момент рождения)', () => {
  const at = (y: number, m: number, d: number, h: number, mi: number, z: string) => birthMoment(y, m, d, h, mi, z);
  it('Новоуральск, 30.06.1994 00:05 — летнее время UTC+6', () => {
    const b = at(1994, 6, 30, 0, 5, 'Asia/Yekaterinburg');
    expect(b.utc.toISOString()).toBe('1994-06-29T18:05:00.000Z');
    expect(b.offset).toBe(360);
    expect(b.summer).toBe(true);
  });
  it.each([
    ['Екатеринбург, зима 1995', 1995, 1, 15, 'Asia/Yekaterinburg', 5],
    ['Екатеринбург, 2012 (постоянное +6)', 2012, 7, 15, 'Asia/Yekaterinburg', 6],
    ['Екатеринбург, 2016', 2016, 7, 15, 'Asia/Yekaterinburg', 5],
    ['Свердловск, лето 1975 (до летнего времени)', 1975, 7, 15, 'Asia/Yekaterinburg', 5],
    ['Самара, лето 1990 (время МСК+летнее)', 1990, 7, 15, 'Europe/Samara', 4],
    ['Самара, лето 1995', 1995, 7, 15, 'Europe/Samara', 5],
    ['Самара, зима 2011 (МСК)', 2011, 1, 15, 'Europe/Samara', 3],
    ['Ульяновск, 2015 (МСК)', 2015, 1, 15, 'Europe/Ulyanovsk', 3],
    ['Ульяновск, 2017 (МСК+1)', 2017, 1, 15, 'Europe/Ulyanovsk', 4],
    ['Волгоград, 2019 (МСК+1)', 2019, 1, 15, 'Europe/Volgograd', 4],
    ['Волгоград, 2021 (МСК)', 2021, 1, 15, 'Europe/Volgograd', 3],
    ['Москва, 1960 (декретное)', 1960, 7, 15, 'Europe/Moscow', 3],
    ['Москва, лето 1985', 1985, 7, 15, 'Europe/Moscow', 4],
  ])('%s', (_n, y, m, d, z, h) => {
    expect(at(y, m, d, 12, 0, z).offset).toBe(h * 60);
  });
  it('Самара, лето 2010 — летнее время, хотя в том году менялся пояс', () => {
    expect(at(2010, 7, 15, 12, 0, 'Europe/Samara').summer).toBe(true);
  });
  it('ночь перевода вперёд: времени не было', () => {
    expect(at(2010, 3, 28, 2, 30, 'Europe/Moscow').nonexistent).toBe(true);
    expect(at(1981, 4, 1, 0, 30, 'Asia/Yekaterinburg').nonexistent).toBe(true);
  });
  it('ночь перевода назад: время было дважды, берём первое (летнее)', () => {
    const b = at(2010, 10, 31, 2, 30, 'Europe/Moscow');
    expect(b.ambiguous).toBe(true);
    expect(b.utc.toISOString()).toBe('2010-10-30T22:30:00.000Z');
    expect(birthToUtc({ year: 2010, month: 10, day: 31, hour: 2, minute: 30, timeZone: 'Europe/Moscow' }).toISOString()).toBe('2010-10-30T22:30:00.000Z');
  });
  it('обычное время — без предупреждений', () => {
    const b = at(2000, 5, 5, 14, 20, 'Asia/Omsk');
    expect(b.nonexistent || b.ambiguous).toBe(false);
  });
  it('подписи и запасные имена поясов', () => {
    expect(offsetText(300)).toBe('UTC+5');
    expect(offsetText(330)).toBe('UTC+5:30');
    expect(offsetText(-180)).toBe('UTC−3');
    expect(isValidTimeZone(safeTimeZone('Europe/Kyiv'))).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});
