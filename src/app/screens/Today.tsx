import { useState } from 'react';
import * as A from '../../astro';
import { SCHOOL_NAMES } from '../../content/schema';
import { humanDate, humanIn } from '../format';
import { useDay, useNow, useToday } from '../hooks';
import { useStore } from '../store';
import { Button, Card, Label, Moon, ToneDot } from '../ui';
import { EnergyCardView } from './EnergyCard';
import type { Nav } from '../App';

export function TodayScreen({ nav }: { nav: Nav }) {
  const { location, content, settings } = useStore();
  const today = useToday();
  const now = useNow();
  const data = useDay(today);
  const [showSymbols, setShowSymbols] = useState(false);
  if (!location || !data) return null;
  const { model, card } = data;
  const tz = location.timeZone;
  const t = (d: Date) => A.formatTime(d, tz);

  const current = A.lunarDayAt(location, now);
  const ld = content.lunarDay(current.number);
  const nextChange = current.end;
  const phaseNow = A.phaseInfo(now);
  const signNow = A.moonSign(now, settings.zodiac);
  const vocNow = model.voc.find((p) => p.start <= now && now < p.end);
  const vocLater = model.voc.filter((p) => p.start > now);

  return (
    <div className="space-y-4 pb-6">
      <header className="rise-in flex items-center justify-between pt-2">
        <div>
          <div className="font-display text-[28px] font-semibold leading-tight tracking-tight">{humanDate(today, false)}</div>
          <div className="text-[14px] text-muted">{humanDate(today).split(', ')[1]}</div>
        </div>
        <button onClick={() => nav.push({ name: 'locations' })} className="flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-[13px] text-muted">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path d="M6 11s4-3.6 4-6.4A4 4 0 0 0 2 4.6C2 7.4 6 11 6 11z" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="6" cy="4.6" r="1.3" fill="currentColor" />
          </svg>
          {location.name}
        </button>
      </header>

      {model.latitudeWarning && (
        <Card className="text-[14px] text-muted">Выше 60° широты Луна может не восходить сутками, и традиционный счёт лунных суток здесь ненадёжен.</Card>
      )}

      <section className="rise-in flex flex-col items-center pt-2" style={{ animationDelay: '60ms' }}>
        <Moon angle={phaseNow.angle} size={196} southern={location.latitude < 0} />
        <div className="mt-2 text-center">
          <div className="text-[15px] text-silver">{A.PHASE_NAMES[phaseNow.phase]}</div>
          <div className="mt-0.5 text-[13px] text-faint">
            освещено {Math.round(phaseNow.illuminationPct)}% · Луна {phaseNow.waxing ? 'растёт' : 'убывает'}
          </div>
        </div>
      </section>

      <Card className="rise-in" onClick={() => nav.push({ name: 'day', date: today })}>
        <div className="flex items-start justify-between">
          <div>
            <Label>Лунные сутки</Label>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-[64px] font-extralight leading-none tracking-tight">{current.number}</span>
              <span className="text-[15px] text-muted">из {current.totalInCycle}</span>
            </div>
          </div>
          <div className="pt-1 text-right">
            <div className="flex items-center justify-end gap-1.5 text-[13px] text-muted">
              <ToneDot tone={ld.energy.tone} /> {ld.energy.tone}
            </div>
            <div className="mt-1 text-[13px] text-faint">смена в {t(nextChange)}</div>
            <div className="text-[13px] text-faint">{humanIn(nextChange.getTime() - now.getTime())}</div>
          </div>
        </div>
        <button
          className="mt-3 text-left text-[17px] leading-snug"
          onClick={(e) => {
            e.stopPropagation();
            setShowSymbols(!showSymbols);
          }}
        >
          {ld.symbols[0]![0]!.toUpperCase() + ld.symbols[0]!.slice(1)}
          {showSymbols && ld.symbols.length > 1 && <span className="text-muted"> · также {ld.symbols.slice(1).join(', ')}</span>}
        </button>
        <p className="mt-2 text-[15px] leading-6 text-muted">{ld.essence}</p>
        <div className="mt-3 text-[12px] text-faint">по традиции · {SCHOOL_NAMES[ld.school]}</div>
      </Card>

      <div className="rise-in grid grid-cols-2 gap-3">
        <Card className="!p-4">
          <Label>Луна в знаке</Label>
          <div className="mt-1.5 text-[19px]">{A.SIGN_NAMES[signNow.sign]}</div>
          <div className="mt-0.5 text-[13px] text-faint">
            {model.ingresses.length
              ? model.ingresses.map((i) => `${A.SIGN_NAMES[i.sign]} с ${t(i.time)}`).join(', ')
              : `${Math.floor(signNow.degreeInSign)}° в знаке`}
          </div>
        </Card>
        <Card className="!p-4">
          <Label>Без курса</Label>
          {vocNow ? (
            <>
              <div className="mt-1.5 text-[19px] text-accent">сейчас</div>
              <div className="mt-0.5 text-[13px] text-faint">до {t(vocNow.end)}</div>
            </>
          ) : vocLater.length ? (
            <>
              <div className="mt-1.5 text-[19px]">с {t(vocLater[0]!.start)}</div>
              <div className="mt-0.5 text-[13px] text-faint">до {vocLater[0]!.end < model.bounds.end ? t(vocLater[0]!.end) : 'завтра'}</div>
            </>
          ) : (
            <>
              <div className="mt-1.5 text-[19px]">нет</div>
              <div className="mt-0.5 text-[13px] text-faint">курс есть весь день</div>
            </>
          )}
        </Card>
      </div>

      <EnergyCardView card={card} model={model} />

      <Button className="w-full" onClick={() => nav.push({ name: 'entry', date: today })}>
        Записать в дневник
      </Button>

      {model.lunarDays.length > 1 && (
        <div className="px-1 text-center text-[13px] text-faint">{A.describeLunarDays(model.lunarDays, tz)}</div>
      )}
      <div className="px-1 text-center text-[13px] text-faint">В поездке переключи локацию: лунные сутки зависят от места.</div>
    </div>
  );
}
