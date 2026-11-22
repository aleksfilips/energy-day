/**
 * Бодиграф: «Личность» (момент рождения, чёрное) и «Дизайн» (за 88° солнечной дуги, красное).
 */
import { gateLine, type Activation } from './wheel';
import { allLongitudes, designMoment, HD_BODIES, type HdBody } from './positions';
import {
  CENTERS, MOTORS, components, connected, definedCenters, definedChannels, channelKey,
  type Center,
} from './graph';
import { birthMoment } from '../places/timezone';

export type HdType = 'generator' | 'manifesting-generator' | 'manifestor' | 'projector' | 'reflector';
export type HdAuthority = 'emotional' | 'sacral' | 'splenic' | 'ego' | 'self' | 'mental' | 'lunar';
export type HdDefinition = 'none' | 'single' | 'split' | 'triple-split' | 'quadruple-split';

export interface BirthData {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** Часовой пояс места рождения (IANA), например Asia/Yekaterinburg. */
  timeZone: string;
  /** Название места — только для подписи. */
  place?: string;
  /** Координаты места рождения — для подписи и проверки (на расчёт бодиграфа не влияют). */
  latitude?: number;
  longitude?: number;
}

export interface BodyActivation extends Activation {
  body: HdBody;
  longitude: number;
}

export interface Bodygraph {
  birthUtc: Date;
  designUtc: Date;
  personality: BodyActivation[];
  design: BodyActivation[];
  gates: Set<number>;
  channels: (readonly [number, number])[];
  centers: Set<Center>;
  type: HdType;
  authority: HdAuthority;
  profile: [number, number];
  definition: HdDefinition;
  /** Ворота креста воплощения: Солнце/Земля Личности, Солнце/Земля Дизайна. */
  cross: [number, number, number, number];
}

export function activationsAt(date: Date): BodyActivation[] {
  const lon = allLongitudes(date);
  return HD_BODIES.map((body) => ({ body, longitude: lon[body], ...gateLine(lon[body]) }));
}

export function hdType(channels: readonly (readonly [number, number])[], centers: ReadonlySet<Center>): HdType {
  if (centers.size === 0) return 'reflector';
  const motorToThroat = MOTORS.some((m) => centers.has(m) && connected(channels, m, 'throat'));
  if (centers.has('sacral')) return motorToThroat ? 'manifesting-generator' : 'generator';
  return motorToThroat ? 'manifestor' : 'projector';
}

export function hdAuthority(channels: readonly (readonly [number, number])[], centers: ReadonlySet<Center>): HdAuthority {
  if (centers.size === 0) return 'lunar';
  if (centers.has('solar')) return 'emotional';
  if (centers.has('sacral')) return 'sacral';
  if (centers.has('spleen')) return 'splenic';
  if (centers.has('heart')) return 'ego';
  if (centers.has('g') && connected(channels, 'g', 'throat')) return 'self';
  return 'mental';
}

const DEF_BY_COUNT: HdDefinition[] = ['none', 'single', 'split', 'triple-split', 'quadruple-split'];

export function bodygraphFromUtc(birthUtc: Date): Bodygraph {
  const designUtc = designMoment(birthUtc);
  const personality = activationsAt(birthUtc);
  const design = activationsAt(designUtc);
  const gates = new Set<number>([...personality, ...design].map((a) => a.gate));
  const channels = definedChannels(gates);
  const centers = definedCenters(channels);
  const pick = (arr: BodyActivation[], b: HdBody) => arr.find((a) => a.body === b)!;
  return {
    birthUtc,
    designUtc,
    personality,
    design,
    gates,
    channels,
    centers,
    type: hdType(channels, centers),
    authority: hdAuthority(channels, centers),
    profile: [pick(personality, 'sun').line, pick(design, 'sun').line],
    definition: DEF_BY_COUNT[components(channels).length] ?? 'quadruple-split',
    cross: [pick(personality, 'sun').gate, pick(personality, 'earth').gate, pick(design, 'sun').gate, pick(design, 'earth').gate],
  };
}

export function birthToUtc(b: BirthData): Date {
  // Двойное время (ночь перевода часов назад) — берётся первое, летнее; см. D-123.
  return birthMoment(b.year, b.month, b.day, b.hour, b.minute, b.timeZone).utc;
}

export function bodygraph(b: BirthData): Bodygraph {
  return bodygraphFromUtc(birthToUtc(b));
}

export function openCenters(g: Bodygraph): Center[] {
  return CENTERS.filter((c) => !g.centers.has(c));
}

export { channelKey };
