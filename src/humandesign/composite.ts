/**
 * Совместимость двух карт (D-143). Источники — материалы владельца:
 *  Ра Уру Ху, «Книга любви» (далее «КЛ», страницы — печатные номера книги);
 *  «Определённости и разрывы» (PTL1.1, 2025).
 * Виды связи по каналам (КЛ, с. 55):
 *  электромагнит — у одного один конец канала, у другого другой;
 *  доминанта — у одного канал целиком, у другого в нём ничего;
 *  компромисс — у одного канал целиком, у другого только одни ворота этого канала;
 *  общий канал — канал целиком у обоих. В КЛ отдельного раздела нет, текст — по главе
 *  «Центры: основа для отношений» (с. 79–80): общая определённость = похожесть и комфорт.
 * Смыслы каналов — из курса (humandesign.json, D-131).
 */
import { CENTERS, CHANNELS, channelKey, components, definedCenters, type Center } from './graph';
import { hdType, type Bodygraph, type HdType } from './chart';
import type { GraphLayer } from './overlay';

export type LinkKind = 'electromagnetic' | 'companionship' | 'dominance' | 'compromise';

export interface Link {
  key: string;
  gates: readonly [number, number];
  kind: LinkKind;
  /** Для доминирования и компромисса — у кого канал целиком. */
  holder?: 'a' | 'b';
}

export interface Composite {
  links: Link[];
  /** Центры, определённые вместе (у кого-то с рождения или собранные связью). */
  centers: Center[];
  /** Центры, которые открыты у обоих и остаются открытыми вместе. */
  open: Center[];
  type: HdType;
}

const has = (g: Bodygraph, gate: number) => g.gates.has(gate);

export function composite(a: Bodygraph, b: Bodygraph): Composite {
  const links: Link[] = [];
  for (const ch of CHANNELS) {
    const [x, y] = ch;
    const aFull = has(a, x) && has(a, y);
    const bFull = has(b, x) && has(b, y);
    const aAny = has(a, x) || has(a, y);
    const bAny = has(b, x) || has(b, y);
    const key = channelKey(ch);
    if (aFull && bFull) links.push({ key, gates: ch, kind: 'companionship' });
    else if (aFull) links.push({ key, gates: ch, kind: bAny ? 'compromise' : 'dominance', holder: 'a' });
    else if (bFull) links.push({ key, gates: ch, kind: aAny ? 'compromise' : 'dominance', holder: 'b' });
    else if ((has(a, x) && has(b, y)) || (has(a, y) && has(b, x))) links.push({ key, gates: ch, kind: 'electromagnetic' });
  }
  const all = new Set([...a.gates, ...b.gates]);
  const channels = CHANNELS.filter(([x, y]) => all.has(x) && all.has(y));
  const centers = definedCenters(channels);
  return {
    links,
    centers: CENTERS.filter((c) => centers.has(c)),
    open: CENTERS.filter((c) => !centers.has(c)),
    type: hdType(channels, centers),
  };
}

/** Слой для бодиграфа: ворота партнёра и то, что его ворота добавляют к моей карте. */
export function partnerLayer(me: Bodygraph, partner: Bodygraph): GraphLayer {
  const gates: GraphLayer['gates'] = {};
  for (const g of partner.gates) gates[g] = ['sun'];
  const natal = new Set(me.channels.map(channelKey));
  const all = new Set([...me.gates, ...partner.gates]);
  const chs = CHANNELS.filter(([x, y]) => all.has(x) && all.has(y) && !natal.has(channelKey([x, y])));
  const centers = definedCenters([...me.channels, ...chs]);
  return { gates, channels: chs.map(channelKey), centers: CENTERS.filter((c) => centers.has(c) && !me.centers.has(c)) };
}

/** Десять ворот любви (КЛ): четверо в G-центре и шесть «мирских». */
export const LOVE_GATES: ReadonlySet<number> = new Set([10, 15, 25, 46, 58, 41, 55, 40, 44, 28]);
export const isLoveLink = (l: Link) => LOVE_GATES.has(l.gates[0]) || LOVE_GATES.has(l.gates[1]);

/** Центры, определённые у обоих с рождения: основа отношений (КЛ, с. 79–83). */
export function sharedCenters(a: Bodygraph, b: Bodygraph): Center[] {
  return CENTERS.filter((c) => a.centers.has(c) && b.centers.has(c));
}

