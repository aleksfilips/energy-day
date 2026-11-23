/** «Значок на главном экране» (D-146): открывать приложение одним касанием, без поиска бота в Telegram. */
import { useEffect, useState } from 'react';
import { addToHomeScreen, haptic, homeScreenStatus, type HomeScreenStatus } from '../../telegram';
import { Panel } from './Compact';

export function HomeScreenCard() {
  const [status, setStatus] = useState<HomeScreenStatus | null>(null);
  useEffect(() => homeScreenStatus(setStatus), []);
  if (!status || status === 'unsupported') return null;
  const added = status === 'added';
  return (
    <Panel className="flex items-center gap-4 p-4">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[24px]" style={{ background: 'color-mix(in srgb, var(--accent) 18%, transparent)' }}>
        🌙
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium">{added ? 'Значок уже на экране' : 'Значок на главный экран'}</div>
        <div className="text-[13px] leading-5 text-muted">{added ? 'Приложение открывается одним касанием.' : 'Открывать «Энергию дня» одним касанием, как обычное приложение.'}</div>
      </div>
      {!added && (
        <button
          className="shrink-0 rounded-full bg-accent px-4 py-2 text-[14px] font-semibold text-bg"
          onClick={() => {
            haptic.success();
            addToHomeScreen();
            setTimeout(() => homeScreenStatus(setStatus), 1500);
          }}
        >
          Добавить
        </button>
      )}
    </Panel>
  );
}
