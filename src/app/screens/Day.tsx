import * as A from '../../astro';
import { SCHOOL_NAMES, type Level } from '../../content/schema';
import { addDays, type DateKey } from '../../astro/time';
import { humanDate, humanDateTime } from '../format';
import { useDay } from '../hooks';
import { useStore } from '../store';
import { Card, Chip, Disclosure, Label, List, Moon, SchoolNote, ToneDot } from '../ui';
import { EnergyCardView } from './EnergyCard';
import type { Nav } from '../App';

const LEVEL: Record<Level, string> = { high: 'высокое', medium: 'среднее', low: 'низкое' };

function Meta({ school, consensus, confidence, needsReview }: { school: keyof typeof SCHOOL_NAMES; consensus: Level; confidence: Level; needsReview: boolean }) {
  return (
    <SchoolNote>
      {SCHOOL_NAMES[school]} · согласие школ: {LEVEL[consensus]} · уверенность: {LEVEL[confidence]}
      {needsReview && ' · ждёт ревизии'}
    </SchoolNote>
  );
}

export function DayScreen({ date, nav }: { date: DateKey; nav: Nav }) {
  const { location, content, settings } = useStore();
  const data = useDay(date);
  if (!location || !data) return null;
  const { model, card } = data;
  const tz = location.timeZone;
  const t = (d: Date) => A.formatTime(d, tz);
  const ld = content.lunarDay(model.dominant.number);
  const ph = content.phase(model.phase.phase);
  const sg = content.sign(model.dominantSign);

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center justify-between pt-2">
        <button className="h-10 w-10 rounded-full bg-surface text-muted" onClick={() => nav.replace({ name: 'day', date: addDays(date, -1) })} aria-label="Предыдущий день">
          ‹
        </button>
        <div className="text-center">
          <div className="font-display text-[22px] font-semibold">{humanDate(date, false)}</div>
          <div className="text-[13px] text-muted">{humanDate(date).split(', ')[1]} · {location.name}</div>
        </div>
        <button className="h-10 w-10 rounded-full bg-surface text-muted" onClick={() => nav.replace({ name: 'day', date: addDays(date, 1) })} aria-label="Следующий день">
          ›
        </button>
      </header>

      <div className="flex items-center gap-5 px-1">
        <Moon angle={model.phase.angle} size={92} animate={false} southern={location.latitude < 0} />
        <div className="space-y-1 text-[14px]">
          <div>{A.describeLunarDays(model.lunarDays, tz)}</div>
          <div className="text-muted">
            {A.PHASE_NAMES[model.phase.phase]}, {Math.round(model.phase.illuminationPct)}%
          </div>
          <div className="text-muted">Луна {A.inSign(model.dominantSign)}</div>
          <div className="text-faint">
            {model.riseSet.map((e) => `${e.kind === 'rise' ? 'восход' : 'заход'} ${t(e.time)}`).join(' · ') || 'восхода и захода нет'}
          </div>
        </div>
      </div>

      <EnergyCardView card={card} model={model} />

      <Card className="!py-1">
        {model.lunarDays.map((s) => {
          const e = content.lunarDay(s.day.number);
          return (
            <Disclosure
              key={`${s.day.number}-${s.day.start.getTime()}`}
              defaultOpen={s.day.number === model.dominant.number && s.day.start.getTime() === model.dominant.start.getTime()}
              title={<span>{s.day.number}-е лунные сутки</span>}
              badge={<ToneDot tone={e.energy.tone} />}
              subtitle={`${s.startsToday ? t(s.from) : 'с вчера'} – ${s.endsToday ? t(s.to) : 'дальше'} · ${e.symbols.join(', ')}`}
            >
              <p className="text-[15px] leading-6">{e.essence}</p>
              <div className="mt-4 grid gap-4">
                <div>
                  <Label className="mb-2">Время для</Label>
                  <List items={e.favorable} />
                </div>
                <div>
                  <Label className="mb-2">Чему уделить внимание</Label>
                  <List items={e.mindful} />
                </div>
                <div>
                  <Label className="mb-1">Практика дня</Label>
                  <p className="text-[15px] leading-6">{e.practice}</p>
                </div>
                <div>
                  <Label className="mb-1">Вопрос для дневника</Label>
                  <p className="text-[15px] italic leading-6 text-silver">{e.reflection}</p>
                </div>
                {e.bySchool.length > 0 && (
                  <div className="space-y-1">
                    {e.bySchool.map((b) => (
                      <p key={b.note} className="text-[13px] leading-5 text-muted">
                        <span className="text-ink">{SCHOOL_NAMES[b.school]}:</span> {b.note}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <Meta {...e} />
            </Disclosure>
          );
        })}

        <Disclosure title={`Фаза: ${ph.name}`} subtitle={model.phase.waxing ? 'растущая Луна' : 'убывающая Луна'}>
          <p className="text-[15px] leading-6">{ph.essence}</p>
          <div className="mt-4 grid gap-4">
            <div>
              <Label className="mb-2">Время для</Label>
              <List items={ph.favorable} />
            </div>
            <div>
              <Label className="mb-2">Чему уделить внимание</Label>
              <List items={ph.mindful} />
            </div>
            <p className="text-[15px] leading-6">
              <span className="text-muted">Практика:</span> {ph.practice}
            </p>
          </div>
          {model.quarters.length > 0 && (
            <div className="mt-3 text-[14px] text-muted">{model.quarters.map((q) => `${A.QUARTER_NAMES[q.quarter]} в ${t(q.time)}`).join(', ')}</div>
          )}
          <Meta {...ph} />
        </Disclosure>

        <Disclosure title={`Луна ${A.inSign(model.dominantSign)}`} subtitle={`добавляет дню ${sg.coloring}`}>
          <p className="text-[15px] leading-6">{sg.essence}</p>
          <div className="mt-4 grid gap-4">
            <div>
              <Label className="mb-2">Хорошо для</Label>
              <List items={sg.favorable} />
            </div>
            <div>
              <Label className="mb-2">Чему уделить внимание</Label>
              <List items={sg.mindful} />
            </div>
            {sg.body && (
              <p className="text-[13px] text-muted">
                Зона тела по средневековой традиции: {sg.body}. Это традиция, а не медицина.
              </p>
            )}
          </div>
          {model.ingresses.length > 0 && (
            <div className="mt-3 text-[14px] text-muted">{model.ingresses.map((i) => `${t(i.time)} — вход в ${A.SIGN_NAMES[i.sign]}`).join(', ')}</div>
          )}
          <Meta {...sg} />
        </Disclosure>

        <Disclosure title="Луна без курса" subtitle={model.voc.length ? model.voc.map((p) => `${p.start < model.bounds.start ? 'до' : `${t(p.start)}–`}${p.end > model.bounds.end ? 'завтра' : t(p.end)}`).join(', ') : 'сегодня нет'}>
          <p className="text-[15px] leading-6">{content.special('voc').essence}</p>
          {model.voc.map((p) => (
            <p key={p.start.getTime()} className="mt-2 text-[14px] text-muted">
              {humanDateTime(p.start, tz)} → {humanDateTime(p.end, tz)}. {p.lastAspect ? `Последний аспект: ${A.ASPECT_NAMES[p.lastAspect.kind]} с планетой ${A.PLANET_NAMES[p.lastAspect.planet]}` : 'В этом знаке аспектов не было'}, затем вход в {A.SIGN_NAMES[p.nextSign]}.
            </p>
          ))}
          <p className="mt-3 text-[13px] leading-5 text-faint">
            Режим: {settings.vocMode === 'modern' ? 'современный, Солнце…Плутон' : 'классический, Солнце…Сатурн'}. {content.special('voc').howCalculated}
          </p>
        </Disclosure>

        {(model.eclipses.length > 0 || model.corridor || model.apsides.length > 0 || model.syzygies.some((s) => s.supermoon || s.micromoon)) && (
          <Disclosure title="Особые события" defaultOpen>
            <div className="space-y-3 text-[15px] leading-6">
              {model.eclipses.map((e) => (
                <p key={e.peak.getTime()}>
                  {e.body === 'sun' ? 'Солнечное' : 'Лунное'} затмение ({A.ECLIPSE_TYPE_NAMES[e.type]}), максимум в {t(e.peak)}.{' '}
                  <span className="text-muted">{content.special(e.body === 'sun' ? 'eclipse_solar' : 'eclipse_lunar').essence}</span>
                </p>
              ))}
              {model.corridor && (
                <p>
                  Коридор затмений до {humanDate(A.toDateKey(model.corridor.end, tz), false)}.{' '}
                  <span className="text-muted">{content.special('eclipse_corridor').essence}</span>
                </p>
              )}
              {model.apsides.map((a) => (
                <p key={a.time.getTime()}>
                  {a.type === 'perigee' ? 'Перигей' : 'Апогей'} в {t(a.time)}, {Math.round(a.distanceKm).toLocaleString('ru-RU')} км.{' '}
                  <span className="text-muted">{content.special(a.type).essence}</span>
                </p>
              ))}
              {model.syzygies
                .filter((s) => s.supermoon || s.micromoon)
                .map((s) => (
                  <p key={s.time.getTime()}>
                    {s.supermoon ? 'Суперлуние' : 'Микролуние'}: {Math.round(s.distanceKm).toLocaleString('ru-RU')} км, близость к перигею {Math.round(s.closeness * 100)}%.{' '}
                    <span className="text-muted">{content.special(s.supermoon ? 'supermoon' : 'micromoon').howCalculated}</span>
                  </p>
                ))}
            </div>
          </Disclosure>
        )}

        {model.personal && (
          <Disclosure title={`Мой личный день: ${model.personal.day}`} subtitle="нумерология, личный слой" badge={<span className="h-2.5 w-2.5 rounded-full" style={{ background: content.personal(model.personal.day).color.hex }} />}>
            {(() => {
              const p = content.personal(model.personal.day);
              return (
                <>
                  <p className="text-[15px] leading-6">
                    {p.essence} Тема дня: {p.theme}.
                  </p>
                  <div className="mt-3">
                    <List items={p.favorable} />
                  </div>
                  <p className="mt-3 text-[15px] italic text-silver">«{p.affirmation}»</p>
                  <p className="mt-3 text-[13px] text-muted">
                    Цвет дня: {p.color.name}. Личный год {model.personal.year}, личный месяц {model.personal.month}.
                  </p>
                  <Meta {...p} />
                </>
              );
            })()}
          </Disclosure>
        )}

        {model.tithi && model.nakshatra && (
          <Disclosure title={`Джйотиш: ${model.tithi.name}, ${model.nakshatra.name}`} subtitle={`титхи ${model.tithi.number} · ${model.tithi.paksha === 'shukla' ? 'шукла' : 'кришна'}-пакша · накшатра ${model.nakshatra.number}, пада ${model.nakshatra.pada}`}>
            {(() => {
              const ti = content.tithi(model.tithi.number);
              const nk = content.nakshatra(model.nakshatra.number);
              return (
                <div className="space-y-3 text-[15px] leading-6">
                  <p>{ti.essence}</p>
                  <p className="text-muted">Хорошо: {ti.favorable.join(', ')}. Внимание: {ti.mindful.join(', ')}.</p>
                  <p>
                    {nk.essence} Управитель: {nk.ruler}, божество: {nk.deity}, символ: {nk.symbol}.
                  </p>
                  <Meta {...nk} />
                  <SchoolNote>Сидерический зодиак, айанамша Лахири.</SchoolNote>
                </div>
              );
            })()}
          </Disclosure>
        )}

        {model.garden && (
          <Disclosure title={content.garden(model.garden.day).title} subtitle={`по М. Тун · Луна в созвездии ${A.CONSTELLATION_NAMES[model.garden.constellation]}`}>
            {(() => {
              const g = content.garden(model.garden.day);
              return (
                <div className="space-y-3 text-[15px] leading-6">
                  <p>{g.essence}</p>
                  <p className="text-muted">Культуры: {g.plants.join(', ')}.</p>
                  <List items={g.favorable} />
                  {model.gardenChanges.length > 0 && (
                    <p className="text-[14px] text-muted">
                      Смена: {model.gardenChanges.map((c) => `${t(c.time)} — ${A.GARDEN_DAY_NAMES[c.day]}`).join(', ')}
                    </p>
                  )}
                  <SchoolNote>Приближение: созвездия по границам IAU, у Тун границы свои, смена может отличаться на несколько часов.</SchoolNote>
                </div>
              );
            })()}
          </Disclosure>
        )}
      </Card>

      <div className="flex flex-wrap justify-center gap-2">
        <Chip tone="soft">Факт: астрономия, до минуты</Chip>
        <Chip tone="soft">Традиция: толкования школ</Chip>
      </div>
      <button className="mx-auto block text-[14px] text-accent" onClick={() => nav.push({ name: 'entry', date })}>
        Записать этот день в дневник
      </button>
    </div>
  );
}
