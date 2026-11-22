/** «Мои данные»: имя, дом, дата/время/место рождения. Плюс общая форма рождения для онбординга. */
import { useMemo, useState } from 'react';
import type { Location } from '../../astro/location';
import { bodygraph, type BirthData } from '../../humandesign/chart';
import { hdProfileLines } from '../../humandesign/summary';
import type { Place } from '../../places/geocode';
import { birthMoment, offsetText } from '../../places/timezone';
import type { Birthday } from '../../personal/numerology';
import { haptic } from '../../telegram';
import { useStore } from '../store';
import { Button, Card, Disclosure, Label } from '../ui';
import type { Nav } from '../App';
import { PlaceConfirm, PlaceSearch } from './PlaceSearch';

export const field = 'h-12 w-full rounded-2xl bg-surface-2 px-4 text-[16px] outline-none placeholder:text-faint';
const pad = (n: number) => String(n).padStart(2, '0');

export function placeToLocation(p: Place, id = `loc-${Date.now()}`): Location {
  return { id, name: p.name, label: p.label, latitude: p.latitude, longitude: p.longitude, elevation: 0, timeZone: p.timeZone };
}

export interface BirthValue {
  date: string;
  time: string;
  place: { name: string; label?: string; timeZone: string; latitude?: number; longitude?: number } | null;
}

export function birthValueOf(birthday: Birthday | null, hd: BirthData | null): BirthValue {
  if (hd) return { date: `${hd.year}-${pad(hd.month)}-${pad(hd.day)}`, time: `${pad(hd.hour)}:${pad(hd.minute)}`, place: { name: hd.place ?? '', timeZone: hd.timeZone, latitude: hd.latitude, longitude: hd.longitude } };
  return { date: '', time: '', place: null };
}

/** Дата корректна и не в будущем. */
export function parseBirthDate(s: string): { y: number; m: number; d: number } | null {
  const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!mm) return null;
  const y = Number(mm[1]);
  const m = Number(mm[2]);
  const d = Number(mm[3]);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1900 || dt.getTime() > Date.now()) return null;
  return { y, m, d };
}

export function parseTime(s: string): { h: number; mi: number } | null {
  const mm = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!mm) return null;
  const h = Number(mm[1]);
  const mi = Number(mm[2]);
  return h < 24 && mi < 60 ? { h, mi } : null;
}

/** Из формы — то, что сохраняем: день рождения для личного дня и полные данные для Дизайна человека. */
export function birthResult(v: BirthValue): { birthday: Birthday | null; humanDesign: BirthData | null } {
  const d = parseBirthDate(v.date);
  if (!d) return { birthday: null, humanDesign: null };
  const t = parseTime(v.time);
  const birthday = { day: d.d, month: d.m };
  if (!t || !v.place) return { birthday, humanDesign: null };
  return {
    birthday,
    humanDesign: { year: d.y, month: d.m, day: d.d, hour: t.h, minute: t.mi, timeZone: v.place.timeZone, place: v.place.name || undefined, latitude: v.place.latitude, longitude: v.place.longitude },
  };
}

