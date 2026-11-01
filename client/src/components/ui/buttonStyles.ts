/*
Tailwind class definitions shared by Button, ButtonLink and IconButton, so every
button variant and size looks the same.
*/


export type ButtonVariant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'danger' | 'inverse';
export type ButtonSize = 'sm' | 'md';

const baseStyles =
  'inline-flex items-center justify-center gap-1.5 rounded text-body font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 max-md:text-[15px]';

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  dark: 'bg-action text-white hover:bg-action-hover',
  secondary: 'bg-canvas text-ink-body border border-line hover:bg-subtle hover:border-line-strong',
  ghost: 'text-ink-body hover:bg-subtle',
  danger: 'bg-canvas text-status-red-text border border-line hover:bg-status-red-bg hover:border-status-red-border',
  inverse: 'text-white hover:bg-white/10',
};

// `touch:` sizes give every button a 44px target on touch screens.
const textButtonSizeStyles: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 touch:h-11',
  md: 'h-8 px-3 touch:h-11',
};

const iconButtonSizeStyles: Record<ButtonSize, string> = {
  sm: 'size-7 touch:size-11',
  md: 'size-8 touch:size-11',
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
