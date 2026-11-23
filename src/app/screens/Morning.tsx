/** «Утреннее сообщение»: бот каждое утро присылает подсказку на день для места и даты рождения человека. */
import { useState } from 'react';
import { BOT_USERNAME } from '../../config';
import { encodeSubscription, extrasFit, subscribeLink, unsubscribeLink, type Subscription, type VoiceId } from '../../bot/payload';
import { birthToUtc } from '../../humandesign/chart';
import { haptic, tg } from '../../telegram';
import { useStore } from '../store';
import { Button, Card, Label, Segmented, Toggle } from '../ui';

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
  const [voice, setVoice] = useState<VoiceId>(m.voice ?? 0);
  const [hdOn, setHdOn] = useState(m.hd ?? true);
  if (!BOT_USERNAME || !location) return null;

  const [h, mi] = time.split(':').map(Number) as [number, number];
  const okTime = Number.isFinite(h) && Number.isFinite(mi);
  const bd = settings.layers.personal ? settings.birthday : null;
  let birthUtc: number | undefined;
  try {
    birthUtc = settings.humanDesign ? birthToUtc(settings.humanDesign).getTime() : undefined;
  } catch {
    birthUtc = undefined;
  }
  const base: Subscription = { latitude: location.latitude, longitude: location.longitude, timeZone: location.timeZone, birthDay: bd?.day ?? 0, birthMonth: bd?.month ?? 0, hour: okTime ? h : 7, minute: okTime ? mi : 30 };
  const withExtras: Subscription = { ...base, voice, hd: hdOn && birthUtc !== undefined, ...(hdOn && birthUtc !== undefined ? { birthUtc } : {}) };
  const fits = extrasFit(withExtras);
  const sub = fits ? withExtras : base;
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
    void update({ morning: { enabled: true, hour: sub.hour, minute: sub.minute, code, voice, hd: hdOn } });
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
      <div>
        <div className="mb-2 text-[15px]">Голосом</div>
        <Segmented
          value={String(voice) as '0' | '1' | '2' | '3'}
          onChange={(v) => setVoice(Number(v) as VoiceId)}
          options={[
            { value: '0', label: 'Нет' },
            { value: '1', label: 'Светлана' },
            { value: '2', label: 'Дария' },
            { value: '3', label: 'Алёна' },
          ]}
        />
        <div className="mt-2 text-[13px] leading-5 text-faint">
          Расклад придёт голосовым сообщением приятным женским голосом, текст тоже останется.{' '}
          <button className="text-accent underline-offset-2" onClick={() => openTg(`https://t.me/${BOT_USERNAME.replace(/^@/, '')}?start=golos`)}>
            Послушать голоса
          </button>
        </div>
      </div>
      {birthUtc !== undefined && (
        <Toggle label="Дизайн человека" hint="картинка бодиграфа с транзитами дня и полный разбор: что включается в тебе, открытые центры, стратегия" checked={hdOn} onChange={setHdOn} />
      )}
      {!fits && (voice !== 0 || hdOn) && <div className="text-[13px] leading-5 text-faint">Для этого часового пояса голос и Дизайн человека пока недоступны: слишком длинное название пояса.</div>}
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
