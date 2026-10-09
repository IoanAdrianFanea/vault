/*
Slim strip of dot-separated summary figures with an optional right-hand aside,
shown above lists.
*/


import { Fragment, type ReactNode } from 'react';

export interface SummaryBarProps {
  items: ReactNode[];
  aside?: ReactNode;
  className?: string;
}

export function SummaryBar({ items, aside, className }: SummaryBarProps) {
  const containerClasses = [
    'flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 min-h-8 rounded border border-line bg-subtle px-3 py-1.5 text-small text-ink-body tabular-nums',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses}>
      <div className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <Fragment key={index}>
            {index > 0 && (
              <span className="text-line-strong" aria-hidden="true">
                •
              </span>
            )}
            <span>{item}</span>
          </Fragment>
        ))}
      </div>
      {aside && <div className="flex items-center gap-3">{aside}</div>}
    </div>
  );
}
