/**
 * Поиск места по названию: координаты и часовой пояс подставляются сами.
 *
 * Источники (оба бесплатные, без ключей, разрешают запросы из браузера):
 *  1) Open-Meteo Geocoding (база GeoNames): быстрый поиск по мере ввода, сразу даёт часовой пояс.
 *  2) Nominatim (OpenStreetMap): «искать подробнее» — находит любые деревни и посёлки.
 *     По правилам Nominatim запрос только по нажатию кнопки, не на каждую букву.
 *
 * Часовой пояс для России всегда берётся из таблицы «субъект РФ → пояс» (regions.ts),
 * потому что пояса в России установлены законом по субъектам. Если пояс из базы
 * расходится с таблицей, побеждает таблица. Подробно — DECISIONS.md, D-120…D-124.
 */
import { MULTI_ZONE_POINTS, SINGLE_ZONE_COUNTRY } from './countries';
import { farEastZone } from './fareast';
import { RU_ADMIN1_TO_ISO, RU_SUBJECT_TZ } from './regions';
import { safeTimeZone } from './timezone';

export interface Place {
  /** Название населённого пункта. */
  name: string;
  /** Уточнение: район, область, страна. */
  label: string;
  latitude: number;
  longitude: number;
  /** IANA-зона. */
  timeZone: string;
  /** Откуда взят пояс: region — таблица субъектов РФ, country — страна с одним поясом,
   * base — база мест, service — сервис по координатам, nearest — ближайший пояс страны (приблизительно),
   * device — пояс телефона (нужно проверить). */
  tzSource: 'region' | 'country' | 'base' | 'service' | 'nearest' | 'device';
  countryCode: string;
  source: 'geonames' | 'osm' | 'gps';
}

const OM_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const NOM_URL = 'https://nominatim.openstreetmap.org';
const TZ_URL = 'https://api.open-meteo.com/v1/forecast';

