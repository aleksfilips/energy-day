import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DateKey } from '../astro/time';
import { haptic, useTelegramBack } from '../telegram';
import { parseKey } from './format';
import { useToday } from './hooks';
import { useStore } from './store';
import { cx } from './ui';
import { CalendarScreen } from './screens/Calendar';
import { DayScreen } from './screens/Day';
import { DiaryScreen, EntryScreen } from './screens/Diary';
import { HelpScreen } from './screens/Help';
import { PickScreen } from './screens/Pick';
import { PairScreen } from './screens/Pair';
import { restoreDiaryIfEmpty } from '../diary/autoBackup';
import type { AreaKey } from '../synthesis/areas';
import { Onboarding } from './screens/Onboarding';
import { ProfileScreen } from './screens/Profile';
import { ReviewScreen } from './screens/Review';
import { LocationsScreen, SettingsScreen } from './screens/Settings';
import { TodayScreen } from './screens/Today';
import type { HdTab } from './screens/hd/common';

// Раздел «Дизайн человека» (D-148) — отдельным файлом: в нём таблица Хирона и мандала.
const HdScreen = lazy(() => import('./screens/hd/HdScreen'));
const HdTimeScreen = lazy(() => import('./screens/hd/HdScreen').then((m) => ({ default: m.TimeScreen })));
const HdPersonScreen = lazy(() => import('./screens/hd/HdScreen').then((m) => ({ default: m.PersonScreen })));
import { UpcomingScreen } from './screens/Upcoming';

export type Tab = 'today' | 'calendar' | 'upcoming' | 'diary' | 'more';
export type Route =
  | { name: 'day'; date: DateKey }
  | { name: 'entry'; date: DateKey }
  | { name: 'locations' }
  | { name: 'profile' }
  | { name: 'review' }
  | { name: 'help' }
  | { name: 'pick'; area?: AreaKey }
  | { name: 'pair' }
  | { name: 'hd'; tab?: HdTab }
  | { name: 'hdTime' }
  | { name: 'person'; id: string };

export interface Nav {
  push: (r: Route) => void;
  replace: (r: Route) => void;
  pop: () => void;
}

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'today', label: 'Сегодня', icon: <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" /> },
  {
    id: 'calendar',
    label: 'Месяц',
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="4" y="5.5" width="16" height="14" rx="3" />
        <path d="M4 10h16M9 3.5v4M15 3.5v4" strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: 'upcoming',
    label: 'События',
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M5 7h14M5 12h10M5 17h6" />
      </g>
    ),
  },
  {
    id: 'diary',
    label: 'Дневник',
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M6 4h10a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2z" />
      </g>
    ),
  },
  {
    id: 'more',
    label: 'Ещё',
    icon: (
      <g fill="currentColor">
        <circle cx="6" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="18" cy="12" r="1.6" />
      </g>
    ),
  },
];

export function App() {
  const { ready, settings, location } = useStore();
  const today = useToday();
  const [tab, setTab] = useState<Tab>('today');
  const [stack, setStack] = useState<Route[]>([]);
  const [ym, setYm] = useState(() => {
    const { y, m } = parseKey(today);
    return { y, m };
  });
  const scroller = useRef<HTMLDivElement>(null);

  const nav: Nav = useMemo(
    () => ({
      push: (r) => {
        haptic.tap('soft');
        setStack((s) => [...s, r]);
      },
      replace: (r) => setStack((s) => [...s.slice(0, -1), r]),
      pop: () => setStack((s) => s.slice(0, -1)),
    }),
    [],
  );

  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  useEffect(() => useTelegramBack(stack.length ? back : null), [stack.length, back]);
  // Новый телефон: вернуть дневник из облака Telegram, если здесь он пуст (D-141).
  useEffect(() => {
    if (ready && settings.onboarded) void restoreDiaryIfEmpty();
  }, [ready, settings.onboarded]);
  // Открыли из бота кнопкой «Записать в дневник» (…?open=entry, D-146).
  useEffect(() => {
    if (!ready || !settings.onboarded) return;
    const p = new URLSearchParams(window.location.search);
    if (p.get('open') === 'entry') {
      setStack([{ name: 'entry', date: today }]);
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, settings.onboarded]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [tab, stack]);

  if (!ready) return <div className="h-full bg-bg" />;
  if (!settings.onboarded) return <Onboarding />;

  const top = stack[stack.length - 1];
  let screen: ReactNode;
  if (!location && (!top || top.name !== 'locations')) {
    screen = <LocationsScreen nav={nav} />;
  } else if (top) {
    screen =
      top.name === 'day' ? (
        <DayScreen key={top.date} date={top.date} nav={nav} />
      ) : top.name === 'entry' ? (
        <EntryScreen key={top.date} date={top.date} nav={nav} />
      ) : top.name === 'locations' ? (
        <LocationsScreen nav={nav} />
      ) : top.name === 'profile' ? (
        <ProfileScreen nav={nav} />
      ) : top.name === 'review' ? (
        <ReviewScreen nav={nav} />
      ) : top.name === 'pair' ? (
        <PairScreen nav={nav} />
      ) : top.name === 'hd' ? (
        <HdScreen nav={nav} tab={top.tab} />
      ) : top.name === 'hdTime' ? (
        <HdTimeScreen nav={nav} />
      ) : top.name === 'person' ? (
        <HdPersonScreen key={top.id} id={top.id} nav={nav} />
      ) : top.name === 'pick' ? (
        <PickScreen nav={nav} initial={top.area} />
      ) : (
        <HelpScreen onReview={() => nav.push({ name: 'review' })} />
      );
  } else {
    screen =
      tab === 'today' ? (
        <TodayScreen nav={nav} openUpcoming={() => setTab('upcoming')} />
      ) : tab === 'calendar' ? (
        <CalendarScreen nav={nav} ym={ym} setYm={setYm} />
      ) : tab === 'upcoming' ? (
        <UpcomingScreen nav={nav} />
      ) : tab === 'diary' ? (
        <DiaryScreen nav={nav} />
      ) : (
        <SettingsScreen nav={nav} />
      );
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scroller} className="safe-top flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[560px] px-4">
          {top && !window.Telegram?.WebApp?.initData && (
            <button onClick={back} className="pt-3 text-[15px] text-accent">
              ‹ Назад
            </button>
          )}
          <div key={top ? `${stack.length}-${top.name}` : tab} className={top ? 'push-in' : 'fade-in'}>
            <Suspense fallback={<div className="pt-24 text-center text-[14px] text-faint">Открываю…</div>}>{screen}</Suspense>
          </div>
        </div>
      </div>
      <nav className="safe-bottom border-t border-line bg-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[560px]">
          {TABS.map((t) => {
            const active = !top && tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  haptic.select();
                  setStack([]);
                  setTab(t.id);
                }}
                className={cx('flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10px] transition', active ? 'text-ink' : 'text-faint')}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
                  {t.icon}
                </svg>
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Telegram?: any;
  }
}
