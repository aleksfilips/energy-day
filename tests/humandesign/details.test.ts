import { describe, expect, it } from 'vitest';
import { bodygraph, type BirthData } from '../../src/humandesign/chart';
import { chartStats, crossAngle, detailOf, fullActivations, quarterOf, variables } from '../../src/humandesign/details';
import { chironLongitude, cycleState, lifeCycles } from '../../src/humandesign/cycles';
import { scanDay } from '../../src/humandesign/timeScan';
import { matchPerson } from '../../src/app/screens/hd/PeopleTab';

// Ра Уру Ху: 9.04.1948 00:05, Монреаль (−05:00) — открытые данные. Сверка с макетом (Swiss Ephemeris).
const RA: BirthData = { year: 1948, month: 4, day: 9, hour: 0, minute: 5, timeZone: 'America/Montreal' };
const g = bodygraph(RA);

describe('подробности активаций (D-148)', () => {
  it('цвет · тон · база Солнца и Луны как в макете', () => {
    const { personality, design } = fullActivations(g);
    const p = (b: string) => personality.find((a) => a.body === b)!;
    const d = (b: string) => design.find((a) => a.body === b)!;
    expect([p('sun').gate, p('sun').line, p('sun').color, p('sun').tone, p('sun').base]).toEqual([51, 5, 3, 3, 4]);
    expect([p('moon').gate, p('moon').line, p('moon').color, p('moon').tone, p('moon').base]).toEqual([51, 1, 2, 1, 5]);
    expect([d('sun').gate, d('sun').line, d('sun').color, d('sun').tone, d('sun').base]).toEqual([61, 1, 4, 2, 3]);
    expect(p('sun').sign).toBe('aries');
  });
  it('границы: начало колеса — ворота 41, линия 1, всё по единице', () => {
    expect(detailOf(302.0001)).toMatchObject({ gate: 41, line: 1, color: 1, tone: 1, base: 1 });
    expect(detailOf(301.9999)).toMatchObject({ gate: 60, line: 6, color: 6, tone: 6, base: 5 });
  });
  it('переменные: стрелки по тону (1–3 влево, 4–6 вправо)', () => {
    const v = variables(g);
    expect(v.map((x) => x.key)).toEqual(['digestion', 'environment', 'motivation', 'perspective']);
    expect(v[0]!.detail.tone).toBe(2);
    expect(v[0]!.dir).toBe('left');
    expect(v[2]!.detail.tone).toBe(3);
    expect(v[2]!.dir).toBe('left');
  });
  it('четверти и статистика', () => {
    expect(quarterOf(13)).toBe('initiation');
    expect(quarterOf(24)).toBe('initiation');
    expect(quarterOf(2)).toBe('civilization');
    expect(quarterOf(7)).toBe('duality');
    expect(quarterOf(41)).toBe('mutation');
    expect(quarterOf(19)).toBe('mutation');
    const s = chartStats(g);
    expect(s.total).toBe(26);
    expect(Object.values(s.quarters).reduce((a, b) => a + b, 0)).toBe(26);
    expect(s.lines.reduce((a, b) => a + b, 0)).toBe(26);
  });
  it('угол креста по профилю', () => {
    expect(crossAngle([5, 1])).toBe('Левоугольный крест');
    expect(crossAngle([4, 1])).toBe('Джукстапозиционный крест');
    expect(crossAngle([1, 3])).toBe('Правоугольный крест');
  });
});

describe('циклы жизни (D-148)', () => {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const near = (a: Date, iso: string) => Math.abs(a.getTime() - Date.parse(iso)) <= 1.5 * 86400000;
  const c = lifeCycles(g.birthUtc);
  it('все пять циклов найдены, даты как в Swiss Ephemeris (±1 день)', () => {
    expect(c.map((x) => x.key)).toEqual(['saturn1', 'uranusOpp', 'chiron', 'saturn2', 'uranusReturn']);
    const ref: Record<string, string[]> = {
      saturn1: ['1976-10-24', '1977-01-01', '1977-07-07'],
      uranusOpp: ['1986-12-18', '1987-08-19', '1987-09-14'],
      chiron: ['1998-11-18'],
      saturn2: ['2006-08-15'],
      uranusReturn: ['2030-09-13', '2030-10-13', '2031-06-10'],
    };
    for (const x of c) {
      expect(x.exact.length, x.key).toBe(ref[x.key]!.length);
      x.exact.forEach((e, i) => expect(near(e, ref[x.key]![i]!), `${x.key} ${day(e)}`).toBe(true));
    }
    const s1 = c[0]!;
    expect(near(s1.start, '1976-09-28') && near(s1.end, '1977-07-24')).toBe(true);
    expect(Math.round(s1.ageExact * 10) / 10).toBe(28.5);
  });
  it('Хирон из таблицы: известная точка', () => {
    // Swiss Ephemeris: 1.01.2000 00:00 UT — Хирон 251,6°
    expect(chironLongitude(new Date('2000-01-01T00:00:00Z'))).toBeCloseTo(251.6, 0);
  });
  it('состояние цикла', () => {
    const s1 = c[0]!;
    expect(cycleState(s1, new Date('2026-01-01')).state).toBe('past');
    expect(cycleState(c[4]!, new Date('2026-01-01')).state).toBe('ahead');
    const mid = new Date((s1.start.getTime() + s1.end.getTime()) / 2);
    const st = cycleState(s1, mid);
    expect(st.state).toBe('now');
    expect(st.progress).toBeCloseTo(0.5, 2);
  });
});

describe('не знаю точного времени (D-148)', () => {
  it('сутки Ра: смены типа и профиля как в макете (±2 мин)', () => {
    const day = scanDay(RA);
    expect(day[0]!.from).toBe(0);
    expect(day[day.length - 1]!.to).toBe(1440);
    const groups: { k: string; from: number }[] = [];
    for (const s of day) {
      const k = `${s.chart.type} ${s.chart.profile.join('/')}`;
      if (groups[groups.length - 1]?.k !== k) groups.push({ k, from: s.from });
    }
    expect(groups.map((x) => x.k)).toEqual(['manifestor 5/1', 'manifestor 5/2', 'manifestor 6/2', 'manifesting-generator 6/2']);
    [0, 635, 818, 1269].forEach((m, i) => expect(Math.abs(groups[i]!.from - m)).toBeLessThanOrEqual(2));
    // в 00:05 — та же карта, что считается обычным путём
    const at5 = day.find((s) => 5 >= s.from && 5 < s.to)!;
    expect(at5.chart.profile).toEqual(g.profile);
  });
});

describe('поиск в «Моих людях» (D-148)', () => {
  const p = { id: 'x', name: 'Ра', birth: RA, note: 'учитель', tags: ['работа'] };
  it('профиль, канал, ворота, тип, тег, заметка', () => {
    expect(matchPerson(p, g, '5/1')).toBe(true);
    expect(matchPerson(p, g, 'профиль 2/4')).toBe(false);
    expect(matchPerson(p, g, 'манифестор')).toBe(true);
    expect(matchPerson(p, g, 'работа, учитель')).toBe(true);
    expect(matchPerson(p, g, 'семья')).toBe(false);
    expect(matchPerson(p, g, '51')).toBe(true);
    const [a, b] = g.channels[0]!;
    expect(matchPerson(p, g, `канал ${b}-${a}`)).toBe(true);
    expect(matchPerson(p, g, '')).toBe(true);
  });
});
