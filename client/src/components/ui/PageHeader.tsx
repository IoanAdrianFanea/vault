/*
Page title block with an optional description, back link and action buttons.
*/


import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { textActionClassName } from './textActionStyles';

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  back?: {
    label: string;
    to: string;
  };
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  back,
  actions,
  className = '',
}: PageHeaderProps) {
  const containerClasses = [
    'flex shrink-0 items-start justify-between gap-4',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses}>
      <div className="min-w-0">
        {back && (
          <Link
            to={back.to}
            className={textActionClassName(
              'muted',
              'label',
              'mb-1 inline-flex items-center gap-1',
            )}
          >
            <span
              className="material-symbols-outlined text-[14px] leading-none"
              aria-hidden="true"
            >
              arrow_back
            </span>
            <span>{back.label}</span>
          </Link>
        )}
        <h1 className="text-page-title text-ink">{title}</h1>
        {description && (
          <p className="mt-0.5 text-body text-ink-muted tabular-nums">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
