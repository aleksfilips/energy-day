/**
 * «Личный день» по Луизе Хей (нумерология, личный слой).
 * Классическая пифагорейская схема. Формула калькулятора astromeridian.ru не
 * раскрыта, поэтому варианты вынесены в опции и сверяются с fixtures/personal-day.json.
 */

export interface NumerologyOptions {
  /** Сохранять мастер-числа 11 и 22 при сведении. По умолчанию false. */
  masterNumbers: boolean;
  /**
   * Как складывать год: 'digits' — по цифрам (2+0+2+6), 'whole' — целиком (2026 → свести).
   * Без мастер-чисел результат одинаковый; с мастер-числами может различаться.
   */
  yearMode: 'digits' | 'whole';
  /** Когда меняется личный год: 1 января или в день рождения. По умолчанию 1 января. */
  yearSwitch: 'jan1' | 'birthday';
}

export const DEFAULT_NUMEROLOGY: NumerologyOptions = {
  masterNumbers: false,
  yearMode: 'digits',
  yearSwitch: 'jan1',
};

export function digitSum(n: number): number {
  return String(Math.abs(Math.trunc(n)))
    .split('')
    .reduce((s, c) => s + Number(c), 0);
}

/** Сведение: сумма цифр, пока не останется одна цифра (или мастер-число). */
export function reduce(n: number, masterNumbers = false): number {
  let x = Math.abs(Math.trunc(n));
  while (x > 9) {
    if (masterNumbers && (x === 11 || x === 22)) return x;
    x = digitSum(x);
  }
  return x;
}

export interface Birthday {
  day: number; // 1..31
  month: number; // 1..12
}

export interface PersonalNumbers {
  year: number;
  month: number;
  day: number;
}

/** Дата расчёта — календарная дата (год, месяц 1..12, число). */
export function personalNumbers(
  birth: Birthday,
  date: { year: number; month: number; day: number },
  opts: NumerologyOptions = DEFAULT_NUMEROLOGY,
): PersonalNumbers {
  const m = opts.masterNumbers;
  let calcYear = date.year;
  if (opts.yearSwitch === 'birthday') {
    const beforeBirthday = date.month < birth.month || (date.month === birth.month && date.day < birth.day);
    if (beforeBirthday) calcYear -= 1;
  }
  const yearPart = opts.yearMode === 'digits' ? digitSum(calcYear) : reduce(calcYear, m);
  const year = reduce(digitSum(birth.month) + digitSum(birth.day) + yearPart, m);
  const month = reduce(year + date.month, m);
  const day = reduce(month + date.day, m);
  return { year, month, day };
}

export function personalDay(
  birth: Birthday,
  date: { year: number; month: number; day: number },
  opts: NumerologyOptions = DEFAULT_NUMEROLOGY,
): number {
  return personalNumbers(birth, date, opts).day;
}
