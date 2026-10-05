import type { ButtonHTMLAttributes, Ref } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { buttonClassName, type ButtonSize, type ButtonVariant } from './buttonStyles';
import { Spinner } from './Spinner';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  icon,
  loading = false,
  disabled,
  className,
  ref,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading ? 'true' : undefined}
      className={buttonClassName(variant, size, className)}
      {...rest}
    >
      {loading ? (
        <Spinner size="sm" />
      ) : icon ? (
        <span className="material-symbols-outlined text-[16px] leading-none" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClassName(variant, size, className)} {...rest}>
      {icon ? (
        <span className="material-symbols-outlined text-[16px] leading-none" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </Link>
  );
}
