/**
 * «Не знаю точного времени» (D-148): как меняется карта в течение дня рождения.
 * Карта считается каждые 10 минут, а каждая смена уточняется до минуты делением пополам.
 */
import { birthToUtc, bodygraphFromUtc, type BirthData, type Bodygraph } from './chart';
import { channelKey } from './graph';

export interface DaySlice {
  /** Минуты от полуночи по местному времени рождения. */
  from: number;
  to: number;
  chart: Bodygraph;
}

/** Что отличает карты: ворота, каналы, тип, авторитет, профиль, определённость и линия Луны. */
export function chartKey(g: Bodygraph): string {
  const moon = g.personality.find((a) => a.body === 'moon')!;
  return [
    [...g.gates].sort((a, b) => a - b).join(','),
    g.channels.map(channelKey).join(','),
    g.type,
    g.authority,
    g.profile.join('/'),
    g.definition,
    `${moon.gate}.${moon.line}`,
  ].join('|');
}

export function chartAtMinute(birth: BirthData, minute: number): Bodygraph {
  return bodygraphFromUtc(birthToUtc({ ...birth, hour: Math.floor(minute / 60), minute: minute % 60 }));
}

export function scanDay(birth: BirthData, stepMin = 10): DaySlice[] {
  const cache = new Map<number, Bodygraph>();
  const at = (m: number) => {
    let g = cache.get(m);
    if (!g) cache.set(m, (g = chartAtMinute(birth, m)));
    return g;
  };
  const cuts: number[] = [0];
  let prevM = 0;
  let prevK = chartKey(at(0));
  for (let m = stepMin; m <= 1439 + stepMin; m += stepMin) {
    const mm = Math.min(m, 1439);
    const k = chartKey(at(mm));
    if (k !== prevK) {
      // уточняем все смены внутри шага (их может быть несколько — ищем по минутам, шаг мал)
      let lastK = prevK;
      for (let x = prevM + 1; x <= mm; x++) {
        const kx = chartKey(at(x));
        if (kx !== lastK) {
          cuts.push(x);
          lastK = kx;
        }
      }
      prevK = k;
    }
    prevM = mm;
    if (mm === 1439) break;
  }
  return cuts.map((from, i) => ({ from, to: cuts[i + 1] ?? 1440, chart: at(from) }));
}
