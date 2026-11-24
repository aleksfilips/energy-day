/**
 * Подробности карты (D-148): цвет · тон · база, знак, ретроградность, четверти мандалы,
 * распределение активаций по контурам, четвертям и линиям, переменные (стрелки).
 */
import { norm180, norm360 } from '../astro/search';
import type { Bodygraph, BodyActivation } from './chart';
import { hdLongitude, type HdBody } from './positions';
import { GATE_ORDER, GATE_SPAN, LINE_SPAN, WHEEL_START } from './wheel';

export const COLOR_SPAN = LINE_SPAN / 6;
export const TONE_SPAN = COLOR_SPAN / 6;
export const BASE_SPAN = TONE_SPAN / 5;

export const SIGN_KEYS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'] as const;
export type SignKey = (typeof SIGN_KEYS)[number];
export const SIGN_RU: Record<SignKey, string> = {
  aries: 'Овен', taurus: 'Телец', gemini: 'Близнецы', cancer: 'Рак', leo: 'Лев', virgo: 'Дева',
  libra: 'Весы', scorpio: 'Скорпион', sagittarius: 'Стрелец', capricorn: 'Козерог', aquarius: 'Водолей', pisces: 'Рыбы',
};
export const SIGN_GLYPH: Record<SignKey, string> = {
  aries: '♈', taurus: '♉', gemini: '♊', cancer: '♋', leo: '♌', virgo: '♍', libra: '♎', scorpio: '♏', sagittarius: '♐', capricorn: '♑', aquarius: '♒', pisces: '♓',
};

export interface Detail {
  gate: number;
  line: number;
  color: number;
  tone: number;
  base: number;
  sign: SignKey;
  /** Градусы внутри знака. */
  degree: number;
}

export function detailOf(longitude: number): Detail {
  const off = norm360(longitude - WHEEL_START);
  const gi = Math.floor(off / GATE_SPAN);
  const inGate = off - gi * GATE_SPAN;
  const li = Math.min(5, Math.floor(inGate / LINE_SPAN));
  const inLine = inGate - li * LINE_SPAN;
  const ci = Math.min(5, Math.floor(inLine / COLOR_SPAN));
  const inColor = inLine - ci * COLOR_SPAN;
  const ti = Math.min(5, Math.floor(inColor / TONE_SPAN));
  const inTone = inColor - ti * TONE_SPAN;
  const bi = Math.min(4, Math.floor(inTone / BASE_SPAN));
  const lon = norm360(longitude);
  return { gate: GATE_ORDER[gi]!, line: li + 1, color: ci + 1, tone: ti + 1, base: bi + 1, sign: SIGN_KEYS[Math.floor(lon / 30)]!, degree: lon % 30 };
}

/** Ретроградность считается только для планет (у Солнца, Земли, Луны и узлов её не показывают). */
const RETRO_BODIES: ReadonlySet<HdBody> = new Set(['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']);
export function isRetrograde(body: HdBody, date: Date): boolean {
  if (!RETRO_BODIES.has(body)) return false;
  const H = 3600000;
  return norm180(hdLongitude(body, new Date(date.getTime() + H)) - hdLongitude(body, new Date(date.getTime() - H))) < 0;
}

export interface FullActivation extends BodyActivation, Detail {
  retro: boolean;
}

export function fullActivations(chart: Bodygraph): { personality: FullActivation[]; design: FullActivation[] } {
  const f = (list: BodyActivation[], t: Date) => list.map((a) => ({ ...a, ...detailOf(a.longitude), retro: isRetrograde(a.body, t) }));
  return { personality: f(chart.personality, chart.birthUtc), design: f(chart.design, chart.designUtc) };
}

// ---------- четверти мандалы ----------
export type Quarter = 'initiation' | 'civilization' | 'duality' | 'mutation';
export const QUARTERS: readonly Quarter[] = ['initiation', 'civilization', 'duality', 'mutation'];
/** Четверть по воротам: Инициация — от 13 до 24, Цивилизация — от 2 до 33, Дуальность — от 7 до 44, Мутация — от 1 до 19. */
export function quarterOf(gate: number): Quarter {
  const i = GATE_ORDER.indexOf(gate);
  return i >= 2 && i < 18 ? 'initiation' : i >= 18 && i < 34 ? 'civilization' : i >= 34 && i < 50 ? 'duality' : 'mutation';
}
/** Тексты четвертей — по курсу (1-й уровень, «Синтез: Дизайн человека, генетика и мандала»). */
export const QUARTER_TEXT: Record<Quarter, { name: string; gen: string; purpose: string; theme: string }> = {
  initiation: { name: 'Инициация', gen: 'Инициации', purpose: 'Предназначение, реализуемое через ум', theme: 'Расширение сознания. Свидетель возвращается. Попытка организовать мир ментально.' },
  civilization: { name: 'Цивилизация', gen: 'Цивилизации', purpose: 'Предназначение, реализуемое через форму', theme: 'Из лона матери в лоно природы. Попытка организовать мир через форму.' },
  duality: { name: 'Дуальность', gen: 'Дуальности', purpose: 'Предназначение, реализуемое через установление связей', theme: 'Око за око, зуб за зуб. Попытка организовать мир через отношения.' },
  mutation: { name: 'Мутация', gen: 'Мутации', purpose: 'Предназначение, реализуемое через трансформацию', theme: 'Нести трансформацию другим. Принятие смерти. Попытка реорганизовать мир (и себя).' },
};

