/**
 * Поиск места: город, посёлок, деревня. Координаты и часовой пояс подставляются сами,
 * человек видит результат (область, координаты, пояс, местное время) и может проверить точку на карте.
 */
import { useEffect, useRef, useState } from 'react';
import { hasExact, mapLink, mergeResults, reverse, searchDetailed, searchQuick, type Place } from '../../places/geocode';
import { localNow, zoneLabel } from '../../places/timezone';
import { haptic, openLink } from '../../telegram';
import { Button, Card, cx } from '../ui';

const field = 'h-12 w-full rounded-2xl bg-surface-2 px-4 text-[16px] outline-none placeholder:text-faint';

export function PlaceSearch({
  onPick,
  placeholder = 'Город, посёлок или деревня',
  allowGps = true,
  autoFocus = false,
}: {
  onPick: (p: Place) => void;
  placeholder?: string;
  allowGps?: boolean;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailedFor, setDetailedFor] = useState<string | null>(null);
  const ctl = useRef<AbortController | null>(null);

  // Быстрый поиск по мере ввода (с паузой 600 мс).
  useEffect(() => {
    const query = q.trim();
    setError(null);
    if (query.length < 2) {
      setList([]);
      return;
    }
    const t = setTimeout(() => {
      ctl.current?.abort();
      const c = new AbortController();
      ctl.current = c;
      setBusy(true);
      searchQuick(query, c.signal)
        .then(async (r) => {
          if (c.signal.aborted) return;
          setList(r);
          setDetailedFor(null);
          // В быстрой базе нет места с таким названием — один раз ищем подробно по OpenStreetMap.
          if (!hasExact(query, r) && query.length >= 3) {
            const more = await searchDetailed(query, c.signal).catch(() => [] as Place[]);
            if (c.signal.aborted) return;
            setList(mergeResults(query, more, r));
            setDetailedFor(query);
          }
        })
        .catch((e) => !c.signal.aborted && setError(netError(e)))
        .finally(() => !c.signal.aborted && setBusy(false));
    }, 600);
    return () => clearTimeout(t);
  }, [q]);

  const detailed = () => {
    const query = q.trim();
    if (query.length < 2) return;
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setBusy(true);
    setError(null);
    searchDetailed(query, c.signal)
      .then((r) => {
        if (c.signal.aborted) return;
        setDetailedFor(query);
        setList((prev) => mergeResults(query, r, prev));
        if (!r.length) setError('Ничего не нашлось. Попробуй написать с районом или областью, например «Покровское Артёмовский».');
      })
      .catch((e) => !c.signal.aborted && setError(netError(e)))
      .finally(() => !c.signal.aborted && setBusy(false));
  };

  const gps = () => {
    setError(null);
    if (!navigator.geolocation) return setError('Телефон не даёт определить место. Найди его по названию.');
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        reverse(pos.coords.latitude, pos.coords.longitude)
          .then((p) => {
            haptic.success();
            onPick(p);
          })
          .finally(() => setBusy(false));
      },
      (e) => {
        setBusy(false);
        setError(e.code === 1 ? 'Доступ к геолокации не разрешён. Найди место по названию.' : 'Не удалось определить место. Найди его по названию.');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
    );
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          className={field}
          placeholder={placeholder}
          value={q}
          autoFocus={autoFocus}
          enterKeyHint="search"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && detailed()}
          aria-label="Название места"
        />
        {busy && <span className="spinner absolute right-4 top-1/2 -translate-y-1/2" aria-label="Ищу" />}
      </div>
      {list.length > 0 && (
        <Card className="!px-0 !py-1">
          {list.map((p, i) => (
            <button
              key={`${p.name}-${p.latitude}-${p.longitude}-${i}`}
              className="flex w-full items-start gap-3 border-t border-line px-5 py-3 text-left first:border-t-0 active:bg-surface-2"
              onClick={() => {
                haptic.select();
                onPick(p);
              }}
            >
              <PinIcon />
              <span className="min-w-0">
                <span className="block text-[16px]">{p.name}</span>
                <span className="block text-[13px] leading-5 text-muted">{p.label || 'без уточнения'}</span>
              </span>
            </button>
          ))}
        </Card>
      )}
      {q.trim().length >= 2 && detailedFor !== q.trim() && !busy && (
        <button className="w-full py-1 text-center text-[14px] text-accent" onClick={detailed}>
          {list.length ? 'Нет нужного? Искать подробнее' : 'Искать подробнее, по всем сёлам и деревням'}
        </button>
      )}
      {error && <div className="text-center text-[14px] leading-5 text-care">{error}</div>}
      {allowGps && (
        <Button variant="ghost" className="w-full" onClick={gps} disabled={busy}>
          <PinIcon /> Определить, где я сейчас
        </Button>
      )}
    </div>
  );
}

/** Карточка выбранного места: человек сам видит, что всё верно. */
export function PlaceConfirm({ place, onChange, hideNow = false }: { place: Place; onChange?: () => void; hideNow?: boolean }) {
  const tzWarn = place.tzSource === 'device' || place.tzSource === 'nearest';
  return (
    <Card className="rise-in space-y-3">
      <div className="flex items-start gap-3">
        <PinIcon big />
        <div className="min-w-0 flex-1">
          <div className="font-display text-[20px] font-semibold leading-tight">{place.name}</div>
          {place.label && <div className="mt-0.5 text-[14px] leading-5 text-muted">{place.label}</div>}
        </div>
        {onChange && (
          <button className="shrink-0 text-[14px] text-accent" onClick={onChange}>
            другое
          </button>
        )}
      </div>
      {hideNow ? (
        <Fact title="Координаты" value={`${place.latitude.toFixed(4)}°, ${place.longitude.toFixed(4)}°`} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 text-[13px]">
            <Fact title="Координаты" value={`${place.latitude.toFixed(4)}°, ${place.longitude.toFixed(4)}°`} />
            <Fact title="Сейчас там" value={localNow(place.timeZone)} />
          </div>
          <Fact title="Часовой пояс" value={zoneLabel(place.timeZone)} />
        </>
      )}
      {tzWarn && <div className="text-[13px] leading-5 text-care">Часовой пояс определён приблизительно. Проверь, что «сейчас там» совпадает с местными часами.</div>}
      <button className="text-[14px] text-accent" onClick={() => openLink(mapLink(place.latitude, place.longitude))}>
        Проверить на карте ›
      </button>
    </Card>
  );
}

function Fact({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <div className="text-[12px] text-faint">{title}</div>
      <div className="text-[14px] text-ink">{value}</div>
    </div>
  );
}

function PinIcon({ big = false }: { big?: boolean }) {
  const s = big ? 22 : 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" className={cx('shrink-0 text-accent', big ? 'mt-0.5' : 'mt-[3px]')} aria-hidden>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.3" fill="currentColor" />
    </svg>
  );
}

function netError(e: unknown): string {
  return String(e).includes('Abort') ? '' : 'Нет связи с поиском мест. Проверь интернет и попробуй ещё раз.';
}
