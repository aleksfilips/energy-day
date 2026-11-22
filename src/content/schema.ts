/**
 * Слой Б — интерпретация (традиция, не факт). Строгие zod-схемы.
 * У каждой записи: школа-источник, согласие между школами, уверенность в передаче, флаг ревизии.
 */
import { z } from 'zod';

export const School = z.enum(['avesta', 'european', 'western', 'vedic', 'folk', 'numerology_hay', 'thun']);
export type School = z.infer<typeof School>;

export const SCHOOL_NAMES: Record<School, string> = {
  avesta: 'авестийская школа',
  european: 'европейская традиция',
  western: 'западная астрология',
  vedic: 'джйотиш',
  folk: 'народная традиция',
  numerology_hay: 'нумерология (Л. Хей)',
  thun: 'календарь М. Тун',
};

export const Level = z.enum(['high', 'medium', 'low']);
export type Level = z.infer<typeof Level>;

export const Tone = z.enum(['активная', 'созерцательная', 'переходная', 'бережная']);
export type Tone = z.infer<typeof Tone>;

const nonEmpty = z.string().trim().min(1);

const SchoolNote = z.object({ school: School, note: nonEmpty });

/** Общая «шапка» любой записи слоя Б. */
const Meta = {
  school: School,
  consensus: Level,
  confidence: Level,
  needsReview: z.boolean(),
};

const Energy = z.object({
  tone: Tone,
  intensity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

/** Общая часть «как прожить»: темы, для чего хорошо, чему уделить внимание. */
const Guidance = {
  essence: nonEmpty,
  themes: z.array(nonEmpty).min(1),
  favorable: z.array(nonEmpty).min(1),
  mindful: z.array(nonEmpty).min(1),
};

export const LunarDayEntry = z.object({
  day: z.number().int().min(1).max(30),
  symbols: z.array(nonEmpty).min(1),
  ...Guidance,
  energy: Energy,
  practice: nonEmpty,
  reflection: nonEmpty,
  body: z.string().nullable(),
  /** Традиционно «день повышенного внимания» (авестийская школа). */
  attention: z.boolean(),
  bySchool: z.array(SchoolNote),
  ...Meta,
});
export type LunarDayEntry = z.infer<typeof LunarDayEntry>;

export const PhaseEntry = z.object({
  key: z.enum([
    'new',
    'waxing_crescent',
    'first_quarter',
    'waxing_gibbous',
    'full',
    'waning_gibbous',
    'last_quarter',
    'balsamic',
  ]),
  name: nonEmpty,
  ...Guidance,
  energy: Energy,
  practice: nonEmpty,
  reflection: nonEmpty,
  bySchool: z.array(SchoolNote),
  ...Meta,
});
export type PhaseEntry = z.infer<typeof PhaseEntry>;

export const SignEntry = z.object({
  sign: z.enum([
    'aries',
    'taurus',
    'gemini',
    'cancer',
    'leo',
    'virgo',
    'libra',
    'scorpio',
    'sagittarius',
    'capricorn',
    'aquarius',
    'pisces',
  ]),
  name: nonEmpty,
  element: z.enum(['fire', 'earth', 'air', 'water']),
  ...Guidance,
  /** Окраска дня в родительном падеже: «Луна в Тельце добавляет дню устойчивости и телесности». */
  coloring: nonEmpty,
  body: z.string().nullable(),
  bySchool: z.array(SchoolNote),
  ...Meta,
});
export type SignEntry = z.infer<typeof SignEntry>;

export const SpecialEntry = z.object({
  key: z.enum(['voc', 'eclipse_solar', 'eclipse_lunar', 'eclipse_corridor', 'perigee', 'apogee', 'supermoon', 'micromoon']),
  title: nonEmpty,
  ...Guidance,
  /** Короткая строка для карточки дня. */
  short: nonEmpty,
  /** Как это считается (для «Почему так?» и справки). */
  howCalculated: nonEmpty,
  bySchool: z.array(SchoolNote),
  ...Meta,
});
export type SpecialEntry = z.infer<typeof SpecialEntry>;

export const TithiEntry = z.object({
  number: z.number().int().min(1).max(30),
  name: nonEmpty,
  /** Традиционная группа титхи: нанда, бхадра, джая, рикта, пурна. */
  group: z.enum(['nanda', 'bhadra', 'jaya', 'rikta', 'purna']),
  essence: nonEmpty,
  favorable: z.array(nonEmpty).min(1),
  mindful: z.array(nonEmpty).min(1),
  ...Meta,
});
export type TithiEntry = z.infer<typeof TithiEntry>;

export const NakshatraEntry = z.object({
  number: z.number().int().min(1).max(27),
  name: nonEmpty,
  /** Управитель по системе вимшоттари. */
  ruler: nonEmpty,
  deity: nonEmpty,
  symbol: nonEmpty,
  essence: nonEmpty,
  favorable: z.array(nonEmpty).min(1),
  mindful: z.array(nonEmpty).min(1),
  ...Meta,
});
export type NakshatraEntry = z.infer<typeof NakshatraEntry>;

export const PersonalNumberEntry = z.object({
  number: z.number().int().min(1).max(22),
  essence: nonEmpty,
  theme: nonEmpty,
  /** Одна фраза для карточки «Энергия дня». */
  note: nonEmpty,
  favorable: z.array(nonEmpty).min(1),
  /** Что значит этот день простыми словами (2–3 фразы). */
  about: nonEmpty,
  /** Чего лучше избегать. */
  mindful: z.array(nonEmpty).min(1),
  /** Один практический совет на день. */
  tip: nonEmpty,
  color: z.object({ name: nonEmpty, hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
  affirmation: nonEmpty,
  ...Meta,
});
export type PersonalNumberEntry = z.infer<typeof PersonalNumberEntry>;

export const GardenEntry = z.object({
  key: z.enum(['root', 'leaf', 'flower', 'fruit']),
  title: nonEmpty,
  essence: nonEmpty,
  plants: z.array(nonEmpty).min(1),
  favorable: z.array(nonEmpty).min(1),
  ...Meta,
});
export type GardenEntry = z.infer<typeof GardenEntry>;

export const COLLECTIONS = {
  'lunar-days': { schema: LunarDayEntry, count: 30, id: (e: LunarDayEntry) => String(e.day) },
  phases: { schema: PhaseEntry, count: 8, id: (e: PhaseEntry) => e.key },
  signs: { schema: SignEntry, count: 12, id: (e: SignEntry) => e.sign },
  special: { schema: SpecialEntry, count: 8, id: (e: SpecialEntry) => e.key },
  tithis: { schema: TithiEntry, count: 30, id: (e: TithiEntry) => String(e.number) },
  nakshatras: { schema: NakshatraEntry, count: 27, id: (e: NakshatraEntry) => String(e.number) },
  'personal-numbers': { schema: PersonalNumberEntry, count: 11, id: (e: PersonalNumberEntry) => String(e.number) },
  garden: { schema: GardenEntry, count: 4, id: (e: GardenEntry) => e.key },
} as const;

export type CollectionName = keyof typeof COLLECTIONS;
