import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '../telegram';

export function cx(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ');
}

/** Путь освещённой части диска для угла фазы (0 — новолуние, 180 — полнолуние). */
export function moonLitPath(angle: number, r: number): string {
  const a = ((angle % 360) + 360) % 360;
  const rx = Math.abs(Math.cos((a * Math.PI) / 180)) * r;
  let d: string;
  if (a < 0.5 || a > 359.5) return '';
  if (Math.abs(a - 180) < 0.5) return `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r} Z`;
  if (a < 180) {
    d = `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${rx} ${r} 0 0 ${a > 90 ? 1 : 0} 0 ${-r} Z`;
  } else {
    d = `M 0 ${-r} A ${r} ${r} 0 0 0 0 ${r} A ${rx} ${r} 0 0 ${a < 270 ? 0 : 1} 0 ${-r} Z`;
  }
  return d;
}

/** Луна с реальной освещённостью. При появлении фаза мягко «доезжает» до текущей. */
export function Moon({ angle, size = 180, animate = true, southern = false }: { angle: number; size?: number; animate?: boolean; southern?: boolean }) {
  const id = useId().replace(/:/g, '');
  const [shown, setShown] = useState(animate ? angle - 40 : angle);
  const from = useRef(shown);
  useEffect(() => {
    if (!animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(angle);
      return;
    }
    const start = performance.now();
    const a0 = from.current;
    const delta = ((angle - a0 + 540) % 360) - 180;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 1100);
      const e = 1 - Math.pow(1 - p, 3);
      const v = a0 + delta * e;
      setShown(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [angle, animate]);
  const r = 46;
  const lit = moonLitPath(shown, r);
  return (
    <svg viewBox="-60 -60 120 120" width={size} height={size} role="img" aria-label="Фаза Луны">
      <defs>
        <radialGradient id={`g${id}`}>
          <stop offset="55%" stopColor="var(--moon-lit)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--moon-lit)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`s${id}`} cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="70%" stopColor="var(--moon-lit)" stopOpacity="1" />
          <stop offset="100%" stopColor="#bdbab2" stopOpacity="1" />
        </radialGradient>
        <clipPath id={`c${id}`}>
          <path d={lit} />
        </clipPath>
      </defs>
      <circle r="58" fill={`url(#g${id})`} className="moon-glow" />
      <g transform={southern ? 'scale(-1 1)' : undefined}>
      <circle r={r} fill="var(--moon-dark)" />
      <circle r={r} fill="none" stroke="var(--line)" strokeWidth="0.6" />
      {lit && <path d={lit} fill={`url(#s${id})`} />}
      {lit && (
        <g clipPath={`url(#c${id})`} fill="#7d7a73" opacity="0.07">
          <ellipse cx="-12" cy="-14" rx="13" ry="10" />
          <ellipse cx="10" cy="-6" rx="9" ry="12" />
          <ellipse cx="-4" cy="14" rx="15" ry="8" />
          <ellipse cx="20" cy="18" rx="6" ry="5" />
          <circle cx="-24" cy="6" r="5" />
        </g>
      )}
      </g>
    </svg>
  );
}

export function MiniMoon({ angle, size = 14 }: { angle: number; size?: number }) {
  const r = 10;
  return (
    <svg viewBox="-12 -12 24 24" width={size} height={size} aria-hidden>
      <circle r={r} fill="var(--moon-dark)" stroke="var(--faint)" strokeWidth="0.8" />
      <path d={moonLitPath(angle, r)} fill="var(--moon-lit)" />
    </svg>
  );
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ boxShadow: 'var(--shadow)' }}
      className={cx('rounded-[var(--radius-card)] border border-line bg-surface p-5', onClick && 'cursor-pointer active:scale-[0.99] transition-transform', className)}
    >
      {children}
    </div>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('text-[14px] font-medium text-muted', className)}>{children}</div>;
}

