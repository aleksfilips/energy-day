/**
 * Тонкая обёртка над Telegram WebApp API. Вне Telegram всё молча деградирует.
 * https://core.telegram.org/bots/webapps
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type TgWebApp = any;

export function tg(): TgWebApp | null {
  const w = (globalThis as any).window?.Telegram?.WebApp;
  return w && w.initData !== undefined ? w : null;
}

export function inTelegram(): boolean {
  const t = tg();
  return Boolean(t && (t.initData || t.platform !== 'unknown'));
}

export function initTelegram(bg: string): void {
  const t = tg();
  if (!t) return;
  try {
    t.ready();
    t.expand();
    t.setHeaderColor?.(bg);
    t.setBackgroundColor?.(bg);
    t.setBottomBarColor?.(bg);
    t.disableVerticalSwipes?.();
  } catch {
    /* старые клиенты */
  }
}

export function setTelegramColors(bg: string): void {
  const t = tg();
  try {
    t?.setHeaderColor?.(bg);
    t?.setBackgroundColor?.(bg);
    t?.setBottomBarColor?.(bg);
  } catch {
    /* ignore */
  }
}

let hapticsOn = true;
export function setHaptics(on: boolean): void {
  hapticsOn = on;
}

export const haptic = {
  select(): void {
    if (hapticsOn) tg()?.HapticFeedback?.selectionChanged?.();
  },
  tap(style: 'light' | 'medium' | 'soft' = 'light'): void {
    if (hapticsOn) tg()?.HapticFeedback?.impactOccurred?.(style);
  },
  success(): void {
    if (hapticsOn) tg()?.HapticFeedback?.notificationOccurred?.('success');
  },
};

/** Кнопка «Назад» Telegram. Возвращает функцию отписки. */
export function useTelegramBack(onBack: (() => void) | null): () => void {
  const t = tg();
  if (!t?.BackButton) return () => {};
  if (!onBack) {
    t.BackButton.hide();
    return () => {};
  }
  t.BackButton.show();
  t.BackButton.onClick(onBack);
  return () => {
    t.BackButton.offClick(onBack);
  };
}

export function telegramUserName(): string | null {
  return tg()?.initDataUnsafe?.user?.first_name ?? null;
}

export function telegramColorScheme(): 'dark' | 'light' | null {
  return tg()?.colorScheme ?? null;
}

/** CloudStorage: 1024 ключа по 4096 символов. Дневник режется на куски. */
const cloud = () => tg()?.CloudStorage ?? null;

export function cloudAvailable(): boolean {
  const t = tg();
  return Boolean(cloud() && t?.isVersionAtLeast?.('6.9'));
}

function cloudCall<T>(method: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const c = cloud();
    if (!c) return reject(new Error('CloudStorage недоступен'));
    c[method](...args, (err: unknown, res: T) => (err ? reject(err) : resolve(res)));
  });
}

const CHUNK = 4000;

export async function cloudSave(key: string, data: string): Promise<void> {
  const parts = Math.ceil(data.length / CHUNK) || 1;
  if (parts > 900) throw new Error('Слишком большой объём для облака Telegram');
  for (let i = 0; i < parts; i++) await cloudCall('setItem', `${key}_${i}`, data.slice(i * CHUNK, (i + 1) * CHUNK));
  await cloudCall('setItem', `${key}_n`, String(parts));
}

export async function cloudLoad(key: string): Promise<string | null> {
  const n = Number(await cloudCall<string>('getItem', `${key}_n`).catch(() => ''));
  if (!n) return null;
  const keys = Array.from({ length: n }, (_, i) => `${key}_${i}`);
  const res = await cloudCall<Record<string, string>>('getItems', keys);
  return keys.map((k) => res[k] ?? '').join('');
}

export function openLink(url: string): void {
  const t = tg();
  if (t?.openLink) t.openLink(url);
  else window.open(url, '_blank', 'noopener');
}

/** Скачать файл: в Telegram 8.0+ — downloadFile, иначе обычная ссылка. */
export function downloadText(filename: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Значок приложения на главном экране телефона (Telegram 8.0+, D-146). */
export type HomeScreenStatus = 'unsupported' | 'unknown' | 'added' | 'missed';
export function homeScreenStatus(cb: (s: HomeScreenStatus) => void): void {
  const t = tg();
  if (!t?.addToHomeScreen || !t.isVersionAtLeast?.('8.0')) return cb('unsupported');
  try {
    t.checkHomeScreenStatus((s: HomeScreenStatus) => cb(s));
  } catch {
    cb('unknown');
  }
}
export function addToHomeScreen(): void {
  try {
    tg()?.addToHomeScreen?.();
  } catch {
    /* старые клиенты */
  }
}
