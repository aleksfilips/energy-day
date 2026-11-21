import { useState } from 'react';
import * as A from '../../astro';
import type { DayModel } from '../../synthesis/day';
import { RULES_TEXT, type EnergyCard } from '../../synthesis/rules';
import { Card, Chip, Label, Sheet } from '../ui';

export function ToneScaleView({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="flex items-center gap-1">
        {[-3, -2, -1, 0, 1, 2, 3].map((v) => (
          <span
            key={v}
            className="h-1.5 flex-1 rounded-full transition"
            style={{ background: v === value ? 'var(--accent)' : 'var(--surface-2)' }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[12px] text-faint">
        <span>тише</span>
        <span className="text-muted">{label}</span>
        <span>активнее</span>
      </div>
    </div>
  );
}

/** Лист «Почему так?»: из чего собран день. */
export function WhySheet({ card, model, open, onClose }: { card: EnergyCard; model: DayModel; open: boolean; onClose: () => void }) {
  const tz = model.location.timeZone;
  const STEP: Record<string, string> = { Основа: 'Лунный день', Фон: 'Фаза Луны', Окраска: 'Знак Луны', Модификаторы: 'Особые события', 'Личная нота': 'Личный день' };
  return (
    <Sheet open={open} onClose={onClose} title="Из чего сложился день">
      <div className="space-y-4">
        {card.why.map((w) => (
          <div key={w.step}>
            <div className="text-[14px] font-medium text-accent">{STEP[w.step] ?? w.step}</div>
            <div className="mt-0.5 text-[14px] text-muted">{w.input}</div>
            <div className="mt-0.5 text-[16px] leading-6">{w.effect}</div>
          </div>
        ))}
        <div>
          <div className="text-[14px] font-medium text-accent">Насколько активный день</div>
          <div className="mt-2">
            <ToneScaleView value={card.tone.value} label={card.tone.label} />
          </div>
          <div className="mt-3 space-y-1 text-[14px]">
            {card.tone.parts.map((p) => (
              <div key={p.label} className="flex justify-between">
                <span className="text-muted">{p.label}</span>
                <span className="tabular-nums">{p.value > 0 ? `+${p.value}` : p.value}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-line pt-1">
              <span>итог (от −3 до +3)</span>
              <span className="tabular-nums">{card.tone.value > 0 ? `+${card.tone.value}` : card.tone.value}</span>
            </div>
          </div>
        </div>
        <div className="border-t border-line pt-4">
          <div className="mb-2 text-[14px] font-medium text-faint">Правила, по которым всё считается</div>
          <div className="space-y-2">
            {RULES_TEXT.map((r) => (
              <div key={r.title} className="text-[14px] leading-5 text-muted">
                <span className="text-ink">{r.title}.</span> {r.text}
              </div>
            ))}
          </div>
          <div className="mt-3 text-[13px] leading-5 text-faint">
            Время Луны считается астрономически точно, до минуты, для места «{model.location.name}». Толкования — по традиции. «Светлое время» — {A.formatTime(model.window.from, tz)}–{A.formatTime(model.window.to, tz)}, его можно поменять в настройках.
          </div>
        </div>
      </div>
    </Sheet>
  );
}

export function EnergyCardView({ card, model }: { card: EnergyCard; model: DayModel }) {
  const [why, setWhy] = useState(false);
  const tz = model.location.timeZone;
  const accent = card.personal?.color.hex;
  const keyMods = card.modifiers.filter((m) => m.key !== 'quarter' && m.key !== 'perigee' && m.key !== 'apogee');
  return (
    <Card className="rise-in relative overflow-hidden">
      {accent && <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-[0.14] blur-2xl" style={{ background: accent }} />}
      <div className="flex items-center justify-between">
        <Label>Энергия дня</Label>
        <button onClick={() => setWhy(true)} className="text-[13px] text-accent">
          Почему так?
        </button>
      </div>
      <p className="mt-3 font-display text-[19px] leading-[1.45]">{card.summary}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {card.tags.map((t) => (
          <Chip key={t} tone="accent">
            {t}
          </Chip>
        ))}
      </div>

      {keyMods.length > 0 && (
        <div className="mt-5 space-y-2.5">
          {keyMods.map((m, i) => (
            <div key={i} className="flex gap-3 text-[14px] leading-5">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.key === 'voc' ? 'var(--accent)' : 'var(--silver)' }} />
              <span>
                <span className="text-ink">{m.title}</span> <span className="text-muted">{m.text}</span>
                {m.layer === 'tradition' && <span className="text-faint"> · традиция</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5">
        <ToneScaleView value={card.tone.value} label={card.tone.label} />
      </div>

      {card.personal && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[17px] font-medium text-white" style={{ background: card.personal.color.hex }}>
            {card.personal.number}
          </span>
          <span className="text-[14px] leading-5">
            <span className="block text-faint text-[11px] uppercase tracking-[0.12em]">Мой личный день · {card.personal.color.name}</span>
            {card.personal.note[0]!.toUpperCase() + card.personal.note.slice(1)}.
          </span>
        </div>
      )}

      <div className="mt-4 text-center text-[11px] text-faint">Лунный календарь — ориентир для внимания. Решение принимаешь ты.</div>

      <Sheet open={why} onClose={() => setWhy(false)} title="Почему так?">
        <div className="space-y-4">
          {card.why.map((w) => (
            <div key={w.step}>
              <div className="text-[13px] font-medium text-accent">{w.step}</div>
              <div className="mt-0.5 text-[14px] text-muted">{w.input}</div>
              <div className="mt-0.5 text-[15px]">{w.effect}</div>
            </div>
          ))}
          <div>
            <div className="text-[13px] font-medium text-accent">Шкала тона</div>
            <div className="mt-1 space-y-1 text-[14px]">
              {card.tone.parts.map((p) => (
                <div key={p.label} className="flex justify-between">
                  <span className="text-muted">{p.label}</span>
                  <span className="tabular-nums">{p.value > 0 ? `+${p.value}` : p.value}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-1">
                <span>итог (от −3 до +3)</span>
                <span className="tabular-nums">{card.tone.value > 0 ? `+${card.tone.value}` : card.tone.value}</span>
              </div>
            </div>
          </div>
          <div className="border-t border-line pt-4">
            <div className="mb-2 text-[13px] font-medium text-faint">Правила</div>
            <div className="space-y-2">
              {RULES_TEXT.map((r) => (
                <div key={r.title} className="text-[13px] leading-5 text-muted">
                  <span className="text-ink">{r.title}.</span> {r.text}
                </div>
              ))}
            </div>
            <div className="mt-3 text-[12px] text-faint">
              Числового «рейтинга удачи» нет: он создаёт ложное ощущение точности. Окна времени даны для {model.location.name}, {A.formatTime(model.window.from, tz)}–{A.formatTime(model.window.to, tz)} — светлое окно дня.
            </div>
          </div>
        </div>
      </Sheet>
    </Card>
  );
}
