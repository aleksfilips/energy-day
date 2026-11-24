import { useState } from 'react';
import { isResolved, type Location } from '../../astro/location';
import { db } from '../../db';
import { exportCsv, exportJson, importJson } from '../../diary/backup';
import { scheduleDiaryBackup } from '../../diary/autoBackup';
import { cloudAvailable, cloudLoad, cloudSave, downloadText, haptic } from '../../telegram';
import { clearCloudProfile } from '../../state/profile';
import { useStore } from '../store';
import { Button, Card, cx, Label, Segmented, Toggle } from '../ui';
import type { Nav } from '../App';
import { InviteCard } from './Invite';
import { MorningCard } from './Morning';
import { HomeScreenCard } from './HomeScreen';
import { PlaceConfirm, PlaceSearch } from './PlaceSearch';
import { placeToLocation } from './Profile';
import type { Place } from '../../places/geocode';
import { isValidTimeZone } from '../../places/timezone';

const MONTH_NAMES = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export function BirthdayInput({ value, onChange }: { value: { day: number; month: number } | null; onChange: (v: { day: number; month: number }) => void }) {
  const day = value?.day ?? 1;
  const month = value?.month ?? 1;
  return (
    <div className="flex gap-2">
      <select value={day} onChange={(e) => onChange({ day: Number(e.target.value), month })} className="h-12 flex-1 rounded-xl bg-surface-2 px-3 text-[15px] outline-none">
        {Array.from({ length: 31 }, (_, i) => (
          <option key={i} value={i + 1}>
            {i + 1}
          </option>
        ))}
      </select>
      <select value={month} onChange={(e) => onChange({ day, month: Number(e.target.value) })} className="h-12 flex-[2] rounded-xl bg-surface-2 px-3 text-[15px] outline-none">
        {MONTH_NAMES.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}

export function LocationsScreen({ nav }: { nav: Nav }) {
  const { settings, update } = useStore();
  const [editing, setEditing] = useState<Location | null>(null);
  const [adding, setAdding] = useState(false);
  const [found, setFound] = useState<Place | null>(null);

  const choose = (id: string) => {
    haptic.select();
    void update({ activeLocationId: id });
  };
  const saveLoc = (l: Location) => {
    void update((s) => ({ locations: s.locations.some((x) => x.id === l.id) ? s.locations.map((x) => (x.id === l.id ? l : x)) : [...s.locations, l] }));
    setEditing(null);
  };
  return (
    <div className="space-y-4 pb-8">
      <header className="pt-2">
        <div className="font-display text-[26px] font-semibold">Место</div>
        <div className="text-[14px] text-muted">лунный день зависит от места: в поездке добавь новое и выбери его</div>
      </header>
      <Card className="!py-1">
        {settings.locations.map((l) => (
          <div key={l.id} className="flex items-center gap-3 border-t border-line py-3.5 first:border-t-0">
            <button className="flex flex-1 items-center gap-3 text-left" onClick={() => (isResolved(l) ? choose(l.id) : setEditing(l))}>
              <span className={cx('h-5 w-5 shrink-0 rounded-full border-2', settings.activeLocationId === l.id ? 'border-accent bg-accent' : 'border-faint')} />
              <span>
                <span className="block text-[15px]">
                  {l.name}
                  {settings.homeLocationId === l.id && <span className="text-faint"> · дом</span>}
                </span>
                <span className="block text-[13px] text-muted">{isResolved(l) ? (l.label ? l.label : `${l.latitude.toFixed(2)}°, ${l.longitude.toFixed(2)}°`) : 'нужны координаты'}</span>
              </span>
            </button>
            <button className="text-[14px] text-accent" onClick={() => setEditing(l)}>
              изменить
            </button>
          </div>
        ))}
      </Card>
      {!adding && !found && (
        <Button className="w-full" onClick={() => setAdding(true)}>
          Добавить место
        </Button>
      )}
      {adding && !found && (
        <PlaceSearch
          autoFocus
          onPick={(p) => {
            setFound(p);
            setAdding(false);
          }}
        />
      )}
      {found && (
        <div className="space-y-3">
          <PlaceConfirm place={found} onChange={() => { setFound(null); setAdding(true); }} />
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                const l = placeToLocation(found);
                void update((s) => ({ locations: [...s.locations, l], activeLocationId: l.id, homeLocationId: s.locations.some((x) => x.id === s.homeLocationId) ? s.homeLocationId : l.id }));
                haptic.success();
                setFound(null);
              }}
            >
              Сохранить
            </Button>
            <Button variant="ghost" onClick={() => setFound(null)}>
              Отмена
            </Button>
          </div>
        </div>
      )}
      <button
        className="w-full text-center text-[13px] text-faint"
        onClick={() => setEditing({ id: `loc-${Date.now()}`, name: '', latitude: null, longitude: null, elevation: 0, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
      >
        Ввести координаты вручную
      </button>
      {editing && <LocationEditor value={editing} onSave={saveLoc} onCancel={() => setEditing(null)} onHome={() => void update({ homeLocationId: editing.id })} onDelete={settings.locations.length > 1 ? () => {
        void update((s) => ({ locations: s.locations.filter((x) => x.id !== editing.id), activeLocationId: s.activeLocationId === editing.id ? s.homeLocationId : s.activeLocationId }));
        setEditing(null);
      } : undefined} />}
    </div>
  );
}

function LocationEditor({ value, onSave, onCancel, onDelete, onHome }: { value: Location; onSave: (l: Location) => void; onCancel: () => void; onDelete?: () => void; onHome: () => void }) {
  const [l, setL] = useState(value);
  const [lat, setLat] = useState(value.latitude?.toString() ?? '');
  const [lon, setLon] = useState(value.longitude?.toString() ?? '');
  const la = Number(lat.replace(',', '.'));
  const lo = Number(lon.replace(',', '.'));
  const valid = l.name.trim() && lat && lon && !isNaN(la) && !isNaN(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180 && isValidTimeZone(l.timeZone.trim());
  const field = 'h-12 w-full rounded-xl bg-surface-2 px-4 text-[15px] outline-none placeholder:text-faint';
  return (
    <Card className="space-y-3">
      <Label>Место</Label>
      <input className={field} placeholder="Название" value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <input className={field} inputMode="decimal" placeholder="Широта, 57.14" value={lat} onChange={(e) => setLat(e.target.value)} />
        <input className={field} inputMode="decimal" placeholder="Долгота, 60.15" value={lon} onChange={(e) => setLon(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className={field} placeholder="Часовой пояс" value={l.timeZone} onChange={(e) => setL({ ...l, timeZone: e.target.value })} />
        <input className={field} inputMode="numeric" placeholder="Высота, м" value={l.elevation} onChange={(e) => setL({ ...l, elevation: Math.max(0, Number(e.target.value) || 0) })} />
      </div>
      <div className="text-[12px] text-faint">Координаты в градусах, север и восток со знаком плюс. Часовой пояс — например Asia/Yekaterinburg или Europe/Moscow.</div>
      <div className="flex gap-2 pt-1">
        <Button className="flex-1" disabled={!valid} onClick={() => onSave({ ...l, name: l.name.trim(), timeZone: l.timeZone.trim(), latitude: la, longitude: lo })}>
          Сохранить
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
      </div>
      <div className="flex justify-between pt-1 text-[14px]">
        <button className="text-muted" onClick={onHome}>
          Сделать домом
        </button>
        {onDelete && (
          <button className="text-faint" onClick={onDelete}>
            Удалить
          </button>
        )}
      </div>
    </Card>
  );
}

export function SettingsScreen({ nav }: { nav: Nav }) {
  const { settings, update, location } = useStore();
  const [msg, setMsg] = useState<string | null>(null);

  const doExport = async () => {
    const json = await exportJson();
    const name = `energy-day-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Энергия дня — резервная копия' }).catch(() => {});
    } else downloadText(name, json);
  };
  const doCsv = async () => downloadText(`energy-day-diary-${new Date().toISOString().slice(0, 10)}.csv`, await exportCsv(), 'text/csv');
  const doImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const r = await importJson(await f.text());
        setMsg(`Импортировано: записей ${r.entries}, правок ${r.overrides}`);
        location && window.location.reload();
      } catch (e) {
        setMsg(`Не получилось: ${String(e)}`);
      }
    };
    input.click();
  };
  const cloudBackup = async () => {
    try {
      await cloudSave('backup', await exportJson());
      setMsg('Копия сохранена в облаке Telegram');
      haptic.success();
    } catch (e) {
      setMsg(`Ошибка облака: ${String(e)}`);
    }
  };
  const cloudRestore = async () => {
    try {
      const data = await cloudLoad('backup');
      if (!data) return setMsg('В облаке копии нет');
      const r = await importJson(data);
      setMsg(`Восстановлено: записей ${r.entries}`);
    } catch (e) {
      setMsg(`Ошибка облака: ${String(e)}`);
    }
  };

  return (
    <div className="space-y-4 pb-10">
      <header className="pt-2">
        <div className="font-display text-[28px] font-semibold">Ещё</div>
      </header>

      <HomeScreenCard />
      <InviteCard />
      <MorningCard />

      <Card className="!py-1">
        {[
          ['profile', 'Мои данные', [settings.name, settings.birthday ? `${settings.birthday.day}.${String(settings.birthday.month).padStart(2, '0')}` : 'дата рождения не указана'].filter(Boolean).join(' · ')],
          ['locations', 'Место', location?.name ?? 'не выбрано'],
          ['hd', 'Дизайн человека', settings.humanDesign ? 'моя карта, мандала, циклы жизни, мои люди' : 'укажи время и место рождения в «Моих данных»'],
          ['pair', 'Совместимость', settings.pair ? `ты и ${settings.pair.name} · Дизайн человека` : 'сравнить две карты Дизайна человека'],
          ['help', 'Справка', 'что значит каждый блок и как всё считается'],
        ].map(([name, title, sub]) => (
          <button key={name} className="flex w-full items-center justify-between border-t border-line py-4 text-left first:border-t-0" onClick={() => nav.push({ name: name as 'help' })}>
            <span>
              <span className="block text-[15px]">{title}</span>
              <span className="block text-[13px] text-muted">{sub}</span>
            </span>
            <span className="text-faint">›</span>
          </button>
        ))}
      </Card>

      <Card>
        <Label className="mb-1">Дополнительно показывать</Label>
        <Toggle label="Мой личный день" hint="число дня по твоей дате рождения (нумерология)" checked={settings.layers.personal} onChange={(v) => void update({ layers: { ...settings.layers, personal: v } })} />
        <Toggle label="Календарь садовода" hint="дни корня, листа, цветка и плода по Марии Тун — в «Весь день подробно»" checked={settings.layers.garden} onChange={(v) => void update({ layers: { ...settings.layers, garden: v } })} />
      </Card>

      <Card className="space-y-4">
        <div>
          <Label className="mb-2">Луна без курса</Label>
          <Segmented value={settings.vocMode} onChange={(v) => void update({ vocMode: v })} options={[{ value: 'modern', label: 'Современный' }, { value: 'classical', label: 'Классический' }]} />
          <div className="mt-2 text-[12px] text-faint">{settings.vocMode === 'modern' ? 'Аспекты к Солнцу…Плутону' : 'Только Солнце…Сатурн, как в традиционной школе'}</div>
        </div>
        <div>
          <Label className="mb-2">Зодиак для знака Луны</Label>
          <Segmented value={settings.zodiac} onChange={(v) => void update({ zodiac: v })} options={[{ value: 'tropical', label: 'Тропический' }, { value: 'sidereal', label: 'Сидерический' }]} />
        </div>
        <div>
          <Label className="mb-2">
            Светлые часы: {settings.daylight.from}:00 – {settings.daylight.to}:00
          </Label>
          <div className="flex items-center gap-3 text-[13px] text-muted">
            <span className="w-8">с</span>
            <input type="range" min={4} max={12} value={settings.daylight.from} onChange={(e) => void update({ daylight: { ...settings.daylight, from: Number(e.target.value) } })} />
          </div>
          <div className="flex items-center gap-3 text-[13px] text-muted">
            <span className="w-8">до</span>
            <input type="range" min={18} max={24} value={settings.daylight.to} onChange={(e) => void update({ daylight: { ...settings.daylight, to: Number(e.target.value) } })} />
          </div>
          <div className="text-[12px] text-faint">Советы на день даются по тому лунному дню, который идёт большую часть этого времени.</div>
        </div>
      </Card>

      <Card className="space-y-1">
        <Label>Личный день</Label>
        <Toggle label="Мастер-числа 11 и 22" hint="не сводить их к 2 и 4" checked={settings.numerology.masterNumbers} onChange={(v) => void update({ numerology: { ...settings.numerology, masterNumbers: v } })} />
        <Toggle label="Личный год с дня рождения" hint="иначе — с 1 января" checked={settings.numerology.yearSwitch === 'birthday'} onChange={(v) => void update({ numerology: { ...settings.numerology, yearSwitch: v ? 'birthday' : 'jan1' } })} />
      </Card>

      <Card>
        <Label className="mb-2">Оформление</Label>
        <Segmented value={settings.theme} onChange={(v) => void update({ theme: v })} options={[{ value: 'dark', label: 'Тёмная' }, { value: 'light', label: 'Светлая' }, { value: 'telegram', label: 'Как в Telegram' }]} />
        <Toggle label="Отклик вибрацией" checked={settings.haptics} onChange={(v) => void update({ haptics: v })} />
      </Card>

      <Card className="space-y-3">
        <Label>Данные</Label>
        <div className="text-[13px] leading-5 text-muted">Дневник и настройки хранятся на этом устройстве. Никакой аналитики. При поиске места название уходит в сервис карт (Open-Meteo или OpenStreetMap), больше ничего.</div>
        {cloudAvailable() && (
          <Toggle
            label="Хранить мои данные в Telegram"
            hint="имя, места и дата рождения в твоём личном облаке Telegram: на новом телефоне не придётся вводить заново"
            checked={settings.cloudProfile}
            onChange={(v) => {
              void update({ cloudProfile: v });
              if (!v) void clearCloudProfile();
            }}
          />
        )}
        {cloudAvailable() && (
          <Toggle
            label="Копия дневника в Telegram"
            hint="после каждой записи дневник сам сохраняется в твоё личное облако Telegram. Сменишь телефон — записи вернутся"
            checked={settings.autoBackup}
            onChange={(v) => {
              void update({ autoBackup: v });
              if (v) scheduleDiaryBackup();
            }}
          />
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={doExport}>
            Экспорт JSON
          </Button>
          <Button variant="ghost" onClick={doCsv}>
            Дневник CSV
          </Button>
          <Button variant="ghost" onClick={doImport}>
            Импорт JSON
          </Button>
          {cloudAvailable() && (
            <Button variant="ghost" onClick={cloudBackup}>
              В облако Telegram
            </Button>
          )}
        </div>
        {cloudAvailable() && (
          <button className="text-[14px] text-accent" onClick={cloudRestore}>
            Восстановить из облака Telegram
          </button>
        )}
        {cloudAvailable() && <div className="text-[12px] text-faint">Облако Telegram — личное хранилище бота, видно только тебе. Копия делается только по нажатию.</div>}
        {msg && <div className="text-[14px] text-accent">{msg}</div>}
        <button
          className="pt-2 text-[13px] text-faint"
          onClick={async () => {
            if (!confirmDanger()) return setMsg('Нажми ещё раз в течение 4 секунд, чтобы стереть всё');
            await clearCloudProfile();
            await db.delete();
            window.location.reload();
          }}
        >
          Стереть все данные на устройстве
        </button>
      </Card>
    </div>
  );
}

let armed = 0;
function confirmDanger(): boolean {
  // Без модальных confirm(): в Telegram они блокируют WebView. Нужно нажать дважды за 4 секунды.
  const now = Date.now();
  if (now - armed < 4000) return true;
  armed = now;
  haptic.tap('medium');
  return false;
}