/** Форма рождения: дата (обязательно), время и место (по желанию, для Дизайна человека). */
export function BirthForm({ value, onChange }: { value: BirthValue; onChange: (v: BirthValue) => void }) {
  const [searching, setSearching] = useState(!value.place);
  const d = parseBirthDate(value.date);
  const t = parseTime(value.time);
  const badDate = value.date !== '' && !d;
  const moment = useMemo(() => {
    if (!d || !t || !value.place) return null;
    try {
      return birthMoment(d.y, d.m, d.d, t.h, t.mi, value.place.timeZone);
    } catch {
      return null;
    }
  }, [d?.y, d?.m, d?.d, t?.h, t?.mi, value.place?.timeZone]);

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <Label>Дата рождения</Label>
        <input type="date" className={field} value={value.date} max={new Date().toISOString().slice(0, 10)} min="1900-01-01" onChange={(e) => onChange({ ...value, date: e.target.value })} aria-label="Дата рождения" />
        {badDate && <div className="text-[13px] text-care">Проверь дату</div>}
        <Label className="pt-1">Время рождения, если знаешь</Label>
        <input type="time" className={field} value={value.time} onChange={(e) => onChange({ ...value, time: e.target.value })} aria-label="Время рождения" />
        <div className="text-[13px] leading-5 text-faint">Время и место нужны только для Дизайна человека. Без них всё остальное работает.</div>
      </Card>
      {(value.time || value.place) && (
        <div className="space-y-3">
          <Label className="px-1">Где ты родился(-ась)</Label>
          {value.place && !searching ? (
            <PlaceConfirmBirth place={value.place} onChange={() => setSearching(true)} />
          ) : (
            <PlaceSearch
              allowGps={false}
              placeholder="Город или село рождения"
              onPick={(p) => {
                onChange({ ...value, place: { name: p.name, label: p.label, timeZone: p.timeZone, latitude: p.latitude, longitude: p.longitude } });
                setSearching(false);
              }}
            />
          )}
          {moment && (
            <div className="rounded-2xl bg-accent-soft px-4 py-3 text-[14px] leading-5 text-ink">
              В момент рождения там было {offsetText(moment.offset)}
              {moment.summer ? ' (летнее время)' : ''}. Это учтено.
              {moment.nonexistent && <span className="mt-1 block text-care">В эту ночь часы переводили вперёд, и такого времени не было. Проверь время рождения.</span>}
              {moment.ambiguous && <span className="mt-1 block text-care">В эту ночь часы переводили назад, и это время было дважды. Взято первое, летнее. Если знаешь, что позже, прибавь час.</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlaceConfirmBirth({ place, onChange }: { place: NonNullable<BirthValue['place']>; onChange: () => void }) {
  if (place.latitude === undefined || place.longitude === undefined) {
    return (
      <Card className="flex items-center justify-between">
        <span className="text-[15px]">{place.name || place.timeZone}</span>
        <button className="text-[14px] text-accent" onClick={onChange}>
          выбрать город
        </button>
      </Card>
    );
  }
  return <PlaceConfirm place={{ name: place.name, label: place.label ?? '', latitude: place.latitude, longitude: place.longitude, timeZone: place.timeZone, tzSource: 'base', countryCode: '', source: 'geonames' }} onChange={onChange} hideNow />;
}

/** Экран «Мои данные». */
export function ProfileScreen({ nav }: { nav: Nav }) {
  const { settings, update } = useStore();
  const [name, setName] = useState(settings.name ?? '');
  const [birth, setBirth] = useState<BirthValue>(() => birthValueOf(settings.birthday, settings.humanDesign));
  const [saved, setSaved] = useState(false);
  const res = birthResult(birth);
  const chart = useMemo(() => (settings.humanDesign ? bodygraph(settings.humanDesign) : null), [settings.humanDesign]);
  const home = settings.locations.find((l) => l.id === settings.homeLocationId);
  // У тех, кто раньше вводил только день и месяц, года нет: оставляем как было, пока не введут полную дату.
  const keepOld = !birth.date && settings.birthday;

  const save = () => {
    void update({
      name: name.trim() || null,
      ...(keepOld ? {} : { birthday: res.birthday, humanDesign: res.humanDesign }),
      layers: { ...settings.layers, personal: keepOld ? settings.layers.personal : !!res.birthday },
    });
    haptic.success();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-4 pb-10">
      <header className="pt-2">
        <div className="font-display text-[26px] font-semibold">Мои данные</div>
        <div className="text-[14px] text-muted">хранятся на твоём телефоне</div>
      </header>
      <Card className="space-y-3">
        <Label>Как к тебе обращаться</Label>
        <input className={field} value={name} placeholder="Имя" onChange={(e) => setName(e.target.value)} maxLength={40} />
      </Card>
      <Card className="flex items-center justify-between" onClick={() => nav.push({ name: 'locations' })}>
        <span>
          <span className="block text-[14px] text-muted">Дом</span>
          <span className="block text-[16px]">{home?.name ?? 'не выбран'}</span>
          {home?.label && <span className="block text-[13px] text-faint">{home.label}</span>}
        </span>
        <span className="text-faint">›</span>
      </Card>
      {keepOld && settings.birthday && (
        <div className="px-1 text-[13px] leading-5 text-muted">
          Сейчас сохранены день и месяц рождения: {settings.birthday.day}.{pad(settings.birthday.month)}. Введи полную дату, чтобы обновить.
        </div>
      )}
      <BirthForm value={birth} onChange={setBirth} />
      <Button className="w-full" onClick={save}>
        {saved ? 'Сохранено ✓' : 'Сохранить'}
      </Button>
      {chart && (
        <Card className="!py-1">
          <Disclosure title="Мой бодиграф" subtitle="Дизайн человека">
            <ul className="space-y-1.5 text-[15px] leading-6">
              {hdProfileLines(chart).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </Disclosure>
        </Card>
      )}
    </div>
  );
}