type Fetch = typeof fetch;
let fetchImpl: Fetch = (...a) => fetch(...a);
/** Для тестов: подменить сетевой fetch. */
export function setFetch(f: Fetch): void {
  fetchImpl = f;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetchImpl(url, { signal, headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** «Свердловская Область» → «Свердловская область» (в базе GeoNames слова с заглавной). */
export function tidyRegion(s: string | undefined | null): string {
  if (!s) return '';
  const lower = new Set(['Область', 'Край', 'Район', 'Округ', 'Автономный', 'Автономная', 'Муниципальный', 'Городской']);
  return s
    .split(' ')
    .map((w, i) => (i > 0 && lower.has(w) ? w.toLowerCase() : w))
    .join(' ');
}

const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

// ---------- Open-Meteo ----------

interface OmResult {
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  feature_code?: string;
  country_code?: string;
  country?: string;
  admin1?: string;
  admin1_id?: number;
  admin2?: string;
  population?: number;
}

/** Пояс для места из базы Open-Meteo/GeoNames с проверкой по таблице субъектов РФ. */
export function zoneForOm(r: OmResult): { timeZone: string; tzSource: Place['tzSource'] } | null {
  const cc = (r.country_code ?? '').toUpperCase();
  if (cc === 'RU' && r.admin1_id !== undefined) {
    const iso = RU_ADMIN1_TO_ISO[r.admin1_id];
    const z = iso ? RU_SUBJECT_TZ[iso] : undefined;
    if (z) return { timeZone: z, tzSource: 'region' };
    // Якутия и Сахалинская обл.: несколько поясов — по сетке границ поясов (в GeoNames там бывают устаревшие пояса).
    if (z === null) {
      const fe = farEastZone(r.latitude, r.longitude);
      if (fe) return { timeZone: fe, tzSource: 'region' };
    }
  }
  if (cc && SINGLE_ZONE_COUNTRY[cc] && cc !== 'RU') return { timeZone: SINGLE_ZONE_COUNTRY[cc]!, tzSource: 'country' };
  if (r.timezone) return { timeZone: r.timezone, tzSource: 'base' };
  return null;
}

export function fromOm(r: OmResult): Place | null {
  if (r.feature_code && !r.feature_code.startsWith('PPL')) return null;
  const z = zoneForOm(r);
  if (!z) return null;
  const parts = [r.admin2 && tidyRegion(r.admin2), tidyRegion(r.admin1), r.country].filter(Boolean) as string[];
  return {
    name: r.name,
    label: parts.join(', '),
    latitude: round(r.latitude),
    longitude: round(r.longitude),
    timeZone: safeTimeZone(z.timeZone),
    tzSource: z.tzSource,
    countryCode: (r.country_code ?? '').toUpperCase(),
    source: 'geonames',
  };
}

/** Страна телефона по его часовому поясу (чтобы свои места были в списке первыми). */
export function deviceCountry(tz: string = Intl.DateTimeFormat().resolvedOptions().timeZone): string | null {
  for (const [cc, z] of Object.entries(SINGLE_ZONE_COUNTRY)) if (z === tz) return cc;
  for (const [cc, pts] of Object.entries(MULTI_ZONE_POINTS)) if (pts.some((p) => p[0] === tz)) return cc;
  return null;
}

/** Места страны телефона — первыми, порядок внутри групп сохраняется. */
export function preferCountry(list: Place[], cc: string | null = deviceCountry()): Place[] {
  if (!cc) return list;
  return [...list.filter((p) => p.countryCode === cc), ...list.filter((p) => p.countryCode !== cc)];
}

/** Быстрый поиск (можно вызывать по мере ввода, с задержкой). */
export async function searchQuick(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${OM_URL}?${new URLSearchParams({ name: q, count: '20', language: 'ru', format: 'json' })}`;
  const data = await getJson<{ results?: OmResult[] }>(url, signal);
  return preferCountry(dedupe((data.results ?? []).map(fromOm).filter((p): p is Place => p !== null))).slice(0, 12);
}

// ---------- Nominatim (OpenStreetMap) ----------

interface NomResult {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  addresstype?: string;
  category?: string;
  type?: string;
  address?: Record<string, string>;
}

const SETTLEMENT = new Set(['city', 'town', 'village', 'hamlet', 'suburb', 'quarter', 'neighbourhood', 'isolated_dwelling', 'locality', 'municipality', 'borough', 'farm', 'allotments', 'croft']);

/** Пояс по стране и региону без сети. null — нужна помощь сервиса. */
export function zoneOffline(countryCode: string, iso2: string | undefined, lat?: number, lon?: number): { timeZone: string; tzSource: Place['tzSource'] } | null {
  const cc = countryCode.toUpperCase();
  if (cc === 'RU') {
    const code = iso2?.toUpperCase().replace(/^RU-/, '');
    const z = code ? RU_SUBJECT_TZ[code] : undefined;
    if (z) return { timeZone: z, tzSource: 'region' };
    if (z === null && lat !== undefined && lon !== undefined) {
      const fe = farEastZone(lat, lon);
      if (fe) return { timeZone: fe, tzSource: 'region' };
    }
    return null;
  }
  const single = SINGLE_ZONE_COUNTRY[cc];
  return single ? { timeZone: single, tzSource: 'country' } : null;
}

/** Ближайшая опорная точка пояса в стране — грубое приближение, только если сервис недоступен. */
export function nearestZone(countryCode: string, lat: number, lon: number): string | null {
  const pts = MULTI_ZONE_POINTS[countryCode.toUpperCase()];
  if (!pts?.length) return null;
  let best = pts[0]!;
  let bd = Infinity;
  for (const p of pts) {
    const d = distanceKm(lat, lon, p[1], p[2]);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best[0];
}

/** Пояс по координатам через сервис Open-Meteo (для стран и субъектов с несколькими поясами). */
export async function zoneByService(lat: number, lon: number, signal?: AbortSignal): Promise<string | null> {
  const url = `${TZ_URL}?${new URLSearchParams({ latitude: String(lat), longitude: String(lon), timezone: 'auto', forecast_days: '1' })}`;
  try {
    const data = await getJson<{ timezone?: string }>(url, signal);
    return data.timezone && data.timezone !== 'GMT' ? data.timezone : null;
  } catch {
    return null;
  }
}

async function resolveZone(cc: string, iso2: string | undefined, lat: number, lon: number, signal?: AbortSignal): Promise<{ timeZone: string; tzSource: Place['tzSource'] }> {
  const off = zoneOffline(cc, iso2, lat, lon);
  if (off) return off;
  const svc = await zoneByService(lat, lon, signal);
  if (svc) return { timeZone: svc, tzSource: 'service' };
  const near = nearestZone(cc, lat, lon);
  if (near) return { timeZone: near, tzSource: 'nearest' };
  return { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, tzSource: 'device' };
}

function nomLabel(a: Record<string, string> | undefined, fallback: string): string {
  if (!a) return fallback;
  const parts = [a.county ?? a.city_district ?? a.municipality, a.state ?? a.region, a.country].filter(Boolean);
  return parts.join(', ');
}

function nomName(r: NomResult): string {
  const a = r.address ?? {};
  return r.name || a.village || a.town || a.city || a.hamlet || a.suburb || r.display_name.split(',')[0]!;
}

async function fromNom(r: NomResult, signal?: AbortSignal): Promise<Place> {
  const lat = round(Number(r.lat));
  const lon = round(Number(r.lon));
  const cc = (r.address?.country_code ?? '').toUpperCase();
  const z = await resolveZone(cc, r.address?.['ISO3166-2-lvl4'], lat, lon, signal);
  return { name: nomName(r), label: nomLabel(r.address, r.display_name), latitude: lat, longitude: lon, timeZone: safeTimeZone(z.timeZone), tzSource: z.tzSource, countryCode: cc, source: 'osm' };
}

/** Подробный поиск по OpenStreetMap (только по нажатию кнопки). */
export async function searchDetailed(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${NOM_URL}/search?${new URLSearchParams({ q, format: 'jsonv2', addressdetails: '1', 'accept-language': 'ru', limit: '10' })}`;
  const data = await getJson<NomResult[]>(url, signal);
  const rows = data.filter((r) => SETTLEMENT.has(r.addresstype ?? '') || SETTLEMENT.has(r.type ?? '') || r.category === 'place');
  const places: Place[] = [];
  for (const r of rows.slice(0, 8)) places.push(await fromNom(r, signal));
  return preferCountry(dedupe(places));
}

/** Название места по координатам (для геолокации). */
export async function reverse(lat: number, lon: number, signal?: AbortSignal): Promise<Place> {
  const la = round(lat);
  const lo = round(lon);
  try {
    const url = `${NOM_URL}/reverse?${new URLSearchParams({ lat: String(la), lon: String(lo), format: 'jsonv2', addressdetails: '1', 'accept-language': 'ru', zoom: '14' })}`;
    const r = await getJson<NomResult & { error?: string }>(url, signal);
    if (r.error || !r.address) throw new Error(r.error ?? 'нет адреса');
    const a = r.address;
    const name = a.village || a.town || a.city || a.hamlet || a.suburb || a.municipality || a.county || 'Моё место';
    const cc = (a.country_code ?? '').toUpperCase();
    const z = await resolveZone(cc, a['ISO3166-2-lvl4'], la, lo, signal);
    return { name, label: nomLabel(a, ''), latitude: la, longitude: lo, timeZone: safeTimeZone(z.timeZone), tzSource: z.tzSource, countryCode: cc, source: 'gps' };
  } catch {
    const svc = await zoneByService(la, lo, signal);
    return { name: 'Моё место', label: '', latitude: la, longitude: lo, timeZone: safeTimeZone(svc ?? Intl.DateTimeFormat().resolvedOptions().timeZone), tzSource: svc ? 'service' : 'device', countryCode: '', source: 'gps' };
  }
}

// ---------- общее ----------

export const normName = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[‐-―]/g, '-').replace(/\s+/g, ' ').trim();

/** Есть ли среди найденного место с точно таким названием (первое слово запроса — название). */
export function hasExact(query: string, list: Place[]): boolean {
  const q = normName(query);
  return list.some((p) => normName(p.name) === q || q.startsWith(`${normName(p.name)} `));
}

/** Объединить: сначала точные совпадения, без повторов. */
export function mergeResults(query: string, ...lists: Place[][]): Place[] {
  const q = normName(query);
  const all = preferCountry(dedupe(lists.flat()));
  const exact = all.filter((p) => normName(p.name) === q || q.startsWith(`${normName(p.name)} `));
  return [...exact, ...all.filter((p) => !exact.includes(p))].slice(0, 12);
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Убирает повторы: одно и то же место (то же имя ближе 3 км). */
export function dedupe(list: Place[]): Place[] {
  const out: Place[] = [];
  for (const p of list) {
    if (!out.some((q) => q.name === p.name && distanceKm(p.latitude, p.longitude, q.latitude, q.longitude) < 3)) out.push(p);
  }
  return out;
}

/** Ссылка, чтобы человек сам проверил точку на карте. */
export function mapLink(lat: number, lon: number): string {
  return `https://yandex.ru/maps/?pt=${lon},${lat}&z=13&l=map`;
}
