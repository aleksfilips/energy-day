import { useMemo, useState } from 'react';
import { dayPlan, lifeAreas } from '../../synthesis/life';
import { dayAreas } from '../../synthesis/areas';
import { humanDate } from '../format';
import { useDay, useNow, useToday } from '../hooks';
import { useStore } from '../store';
import { Card } from '../ui';
import { WhySheet } from './EnergyCard';
import { AreaGrid, DayStorySheet, HeroCard, MoreTiles, TimeStrip } from './Compact';
import { WeekAhead } from './Pick';
import { ShareDay } from './ShareDay';
import { HdSpotlight } from './HdCard';
import type { Nav } from '../App';

export function TodayScreen({ nav, openUpcoming }: { nav: Nav; openUpcoming: () => void }) {
  const { location, content } = useStore();
  const today = useToday();
  const now = useNow();
  const data = useDay(today);
  const [why, setWhy] = useState(false);
  const [more, setMore] = useState(false);
  const extra = useMemo(() => (data ? { plan: dayPlan(data.model, data.card, content), areas: lifeAreas(data.model), verdicts: dayAreas(data.model) } : null), [data, content]);
  if (!location || !data || !extra) return null;
  const { model, card } = data;

  // Сегодня модель дня собрана «на сейчас» (D-149): model.dominant — лунный день, который идёт прямо сейчас.
  const current = model.dominant;
  const endsToday = current.end < model.bounds.end;
  const wd = humanDate(today).split(', ')[1]!;

  return (
    <div className="space-y-3 pb-6">
      <header className="rise-in flex items-end justify-between pt-3">
        <div>
          <div className="text-[13px] uppercase tracking-[0.18em] text-faint">{wd}</div>
          <div className="font-serif text-[34px] font-medium leading-none tracking-tight">{humanDate(today, false)}</div>
        </div>
        <button onClick={() => nav.push({ name: 'locations' })} className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-muted">
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
            <path d="M6 11s4-3.6 4-6.4A4 4 0 0 0 2 4.6C2 7.4 6 11 6 11z" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="6" cy="4.6" r="1.3" fill="currentColor" />
          </svg>
          {location.name}
        </button>
      </header>

      {model.latitudeWarning && <Card className="text-[15px] text-muted">Здесь, выше 60° широты, Луна может не восходить сутками, и счёт лунных дней ненадёжен.</Card>}

      <HeroCard
        model={model}
        plan={extra.plan}
        number={current.number}
        sign={model.dominantSign}
        until={endsToday ? current.end : null}
        next={endsToday ? (current.number + 1 > current.totalInCycle ? 1 : current.number + 1) : null}
        now={now}
        tone={card.tone}
        onWhy={() => setWhy(true)}
        onMore={() => setMore(true)}
      />
      <TimeStrip model={model} now={now} />
      <HdSpotlight date={today} onOpenChart={() => nav.push({ name: 'hd' })} />
      <AreaGrid areas={extra.verdicts} lunarDay={model.dominant.number} onPick={(area) => nav.push({ name: 'pick', area })} />
      <WeekAhead nav={nav} onPick={() => nav.push({ name: 'pick' })} />
      <MoreTiles
        model={model}
        content={content}
        lifeAreas={extra.areas}
        plan={extra.plan}
        now={now}
        onOpenDay={(d) => nav.push({ name: 'day', date: d })}
        onAllEvents={openUpcoming}
        onWrite={() => nav.push({ name: 'entry', date: today })}
      />

      <button onClick={() => nav.push({ name: 'day', date: today })} className="mx-auto block py-2 text-[15px] text-accent">
        Весь день подробно ›
      </button>
      <ShareDay model={model} plan={extra.plan} content={content} place={location.name} />
      <DayStorySheet open={more} onClose={() => setMore(false)} onWhy={() => setWhy(true)} model={model} plan={extra.plan} card={card} content={content} current={current.number} />
      <WhySheet card={card} model={model} open={why} onClose={() => setWhy(false)} />
    </div>
  );
}
