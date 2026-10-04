import type { ReactNode } from 'react';
import { IconButton } from './IconButton';

export type InlineAlertTone = 'error' | 'warning' | 'info' | 'success';

export interface InlineAlertProps {
  tone?: InlineAlertTone;
  onDismiss?: () => void;
  className?: string;
  children: ReactNode;
}

const toneStyles: Record<InlineAlertTone, { classes: string; icon: string }> = {
  error: {
    classes: 'bg-status-red-bg border-status-red-border text-status-red-text',
    icon: 'error',
  },
  warning: {
    classes: 'bg-status-amber-bg border-status-amber-border text-status-amber-text',
    icon: 'warning',
  },
  info: {
    classes: 'bg-status-slate-bg border-status-slate-border text-status-slate-text',
    icon: 'info',
  },
  success: {
    classes: 'bg-status-teal-bg border-status-teal-border text-status-teal-text',
    icon: 'check_circle',
  },
};

export function InlineAlert({
  tone = 'error',
  onDismiss,
  className,
  children,
}: InlineAlertProps) {
  const currentTone = toneStyles[tone];
  const role = tone === 'error' || tone === 'warning' ? 'alert' : 'status';

  const containerClasses = [
    'flex items-start gap-2 rounded border px-3 py-2 text-body',
    currentTone.classes,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div role={role} className={containerClasses}>
      <span
        className="material-symbols-outlined text-[18px] leading-none shrink-0"
        aria-hidden="true"
      >
        {currentTone.icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <IconButton
          icon="close"
          label="Dismiss"
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="-my-1 -mr-1"
        />
      )}
    </div>
  );
}
