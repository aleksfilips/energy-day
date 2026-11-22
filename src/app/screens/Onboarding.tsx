/**
 * Первый запуск: имя → где ты живёшь → когда ты родился(-ась) → готово.
 * Всё сохраняется на телефоне; в Telegram копия профиля ещё и в личном облаке Telegram.
 */
import { useEffect, useState } from 'react';
import type { Place } from '../../places/geocode';
import { loadCloudProfile, type CloudProfile } from '../../state/profile';
import { haptic, telegramUserName } from '../../telegram';
import { useStore } from '../store';
import { Button, Card, cx, Moon } from '../ui';
import { PlaceConfirm, PlaceSearch } from './PlaceSearch';
import { BirthForm, birthResult, field, placeToLocation, type BirthValue } from './Profile';

const STEPS = 4;

export function Onboarding() {
  const { settings, update } = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(settings.name ?? telegramUserName() ?? '');
  const [place, setPlace] = useState<Place | null>(null);
  const [searching, setSearching] = useState(true);
  const [birth, setBirth] = useState<BirthValue>({ date: '', time: '', place: null });
  const [cloud, setCloud] = useState<CloudProfile | null>(null);

  useEffect(() => {
    void loadCloudProfile().then(setCloud);
  }, []);

  const restore = (p: CloudProfile) => {
    haptic.success();
    void update({
      onboarded: true,
      name: p.name,
      locations: p.locations,
      activeLocationId: p.activeLocationId,
      homeLocationId: p.homeLocationId,
      birthday: p.birthday,
      humanDesign: p.humanDesign,
      layers: { ...settings.layers, personal: !!p.birthday },
    });
  };

  const finish = () => {
    if (!place) return;
    const loc = placeToLocation(place, 'home');
    const b = birthResult(birth);
    haptic.success();
    void update({
      onboarded: true,
      name: name.trim() || null,
      locations: [loc],
      activeLocationId: loc.id,
      homeLocationId: loc.id,
      birthday: b.birthday,
      humanDesign: b.humanDesign,
      layers: { ...settings.layers, personal: !!b.birthday },
    });
  };

  const b = birthResult(birth);
  const canNext = step === 0 ? true : step === 1 ? !!place && !searching : true;
  const first = name.trim();

  return (
    <div className="safe-top mx-auto flex min-h-full max-w-[560px] flex-col px-5 pb-8">
      <div className="flex flex-1 flex-col justify-center py-6">
        {step === 0 && (
          <div className="rise-in flex flex-col items-center text-center">
            <Moon angle={120} size={150} />
            <div className="mt-6 font-display text-[30px] font-semibold leading-tight">Энергия дня</div>
            <p className="mt-3 max-w-[330px] text-[16px] leading-6 text-muted">Каждый день простая подсказка: что сегодня хорошо делать, чего лучше избегать и какое время удачное. Всё считается для твоего места и твоей даты рождения.</p>
            {cloud ? (
              <Card className="mt-6 w-full space-y-3 text-left">
                <div className="text-[15px]">
                  Нашлись твои данные{cloud.name ? `, ${cloud.name}` : ''}: {cloud.locations.find((l) => l.id === cloud.homeLocationId)?.name ?? cloud.locations[0]!.name}
                  {cloud.birthday ? `, день рождения ${cloud.birthday.day}.${String(cloud.birthday.month).padStart(2, '0')}` : ''}.
                </div>
                <Button className="w-full" onClick={() => restore(cloud)}>
                  Продолжить с ними
                </Button>
                <button className="w-full text-center text-[14px] text-muted" onClick={() => setCloud(null)}>
                  Ввести заново
                </button>
              </Card>
            ) : (
              <div className="mt-7 w-full space-y-2 text-left">
                <div className="px-1 text-[14px] text-muted">Как к тебе обращаться?</div>
                <input className={field} value={name} placeholder="Имя" maxLength={40} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="rise-in space-y-4">
            <StepTitle title={first ? `${first}, где ты живёшь?` : 'Где ты живёшь?'} hint="Лунный день начинается с восходом Луны, а он в каждом месте свой. Найди свой город, посёлок или деревню. В поездке место можно сменить." />
            {place && !searching ? <PlaceConfirm place={place} onChange={() => setSearching(true)} /> : (
              <PlaceSearch
                autoFocus
                onPick={(p) => {
                  setPlace(p);
                  setSearching(false);
                }}
              />
            )}
          </div>
        )}

        {step === 2 && (
          <div className="rise-in space-y-4">
            <StepTitle title="Когда ты родился(-ась)?" hint="По дате считается твой личный день. Данные хранятся только у тебя." />
            <BirthForm value={birth} onChange={setBirth} />
          </div>
        )}

        {step === 3 && place && (
          <div className="rise-in flex flex-col items-center text-center">
            <Moon angle={180} size={120} />
            <div className="mt-6 font-display text-[28px] font-semibold leading-tight">{first ? `Готово, ${first}` : 'Готово'}</div>
            <Card className="mt-6 w-full space-y-2 text-left text-[15px]">
              <Row k="Место" v={`${place.name}${place.label ? `, ${place.label.split(', ').slice(-2, -1)[0] ?? ''}` : ''}`.replace(/, $/, '')} />
              <Row k="День рождения" v={b.birthday ? `${b.birthday.day}.${String(b.birthday.month).padStart(2, '0')}` : 'не указан'} />
              <Row k="Дизайн человека" v={b.humanDesign ? 'посчитан' : 'нужны время и место рождения'} />
            </Card>
            <p className="mt-4 max-w-[330px] text-[14px] leading-5 text-muted">Всё можно изменить в разделе «Ещё» → «Мои данные».</p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="mb-4 flex justify-center gap-1.5">
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={cx('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-ink' : 'w-1.5 bg-surface-2')} />
          ))}
        </div>
        {!(step === 0 && cloud) && (
          <Button className="w-full" disabled={!canNext} onClick={() => (step < STEPS - 1 ? setStep(step + 1) : finish())}>
            {step === STEPS - 1 ? 'Начать' : step === 2 && !b.birthday ? 'Пропустить' : 'Дальше'}
          </Button>
        )}
        {step > 0 && (
          <Button variant="quiet" className="w-full" onClick={() => setStep(step - 1)}>
            Назад
          </Button>
        )}
      </div>
    </div>
  );
}

function StepTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="space-y-2">
      <div className="font-display text-[26px] font-semibold leading-tight">{title}</div>
      <p className="text-[15px] leading-6 text-muted">{hint}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
