/*
Styled checkbox with indeterminate support and an optional inline label.
*/


import type { InputHTMLAttributes, ReactNode } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  indeterminate?: boolean;
  label?: ReactNode;
}

export function Checkbox({
  indeterminate,
  label,
  className,
  ...rest
}: CheckboxProps) {
  const inputElement = (
    <input
      type="checkbox"
      // indeterminate is a DOM property, not an attribute
      ref={(el) => {
        if (el) el.indeterminate = Boolean(indeterminate);
      }}
      className={[
        'size-3.5 shrink-0 rounded-sm border-line-strong bg-canvas text-accent cursor-pointer focus:ring-1 focus:ring-accent focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );

  if (label) {
    return (
      <label className="inline-flex items-center gap-2 text-body text-ink-body cursor-pointer">
        {inputElement}
        {label}
      </label>
    );
  }

  return inputElement;
}