// ---------- контуры ----------
export type CircuitGroup = 'individual' | 'collective' | 'tribal' | 'integration';
export const CIRCUIT_GROUPS: readonly CircuitGroup[] = ['individual', 'collective', 'tribal', 'integration'];
export const CIRCUIT_NAME: Record<CircuitGroup, string> = { individual: 'Индивидуальный', collective: 'Коллективный', tribal: 'Племенной', integration: 'Интеграция' };
/** Каналы по группам контуров (по «Полному руководству по контурам, каналам и воротам»). */
export const CIRCUIT_CHANNELS: Record<CircuitGroup, readonly string[]> = {
  // Знание (9) и Центрирование (2)
  individual: ['1-8', '2-14', '3-60', '12-22', '23-43', '24-61', '28-38', '39-55', '20-57', '10-34', '25-51'],
  // Понимание (логика, 7) и Ощущение (абстракция, 7)
  collective: ['4-63', '5-15', '7-31', '9-52', '16-48', '17-62', '18-58', '11-56', '13-33', '29-46', '30-41', '35-36', '42-53', '47-64'],
  // Эго (5) и Защита (2)
  tribal: ['19-49', '21-45', '26-44', '32-54', '37-40', '6-59', '27-50'],
  integration: ['10-20', '20-34', '34-57', '10-57'],
};
const GATE_GROUPS = new Map<number, Set<CircuitGroup>>();
for (const g of CIRCUIT_GROUPS)
  for (const k of CIRCUIT_CHANNELS[g])
    for (const n of k.split('-').map(Number)) {
      if (!GATE_GROUPS.has(n)) GATE_GROUPS.set(n, new Set());
      GATE_GROUPS.get(n)!.add(g);
    }
export const circuitGroupsOf = (gate: number): Set<CircuitGroup> => GATE_GROUPS.get(gate) ?? new Set();

export interface ChartStats {
  total: number;
  circuits: Record<CircuitGroup, number>;
  quarters: Record<Quarter, number>;
  lines: number[]; // индекс 0 — линия 1
}

/** Распределение всех 26 активаций. Ворота на стыке контуров считаются в каждом из них. */
export function chartStats(chart: Bodygraph): ChartStats {
  const all = [...chart.personality, ...chart.design];
  const circuits = { individual: 0, collective: 0, tribal: 0, integration: 0 } as Record<CircuitGroup, number>;
  const quarters = { initiation: 0, civilization: 0, duality: 0, mutation: 0 } as Record<Quarter, number>;
  const lines = [0, 0, 0, 0, 0, 0];
  for (const a of all) {
    for (const g of circuitGroupsOf(a.gate)) circuits[g]++;
    quarters[quarterOf(a.gate)]++;
    lines[a.line - 1]!++;
  }
  return { total: all.length, circuits, quarters, lines };
}

// ---------- переменные ----------
export type VariableKey = 'digestion' | 'environment' | 'motivation' | 'perspective';
export interface Variable {
  key: VariableKey;
  name: string;
  /** Откуда берётся: «Солнце Дизайна» и т.п. */
  from: string;
  side: 'design' | 'personality';
  detail: Detail;
  dir: 'left' | 'right';
}
export function variables(chart: Bodygraph): Variable[] {
  const pick = (list: BodyActivation[], b: HdBody) => detailOf(list.find((a) => a.body === b)!.longitude);
  const mk = (key: VariableKey, name: string, from: string, side: Variable['side'], d: Detail): Variable => ({ key, name, from, side, detail: d, dir: d.tone <= 3 ? 'left' : 'right' });
  return [
    mk('digestion', 'Пищеварение', 'Солнце Дизайна', 'design', pick(chart.design, 'sun')),
    mk('environment', 'Окружение', 'Узлы Дизайна', 'design', pick(chart.design, 'northNode')),
    mk('motivation', 'Мотивация', 'Солнце Личности', 'personality', pick(chart.personality, 'sun')),
    mk('perspective', 'Перспектива', 'Узлы Личности', 'personality', pick(chart.personality, 'northNode')),
  ];
}

/** Угол креста по профилю: 1–4 правый, 4/1 джукстапозиция, 5–6 левый. */
export function crossAngle(profile: readonly [number, number]): string {
  if (profile[0] === 4 && profile[1] === 1) return 'Джукстапозиционный крест';
  return profile[0] >= 5 ? 'Левоугольный крест' : 'Правоугольный крест';
}
