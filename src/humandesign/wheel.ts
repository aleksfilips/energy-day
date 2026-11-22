/**
 * Колесо Дизайна человека: 64 ворот по 5,625° на тропической эклиптике.
 * Ворота 41 начинаются на 2°00' Водолея (302° тропической долготы),
 * дальше ворота идут по ходу зодиака в порядке «мандалы».
 * Каждые ворота делятся на 6 линий по 0,9375°.
 */
import { norm360 } from '../astro/search';

export const WHEEL_START = 302;
export const GATE_SPAN = 360 / 64; // 5.625
export const LINE_SPAN = GATE_SPAN / 6; // 0.9375

export const GATE_ORDER: readonly number[] = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15,
  52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14, 34, 9,
  5, 26, 11, 10, 58, 38, 54, 61, 60,
];

export interface Activation {
  gate: number;
  line: number; // 1..6
  /** Насколько далеко (в градусах) ближайшая граница линии: мера «надёжности» результата. */
  marginDeg: number;
}

export function gateLine(longitude: number): Activation {
  const offset = norm360(longitude - WHEEL_START);
  const gi = Math.floor(offset / GATE_SPAN);
  const inGate = offset - gi * GATE_SPAN;
  const li = Math.min(5, Math.floor(inGate / LINE_SPAN));
  const inLine = inGate - li * LINE_SPAN;
  return {
    gate: GATE_ORDER[gi]!,
    line: li + 1,
    marginDeg: Math.min(inLine, LINE_SPAN - inLine),
  };
}

/** Начальная тропическая долгота ворот (для тестов и справки). */
export function gateStartLongitude(gate: number): number {
  const i = GATE_ORDER.indexOf(gate);
  if (i < 0) throw new Error(`Нет таких ворот: ${gate}`);
  return norm360(WHEEL_START + i * GATE_SPAN);
}