/** Угол профиля (КЛ, с. 85–87): правый — личная судьба, левый — трансперсональная, 4/1 — джукстапозиция. */
export type Angle = 'right' | 'juxta' | 'left';
export function profileAngle(p: readonly [number, number]): Angle {
  if (p[0] === 4 && p[1] === 1) return 'juxta';
  return p[0] >= 5 ? 'left' : 'right';
}

const HARMONIC: Record<number, number> = { 1: 4, 4: 1, 2: 5, 5: 2, 3: 6, 6: 3 };

/**
 * Мостик между профилями (КЛ, с. 87): к своим двум линиям добавить гармоничные (1–4, 2–5, 3–6);
 * у кого в профиле есть одна из этих цифр — с тем есть мостик. Одинаковая линия — резонанс, гармоничная — гармония.
 */
export interface ProfileBridge {
  resonance: number[];
  harmony: [number, number][];
}
export function profileBridge(a: Bodygraph, b: Bodygraph): ProfileBridge | null {
  const mine = new Set(a.profile);
  const theirs = [...new Set(b.profile)];
  const resonance = theirs.filter((l) => mine.has(l));
  const harmony: [number, number][] = [];
  for (const l of theirs) for (const m of mine) if (HARMONIC[m] === l) harmony.push([m, l]);
  return resonance.length || harmony.length ? { resonance, harmony } : null;
}

/**
 * Мостики в моём разрыве («Определённости и разрывы»): чего мне не хватает, чтобы части определённости
 * соединились, и что из этого приносит партнёр. Одни ворота — простой разрыв, целый канал — широкий.
 */
export interface SplitBridges {
  /** Ворота партнёра, которые одни соединяют мои части. */
  gates: number[];
  /** Каналы партнёра целиком, которые соединяют мои части (у меня в них ворот нет). */
  channels: string[];
  /** Вместе моя определённость становится одной целой. */
  whole: boolean;
}
export function splitBridges(me: Bodygraph, partner: Bodygraph): SplitBridges | null {
  const parts = components(me.channels).length;
  if (parts < 2) return null;
  const gates = new Set<number>();
  const channels: string[] = [];
  for (const ch of CHANNELS) {
    const [x, y] = ch;
    const mx = me.gates.has(x);
    const my = me.gates.has(y);
    if (mx && my) continue;
    if (components([...me.channels, ch]).length >= parts) continue;
    if (mx !== my) {
      const missing = mx ? y : x;
      if (partner.gates.has(missing)) gates.add(missing);
    } else if (partner.gates.has(x) && partner.gates.has(y)) channels.push(channelKey(ch));
  }
  const all = new Set([...me.gates, ...partner.gates]);
  const together = CHANNELS.filter(([x, y]) => all.has(x) && all.has(y));
  const mine = new Set(me.centers);
  const joined = components(together).filter((comp) => comp.some((c) => mine.has(c)));
  return { gates: [...gates].sort((p, q) => p - q), channels, whole: joined.length === 1 };
}

/** Тексты видов связи — по «Книге любви» Ра Уру Ху, у каждого указан источник. */
export const LINK_TEXT: Record<LinkKind, { title: string; text: string; source: string }> = {
  electromagnetic: {
    title: 'Электромагнит',
    text: 'У тебя один конец канала, у партнёра другой, и вместе вы его замыкаете. Это притяжение и отвержение одновременно: то, что тянет вас друг к другу, может и отталкивать. Ра называет это «любовь/ненависть» и подчёркивает: это не значит, что вам что-то не нравится, это просто работа механизма. Электромагнит даёт искру и держит отношения «наэлектризованными», но сам по себе никогда их не заканчивает.',
    source: '«Книга любви», с. 55, 62–63',
  },
  companionship: {
    title: 'Общий канал',
    text: 'Этот канал есть у вас обоих целиком, и его центры определены у каждого. Ра говорит, что там, где у двоих одинаковая определённость, возникает похожесть: «Ага! Он такой же, как я». Это место комфорта без напряжения, где вы можете встречаться и вместе решать возникающие вопросы.',
    source: '«Книга любви», с. 79–80 (отдельного вида «общий канал» в книге нет, текст по главе об общих центрах)',
  },
  dominance: {
    title: 'Доминанта',
    text: 'Канал целиком есть у одного из вас, а у другого в нём нет ни одних ворот. Все думают, что это ужасно, но это не так: в этой теме ты видишь человека таким, какой он есть, и знаешь в нём нечто устойчивое. Это его постоянная черта, её невозможно изменить. Ложное «я» воспринимает доминанту как невыносимое «он всегда делает так, как хочет», а в принятии она даёт знание другого.',
    source: '«Книга любви», с. 55, 60–62',
  },
  compromise: {
    title: 'Компромисс',
    text: 'У одного канал целиком, у другого только одни ворота этого канала. Ра называет это самым трудным видом связи: здесь в конце концов приходится делать так, как решил тот, у кого канал целиком, и это место, где ложное «я» доходит до предела. Именно компромисс показывает, что может разрушить отношения. Но если вы понимаете происходящее и каждый живёт свою природу, это становится совсем другой историей.',
    source: '«Книга любви», с. 55, 62–64, 66',
  },
};

