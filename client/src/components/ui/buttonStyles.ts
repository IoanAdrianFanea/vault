export type ButtonVariant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'danger' | 'inverse';
export type ButtonSize = 'sm' | 'md';

const baseStyles =
  'inline-flex items-center justify-center gap-1.5 rounded text-body font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50';

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  dark: 'bg-action text-white hover:bg-action-hover',
  secondary: 'bg-canvas text-ink-body border border-line hover:bg-subtle hover:border-line-strong',
  ghost: 'text-ink-body hover:bg-subtle',
  danger: 'bg-canvas text-status-red-text border border-line hover:bg-status-red-bg hover:border-status-red-border',
  inverse: 'text-white hover:bg-white/10',
};

const textButtonSizeStyles: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5',
  md: 'h-8 px-3',
};

const iconButtonSizeStyles: Record<ButtonSize, string> = {
  sm: 'size-7',
  md: 'size-8',
};

export function buttonClassName(variant: ButtonVariant, size: ButtonSize, className?: string): string {
  return [baseStyles, variantStyles[variant], textButtonSizeStyles[size], className]
    .filter(Boolean)
    .join(' ');
}

export function iconButtonClassName(variant: ButtonVariant, size: ButtonSize, className?: string): string {
  return [baseStyles, variantStyles[variant], iconButtonSizeStyles[size], className]
    .filter(Boolean)
    .join(' ');
}
