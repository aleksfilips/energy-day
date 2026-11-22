/** Карточка «Дизайн человека» на экранах «Сегодня» и «День». Данные рождения — в «Мои данные». */
import { useMemo } from 'react';
import type { DateKey } from '../../astro/time';
import { bodygraph } from '../../humandesign/chart';
import { dayTransits } from '../../humandesign/transits';
import { transitStory, type HdItem, type HdStory } from '../../humandesign/summary';
import { ABOUT } from '../../synthesis/explain';
import { useStore } from '../store';
import { Section } from './DayParts';
import { About, SubTitle } from './Explain';

/** Транзиты Дизайна человека на дату (null, если дата рождения не задана). */
export function useHdStory(date: DateKey): HdStory | null {
  const { settings, location } = useStore();
  const birth = settings.humanDesign;
  const tz = location?.timeZone;
  const chart = useMemo(() => (birth ? bodygraph(birth) : null), [birth]);
  return useMemo(() => {
    if (!chart || !tz) return null;
    try {
      return transitStory(chart, dayTransits(chart, date, tz), tz);
    } catch {
      return null;
    }
  }, [chart, date, tz]);
}

function Items({ items }: { items: HdItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((x) => (
        <div key={x.when + x.title} className="flex gap-2.5">
          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <div className="text-[15px] leading-6">
            <div>
              <span className="font-medium">{x.title}</span>
              <span className="text-faint"> · {x.when.toLowerCase()}</span>
            </div>
            <div className="text-muted">{x.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Полный разбор: тема, что включается в тебе, что приходит извне, общий фон, как прожить. */
export function HdStoryView({ story }: { story: HdStory }) {
  const { theme, mine, open, shared, type } = story;
  return (
    <div className="space-y-5">
      <About>{ABOUT.hd}</About>
      <div>
        <SubTitle>Тема дня: {theme.name}</SubTitle>
        {theme.periods.length === 1 ? (
          <p className="text-[15px] leading-6">
            Солнце сегодня в воротах {theme.gate} «{theme.name}» (по И-Цзин «{theme.iching}»): {theme.gist}. Солнце даёт основную часть «информации» дня, поэтому это общий фон для всех людей.
            {theme.mine ? ' Это и твои ворота, поэтому тема звучит лично для тебя.' : ''}
          </p>
        ) : (
          <p className="text-[15px] leading-6">
            Солнце сегодня меняет ворота: {theme.periods.map((p) => `${p.when.toLowerCase()} — ворота ${p.gate} «${p.name}»${p.mine ? ' (твои)' : ''}`).join(', ')}. Это общий фон для всех людей.
          </p>
        )}
      </div>
      {mine.length > 0 && (
        <div>
          <SubTitle>Что сегодня включается в тебе</SubTitle>
          <Items items={mine} />
        </div>
      )}
      {open.length > 0 && (
        <div>
          <SubTitle>Что приходит извне</SubTitle>
          <p className="mb-3 text-[14px] leading-5 text-muted">
            Открытый центр — место, где ты впитываешь энергию людей и дня. Сегодня планеты делают его на время определённым. Это не твоё: можно прочувствовать и понаблюдать, но решения отсюда не принимай.
          </p>
          <Items items={open} />
        </div>
      )}
      {shared.length > 0 && (
        <div>
          <SubTitle>Общий фон для всех</SubTitle>
          <Items items={shared} />
        </div>
      )}
      {mine.length + open.length + shared.length === 0 && <p className="text-[15px] leading-6">Сегодня транзиты почти не задевают твою карту. Спокойный день, чтобы быть собой.</p>}
      <div className="rounded-2xl bg-accent-soft px-4 py-3">
        <div className="text-[14px] font-medium text-accent">Как прожить день: ты {type.name.toLowerCase()}</div>
        <p className="mt-1 text-[15px] leading-6">
          Твоя стратегия — {type.strategy}. Как принимать решения: {type.authority.split(': ').slice(1).join(': ') || type.authority}. Транзиты не меняют твой тип и авторитет: всё, что они приносят, проверяй стратегией и авторитетом.
        </p>
        <p className="mt-1 text-[14px] leading-5 text-muted">
          Признак, что живёшь своим: {type.signature}. Сигнал, что живёшь не своим: {type.notSelf}.
        </p>
      </div>
    </div>
  );
}

export function HdCard({ date }: { date: DateKey }) {
  const story = useHdStory(date);
  if (!story) return null;
  return (
    <Section title="Дизайн человека сегодня">
      <HdStoryView story={story} />
    </Section>
  );
}
