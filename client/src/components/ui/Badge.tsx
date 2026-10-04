import type { ReactNode } from 'react';

export type BadgeTone = 'teal' | 'amber' | 'red' | 'slate';

export interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}

const toneStyles: Record<BadgeTone, string> = {
  teal: 'bg-status-teal-bg text-status-teal-text border-status-teal-border',
  amber: 'bg-status-amber-bg text-status-amber-text border-status-amber-border',
  red: 'bg-status-red-bg text-status-red-text border-status-red-border',
  slate: 'bg-status-slate-bg text-status-slate-text border-status-slate-border',
};

const dotStyles: Record<BadgeTone, string> = {
  teal: 'bg-accent',
  amber: 'bg-status-amber-dot',
  red: 'bg-status-red-dot',
  slate: 'bg-ink-muted',
};

export function Badge({
  tone = 'slate',
  dot = false,
  title,
  className,
  children,
}: BadgeProps) {
  const baseClasses =
    'inline-flex items-center gap-1.5 h-5 px-1.5 rounded-badge border text-badge whitespace-nowrap';
  const classes = [baseClasses, toneStyles[tone], className].filter(Boolean).join(' ');

  return (
    <span title={title} className={classes}>
      {dot && (
        <span
          className={`size-1.5 shrink-0 rounded-full ${dotStyles[tone]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
