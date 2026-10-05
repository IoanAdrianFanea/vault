import type { ButtonHTMLAttributes } from 'react';
import {
  textActionClassName,
  type TextActionTone,
  type TextActionVariant,
} from './textActionStyles';

export interface TextActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: TextActionTone;
  variant?: TextActionVariant;
}

export function TextAction({
  tone = 'accent',
  variant = 'label',
  type = 'button',
  className,
  ...rest
}: TextActionProps) {
  return (
    <button
      type={type}
      className={textActionClassName(tone, variant, className)}
      {...rest}
    />
  );
}