/** Короткие тексты остальных разделов, тоже с источником. */
export const PAIR_TEXT = {
  shared: {
    text: 'С этого Ра советует начинать: прежде чем смотреть на каналы и ворота любви, посмотреть на центры, определённые у обоих. Здесь у вас одинаковая частота и твёрдая почва под ногами, это фундамент отношений и место, где вы можете спокойно решать вопросы. Даже один общий центр уже всё облегчает.',
    none: 'Центров, определённых у обоих, нет. По Ра это значит, что общую основу вы находите не через одинаковую определённость, а через мостики профиля и через то, что каждый живёт по своей стратегии.',
    source: '«Книга любви», с. 79–83',
  },
  love: {
    text: 'Отмечены связи через ворота любви. Электромагнит в воротах любви Ра называет «настоящей зажигалкой». При этом он просит не начинать чтение с ворот любви: важнее, чтобы каждый жил свою природу.',
    source: '«Книга любви», с. 65, 92',
  },
  profile: {
    bridge: 'Между вашими профилями есть мостик. По Ра это одна из самых базовых вещей в паре: настоящее основание там, где вам вместе комфортно, где вы встречаетесь. Резонанс (одинаковая линия) и гармония (1 и 4, 2 и 5, 3 и 6) одинаково хороши.',
    noBridge: 'Мостика между профилями нет: у вас нет ни одинаковых, ни гармоничных линий (1 и 4, 2 и 5, 3 и 6). Ра говорит, что тогда в этой части вы не встречаетесь, и опора отношений ищется в другом: в общих центрах и в верности своей стратегии.',
    angles: 'Правый и левый угол по Ра очень разные, и у разных углов связь держится только через мостик.',
    source: '«Книга любви», с. 85–88',
  },
  types: {
    same: 'У вас один тип. По Ра тип тянется к своему типу: здесь естественная похожесть, комфорт и лёгкость.',
    diff: 'У вас разные типы. Ра говорит, что различия типов остаются всегда, и единственный мостик между ними — стратегия каждого. Когда оба входят в отношения корректно, различия становятся тем, чему вы учите друг друга.',
    source: '«Книга любви», с. 89–91',
  },
  definition: {
    single: '«Мне никто не нужен» по дизайну: у тебя цельная определённость, и отношения не дают тебе чувства целостности. Ты будешь учиться быть с другими.',
    split: 'У тебя разделённая определённость. Для тебя «ты нужен мне» — реальность, но это не значит «я не могу без тебя». Отношения для тебя важная часть жизни, и ты можешь учить других быть в партнёрстве. Главное здесь — ворота-мостики: к ним огромное притяжение, и человек ведёт себя так, будто они у него определены.',
    multi: 'У тебя тройная или четверная определённость: важны связи с разными людьми и свобода передвижения, один человек не соединяет всё сразу.',
    none: 'У тебя нет определённых центров, поэтому мостиков в определённости нет.',
    simple: 'Простой разрыв (не хватает одних ворот): «это моя задача, я сам её решу».',
    wide: 'Широкий разрыв (нужен целый канал): есть склонность ждать, что партнёр принесёт недостающее.',
    source: '«Определённости и разрывы», PTL1.1, 2025',
  },
} as const;
