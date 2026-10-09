/*
Centred placeholder with an icon, title, description and optional action, shown
when a list has nothing to display.
*/


import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const containerClasses = [
    'flex flex-col items-center justify-center gap-1 px-6 py-12 text-center',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses}>
      {icon && (
        <span
          className="material-symbols-outlined mb-2 text-[32px] leading-none text-ink-muted"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <h2 className="text-panel text-ink">{title}</h2>
      {description && <p className="max-w-sm text-body text-ink-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
