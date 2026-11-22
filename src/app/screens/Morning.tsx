/** «Утреннее сообщение»: бот каждое утро присылает подсказку на день для места и даты рождения человека. */
import { useState } from 'react';
import { BOT_USERNAME } from '../../config';
import { encodeSubscription, subscribeLink, unsubscribeLink, type Subscription } from '../../bot/payload';
import { haptic, tg } from '../../telegram';
import { useStore } from '../store';
import { Button, Card, Label } from '../ui';

function openTg(url: string): void {
  const t = tg();
  if (t?.openTelegramLink) t.openTelegramLink(url);
  else window.open(url, '_blank', 'noopener');
}

export function MorningCard() {
  const { settings, update, location } = useStore();
  const m = settings.morning;
  const [time, setTime] = useState(`${String(m.hour).padStart(2, '0')}:${String(m.minute).padStart(2, '0')}`);
  const [justSent, setJustSent] = useState(false);
  if (!BOT_USERNAME || !location) return null;

  const [h, mi] = time.split(':').map(Number) as [number, number];
  const okTime = Number.isFinite(h) && Number.isFinite(mi);
  const bd = settings.layers.personal ? settings.birthday : null;
  const sub: Subscription = { latitude: location.latitude, longitude: location.longitude, timeZone: location.timeZone, birthDay: bd?.day ?? 0, birthMonth: bd?.month ?? 0, hour: okTime ? h : 7, minute: okTime ? mi : 30 };
  let code: string | null = null;
  try {
    code = encodeSubscription(sub);
  } catch {
    code = null;
  }
  const changed = m.enabled && code !== m.code;

  const subscribe = () => {
    if (!code) return;
    haptic.success();
    void update({ morning: { enabled: true, hour: sub.hour, minute: sub.minute, code } });
    setJustSent(true);
    openTg(subscribeLink(BOT_USERNAME, sub));
  };
  const stop = () => {
    void update({ morning: { ...m, enabled: false, code: null } });
    setJustSent(false);
    openTg(unsubscribeLink(BOT_USERNAME));
  };

  return (
    <Card className="space-y-3">
      <Label>Утреннее сообщение</Label>
      <div className="text-[14px] leading-5 text-muted">
        Бот каждое утро пришлёт в Telegram подсказку на день: лунный день, что хорошо и чего избегать, удачное время. Для места «{location.name}».
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px]">Присылать в</span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-11 rounded-xl bg-surface-2 px-3 text-[16px] outline-none" aria-label="Время утреннего сообщения" />
      </div>
      {!m.enabled && (
        <Button className="w-full" onClick={subscribe} disabled={!code || !okTime}>
          Включить
        </Button>
      )}
      {m.enabled && (changed ? (
        <Button className="w-full" onClick={subscribe} disabled={!code || !okTime}>
          Обновить данные для бота
        </Button>
      ) : (
        <div className="rounded-2xl bg-good-soft px-4 py-3 text-[14px] leading-5">Включено. Если сменишь место или время, здесь появится кнопка «Обновить».</div>
      ))}
      {justSent && <div className="text-[13px] leading-5 text-faint">Откроется чат с ботом. Если внизу есть кнопка «Запустить» или «Start», нажми её. Бот ответит в течение 15 минут.</div>}
      {m.enabled && (
        <button className="text-[14px] text-muted" onClick={stop}>
          Выключить
        </button>
      )}
    </Card>
  );
}
