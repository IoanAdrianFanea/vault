export type TextActionTone = 'accent' | 'muted' | 'danger';
export type TextActionVariant = 'label' | 'inline';

const baseStyles =
  'inline-flex items-center rounded-sm whitespace-nowrap transition-colors hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline';

const variantStyles: Record<TextActionVariant, string> = {
  label: 'text-label uppercase',
  inline: 'text-small font-medium',
};

const toneStyles: Record<TextActionTone, string> = {
  accent: 'text-accent hover:text-accent-hover',
  muted: 'text-ink-muted hover:text-ink',
  danger: 'text-status-red-text',
};

export function textActionClassName(
  tone: TextActionTone = 'accent',
  variant: TextActionVariant = 'label',
  className?: string,
): string {
  return [baseStyles, variantStyles[variant], toneStyles[tone], className]
    .filter(Boolean)
    .join(' ');
}