export function Chip({ children, tone = 'default', className }: { children: ReactNode; tone?: 'default' | 'accent' | 'soft'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] leading-5',
        tone === 'accent' && 'bg-accent-soft text-accent',
        tone === 'default' && 'bg-surface-2 text-ink',
        tone === 'soft' && 'border border-line text-muted',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'quiet';
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={() => {
        haptic.tap();
        onClick?.();
      }}
      className={cx(
        'inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-medium transition active:scale-[0.98] disabled:opacity-40',
        variant === 'primary' && 'bg-ink text-bg',
        variant === 'ghost' && 'bg-surface-2 text-ink',
        variant === 'quiet' && 'text-muted',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      className="flex w-full items-center justify-between gap-4 py-3 text-left"
      onClick={() => {
        haptic.select();
        onChange(!checked);
      }}
      role="switch"
      aria-checked={checked}
    >
      <span>
        <span className="block text-[15px]">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-muted">{hint}</span>}
      </span>
      <span className={cx('relative h-[30px] w-[50px] shrink-0 rounded-full transition', checked ? 'bg-accent' : 'bg-surface-2')}>
        <span className={cx('absolute top-[3px] h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-[23px]' : 'left-[3px]')} />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => {
            haptic.select();
            onChange(o.value);
          }}
          className={cx('h-9 flex-1 rounded-lg text-[14px] transition', value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Disclosure({ title, subtitle, children, defaultOpen = false, badge }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; defaultOpen?: boolean; badge?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-line first:border-t-0">
      <button
        className="flex w-full items-center justify-between gap-3 py-4 text-left"
        onClick={() => {
          haptic.select();
          setOpen(!open);
        }}
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-[16px] font-medium">
            {title}
            {badge}
          </span>
          {subtitle && <span className="mt-0.5 block text-[13px] text-muted">{subtitle}</span>}
        </span>
        <svg width="14" height="14" viewBox="0 0 14 14" className={cx('shrink-0 text-faint transition-transform', open && 'rotate-180')}>
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      {open && <div className="fade-in pb-5">{children}</div>}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    haptic.tap('soft');
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  // Портал: лист всегда поверх экрана, даже если родитель анимирован (transform ломает position: fixed).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="fade-in absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="sheet-up safe-bottom relative max-h-[88vh] w-full max-w-[560px] overflow-y-auto rounded-t-[28px] bg-surface px-5 pb-6 pt-3">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-2" />
        {title && <div className="mb-4 font-display text-[20px] font-semibold">{title}</div>}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export const TONE_COLOR: Record<string, string> = {
  активная: 'var(--tone-active)',
  переходная: 'var(--tone-transition)',
  созерцательная: 'var(--tone-calm)',
  бережная: 'var(--tone-gentle)',
};

export function ToneDot({ tone, size = 6 }: { tone: string | null; size?: number }) {
  return <span className="inline-block rounded-full" style={{ width: size, height: size, background: tone ? TONE_COLOR[tone] : 'var(--faint)' }} />;
}

export function List({ items, marker = '·' }: { items: string[]; marker?: string }) {
  return (
    <ul className="space-y-1.5">
      {items.map((x) => (
        <li key={x} className="flex gap-2 text-[15px] leading-6">
          <span className="text-faint">{marker}</span>
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

export function Rating({ value, onChange, max = 10, label }: { value: number | null; onChange: (v: number) => void; max?: number; label: string }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[15px]">{label}</span>
        <span className="font-display text-[22px] font-light tabular-nums">{value ?? '—'}</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            aria-label={`${label}: ${n}`}
            onClick={() => {
              haptic.select();
              onChange(n);
            }}
            className={cx('h-9 flex-1 rounded-lg transition', value !== null && n <= value ? 'bg-accent' : 'bg-surface-2')}
            style={value !== null && n <= value ? { opacity: 0.35 + (0.65 * n) / max } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export function SchoolNote({ children }: { children: ReactNode }) {
  return <div className="mt-3 text-[12px] leading-5 text-faint">{children}</div>;
}
