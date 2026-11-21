import { useState } from 'react';
import { isResolved } from '../../astro/location';
import { telegramUserName } from '../../telegram';
import { useStore } from '../store';
import { Button, Card, cx, Label, Moon } from '../ui';
import { BirthdayInput } from './Settings';

export function Onboarding() {
  const { settings, update } = useStore();
  const [step, setStep] = useState(0);
  const [birthday, setBirthday] = useState(settings.birthday ?? { day: 1, month: 1 });
  const [locId, setLocId] = useState(settings.activeLocationId);
  const name = telegramUserName();
  const resolved = settings.locations.filter(isResolved);

  return (
    <div className="safe-top mx-auto flex min-h-full max-w-[560px] flex-col px-5 pb-8">
      <div className="flex flex-1 flex-col justify-center">
        {step === 0 && (
          <div className="rise-in flex flex-col items-center text-center">
            <Moon angle={120} size={170} />
            <div className="mt-6 font-display text-[30px] font-semibold leading-tight">{name ? `${name}, привет` : 'Энергия дня'}</div>
            <p className="mt-3 max-w-[320px] text-[16px] leading-6 text-muted">Лунные сутки, фаза, знак и особые периоды на каждый день — посчитанные для твоего места, с честной границей между фактом и традицией.</p>
          </div>
        )}
        {step === 1 && (
          <div className="rise-in space-y-4">
            <div className="font-display text-[26px] font-semibold">Где ты сейчас?</div>
            <p className="text-[15px] text-muted">Лунные сутки меняются вместе с восходом Луны, поэтому место важно. Его всегда можно сменить.</p>
            <Card className="!py-1">
              {resolved.map((l) => (
                <button key={l.id} className="flex w-full items-center gap-3 border-t border-line py-4 text-left first:border-t-0" onClick={() => setLocId(l.id)}>
                  <span className={cx('h-5 w-5 rounded-full border-2', locId === l.id ? 'border-accent bg-accent' : 'border-faint')} />
                  <span>
                    <span className="block text-[15px]">{l.name}</span>
                    <span className="block text-[13px] text-muted">
                      {l.latitude.toFixed(2)}°, {l.longitude.toFixed(2)}°
                    </span>
                  </span>
                </button>
              ))}
            </Card>
            <p className="text-[13px] text-faint">Другое место или геолокацию можно добавить в разделе «Локация».</p>
          </div>
        )}
        {step === 2 && (
          <div className="rise-in space-y-4">
            <div className="font-display text-[26px] font-semibold">День рождения</div>
            <p className="text-[15px] text-muted">Для личного дня по нумерологии Л. Хей нужны только день и месяц. Хранится только на этом устройстве.</p>
            <Card>
              <Label className="mb-3">Дата рождения</Label>
              <BirthdayInput value={birthday} onChange={setBirthday} />
            </Card>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <div className="mb-4 flex justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className={cx('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-ink' : 'w-1.5 bg-surface-2')} />
          ))}
        </div>
        <Button
          className="w-full"
          onClick={() => {
            if (step < 2) setStep(step + 1);
            else void update({ onboarded: true, birthday, activeLocationId: locId });
          }}
        >
          {step < 2 ? 'Дальше' : 'Начать'}
        </Button>
        {step === 2 && (
          <Button variant="quiet" className="w-full" onClick={() => void update({ onboarded: true, activeLocationId: locId, layers: { ...settings.layers, personal: false } })}>
            Пропустить
          </Button>
        )}
      </div>
    </div>
  );
}
