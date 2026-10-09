/*
Wraps a form control with an uppercase label, plus either an error message or a
hint below it.
*/


import { useId, type ReactNode } from 'react';

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: FormFieldProps) {
  const labelId = useId();

  return (
    <div
      className={className}
      role={htmlFor ? undefined : 'group'}
      aria-labelledby={htmlFor ? undefined : labelId}
    >
      {htmlFor ? (
        <label htmlFor={htmlFor} className="mb-1 block text-label uppercase text-ink-muted">
          {label}
        </label>
      ) : (
        <span id={labelId} className="mb-1 block text-label uppercase text-ink-muted">
          {label}
        </span>
      )}

      {children}

      {error ? (
        <p role="alert" className="mt-1 text-small text-status-red-text">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-small text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
