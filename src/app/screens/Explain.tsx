/** Общие кусочки пояснений: «что это», подзаголовок, списки «хорошо / лучше не», совет. */
import type { ReactNode } from 'react';

/** Блок «Что это» — спокойный, чтобы не спорил с главным. */
export function About({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-4 py-3">
      <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-faint">Что это</div>
      <p className="mt-1 text-[14px] leading-[1.5] text-muted">{children}</p>
    </div>
  );
}

export function SubTitle({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <div className="mb-1.5 text-[15px] font-semibold" style={color ? { color } : undefined}>
      {children}
    </div>
  );
}

export function GoodBad({ good, bad, goodTitle = 'Хорошо сегодня', badTitle = 'Лучше не стоит' }: { good: string[]; bad: string[]; goodTitle?: string; badTitle?: string }) {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return (
    <div className="grid gap-4">
      {good.length > 0 && (
        <div>
          <SubTitle color="var(--good)">{goodTitle}</SubTitle>
          <ul className="space-y-1.5">
            {good.map((x) => (
              <li key={x} className="flex gap-2.5 text-[15px] leading-6">
                <span className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-good-soft text-[11px] text-good">✓</span>
                {cap(x)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {bad.length > 0 && (
        <div>
          <SubTitle color="var(--bad)">{badTitle}</SubTitle>
          <ul className="space-y-1.5">
            {bad.map((x) => (
              <li key={x} className="flex gap-2.5 text-[15px] leading-6">
                <span className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-bad-soft text-[11px] text-bad">✕</span>
                {cap(x)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function Tip({ title = 'Совет на день', children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-accent-soft px-4 py-3">
      <div className="text-[14px] font-medium text-accent">{title}</div>
      <p className="mt-1 text-[15px] leading-6">{children}</p>
    </div>
  );
}
