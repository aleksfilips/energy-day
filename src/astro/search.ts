import { MakeTime, Search, type AstroTime } from 'astronomy-engine';

/** Приведение угла к [0, 360). */
export function norm360(deg: number): number {
  const x = deg % 360;
  return x < 0 ? x + 360 : x;
}

/** Приведение угла к [-180, 180). */
export function norm180(deg: number): number {
  return norm360(deg + 180) - 180;
}

export function toAstro(d: Date): AstroTime {
  return MakeTime(d);
}

/** Точность всех численных поисков: 1 секунда. Отображение округляется до минуты. */
export const SEARCH_TOLERANCE_SECONDS = 1;

/**
 * Возрастающий корень f на [t1, t2] (f(t1) ≤ 0 < f(t2)).
 * Обёртка над astronomy-engine Search, работающая с Date.
 */
export function refineAscendingRoot(f: (d: Date) => number, t1: Date, t2: Date): Date | null {
  const res = Search((t: AstroTime) => f(t.date), toAstro(t1), toAstro(t2), {
    dt_tolerance_seconds: SEARCH_TOLERANCE_SECONDS,
  });
  return res ? res.date : null;
}

/**
 * Все моменты, когда растущий угол angleFn(t) проходит через целевые значения
 * targets (градусы) в окне [start, end).
 *
 * Требование: угол растёт монотонно и за один шаг step меняется меньше чем на 90°.
 * Это верно для долготы Луны и для разности долгот «Луна − планета»:
 * Луна никогда не бывает ретроградной и всегда быстрее любой планеты.
 */
export function findAngleCrossings(
  angleFn: (d: Date) => number,
  targets: readonly number[],
  start: Date,
  end: Date,
  stepMs: number,
): { time: Date; target: number }[] {
  const out: { time: Date; target: number }[] = [];
  // Сетка шагов привязана к абсолютному времени, а не к началу окна:
  // тогда один и тот же переход даёт бит-в-бит одинаковый момент при любом окне.
  let a = new Date(Math.floor(start.getTime() / stepMs) * stepMs);
  let angA = angleFn(a);
  while (a < end) {
    const b = new Date(a.getTime() + stepMs);
    const angB = angleFn(b);
    for (const target of targets) {
      const fa = norm180(angA - target);
      const fb = norm180(angB - target);
      // Переход через цель снизу вверх, а не через скачок ±180.
      if (fa < 0 && fb >= 0 && fb - fa < 90) {
        const f = (d: Date) => norm180(angleFn(d) - target);
        const t = fb === 0 ? b : refineAscendingRoot(f, a, b);
        if (t && t >= start && t < end) out.push({ time: t, target });
      }
    }
    a = b;
    angA = angB;
  }
  out.sort((x, y) => x.time.getTime() - y.time.getTime());
  return out;
}

/**
 * Момент смены значения дискретной функции на (a, b], найденный бисекцией.
 * Возвращает первый момент, где значение уже отличается от fn(a).
 */
export function bisectChange<T>(fn: (d: Date) => T, a: Date, b: Date, toleranceMs = 1000): Date {
  const va = fn(a);
  let lo = a.getTime();
  let hi = b.getTime();
  while (hi - lo > toleranceMs) {
    const mid = Math.floor((lo + hi) / 2);
    if (fn(new Date(mid)) === va) lo = mid;
    else hi = mid;
  }
  return new Date(hi);
}
