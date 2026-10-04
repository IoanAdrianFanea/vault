import type { ButtonHTMLAttributes } from 'react';
import { iconButtonClassName, type ButtonSize } from './buttonStyles';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  icon: string;
  label: string;
  variant?: 'ghost' | 'secondary';
  size?: ButtonSize;
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  type = 'button',
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={iconButtonClassName(variant, size, className)}
      {...rest}
    >
      <span className="material-symbols-outlined text-[18px] leading-none" aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}
