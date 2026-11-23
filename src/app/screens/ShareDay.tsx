/** Кнопка и лист «Поделиться днём» (D-142). */
import { useState } from 'react';
import * as A from '../../astro';
import type { Content } from '../../content';
import type { DayModel } from '../../synthesis/day';
import { goodWindows, spanText, vocInDaylight, type DayPlan } from '../../synthesis/life';
import { haptic } from '../../telegram';
import { humanDate } from '../format';
import { canvasBlob, drawShareCard } from '../shareCard';
import { Button, Sheet } from '../ui';

export function ShareDay({ model, plan, content, place }: { model: DayModel; plan: DayPlan; content: Content; place: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const make = async () => {
    haptic.tap('soft');
    setOpen(true);
    if (url) return;
    setBusy(true);
    try {
      const tz = model.location.timeZone;
      const ld = content.lunarDay(model.dominant.number);
      const good = goodWindows(model);
      const voc = vocInDaylight(model);
      const [wd, dm] = [humanDate(model.date).split(', ')[1]!, humanDate(model.date, false)];
      const canvas = await drawShareCard({
        weekday: wd.charAt(0).toUpperCase() + wd.slice(1),
        date: dm,
        place,
        lunarDay: model.dominant.number,
        title: ld.essence.split('. ')[0]!.replace(/\.$/, ''),
        mood: plan.mood.title,
        phaseName: A.PHASE_NAMES[model.phase.phase],
        phaseAngle: model.phase.angle,
        sign: A.inSign(model.dominantSign),
        good: ld.favorable,
        mindful: ld.mindful,
        important: good.length ? good.map((w) => spanText(w, tz)).join(', ') : 'сегодня без важных начинаний',
        voc: voc.length ? voc.map((w) => spanText(w, tz)).join(', ') : null,
        areasGood: [],
      });
      setUrl(canvas.toDataURL('image/png'));
      const blob = await canvasBlob(canvas);
      setFile(new File([blob], `energiya-dnya-${model.date}.png`, { type: 'image/png' }));
    } finally {
      setBusy(false);
    }
  };

  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: 'Энергия дня' });
      haptic.success();
    } catch {
      /* человек закрыл окно — ничего страшного */
    }
  };

  return (
    <>
      <button onClick={make} className="mx-auto flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-[15px] text-ink transition active:scale-95">
        <span className="text-accent">✦</span> Поделиться днём
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Карточка дня">
        {busy || !url ? (
          <div className="flex aspect-[9/16] w-full items-center justify-center rounded-3xl bg-surface-2 text-[14px] text-faint">Рисую карточку…</div>
        ) : (
          <img src={url} alt="Карточка дня" className="mx-auto w-full max-w-[360px] rounded-3xl shadow-2xl" />
        )}
        {canShare && (
          <Button className="mt-4 w-full" onClick={share}>
            Отправить
          </Button>
        )}
        <p className="mt-3 text-center text-[13px] leading-5 text-faint">
          {canShare ? 'Или нажми и удерживай картинку, чтобы сохранить.' : 'Нажми и удерживай картинку, чтобы сохранить или отправить её в сторис и чаты.'}
        </p>
      </Sheet>
    </>
  );
}
