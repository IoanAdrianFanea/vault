/*
Styled text input with sizes, an optional leading icon and an invalid state.
*/


import type { InputHTMLAttributes, Ref } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md';
  leadingIcon?: string;
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export function Input({
  size = 'md',
  leadingIcon,
  invalid = false,
  className,
  ref,
  ...rest
}: InputProps) {
  const baseClasses =
    'block w-full rounded border bg-canvas px-2.5 text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 disabled:bg-subtle disabled:text-ink-muted';

  const sizeClass = size === 'sm' ? 'h-7' : 'h-[30px]';
  const iconPadding = leadingIcon ? 'pl-8' : '';
  const stateClass = invalid
    ? 'border-status-red-text focus:border-status-red-text focus:ring-status-red-text'
    : 'border-line focus:border-accent focus:ring-accent';

  const inputClasses = [baseClasses, sizeClass, iconPadding, stateClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="relative">
      {leadingIcon && (
        <span
          className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] leading-none text-ink-muted"
          aria-hidden="true"
        >
          {leadingIcon}
        </span>
      )}
      <input
        ref={ref}
        aria-invalid={invalid ? 'true' : undefined}
        className={inputClasses}
        {...rest}
      />
    </div>
  );
}
