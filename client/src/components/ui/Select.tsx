import type { Ref, SelectHTMLAttributes } from 'react';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: 'sm' | 'md';
  invalid?: boolean;
  ref?: Ref<HTMLSelectElement>;
}

export function Select({
  size = 'md',
  invalid = false,
  className,
  ref,
  children,
  ...rest
}: SelectProps) {
  const baseClasses =
    'block w-full rounded border bg-canvas py-0 pl-2.5 pr-8 text-body text-ink focus:outline-none focus:ring-1 disabled:bg-subtle disabled:text-ink-muted';

  const sizeClass = size === 'sm' ? 'h-7' : 'h-[30px]';
  const stateClass = invalid
    ? 'border-status-red-text focus:border-status-red-text focus:ring-status-red-text'
    : 'border-line focus:border-accent focus:ring-accent';

  const selectClasses = [baseClasses, sizeClass, stateClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <select
      ref={ref}
      aria-invalid={invalid ? 'true' : undefined}
      className={selectClasses}
      {...rest}
    >
      {children}
    </select>
  );
}
