import { useId, useState } from 'react';
import { IconButton } from './IconButton';
import { Input, type InputProps } from './Input';

export type PasswordInputProps = Omit<InputProps, 'type' | 'leadingIcon'>;

export function PasswordInput({
  id,
  className = '',
  ...rest
}: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [isVisible, setIsVisible] = useState(false);

  const inputClasses = ['pr-9', className].filter(Boolean).join(' ');

  return (
    <div className="relative">
      <Input
        {...rest}
        id={inputId}
        type={isVisible ? 'text' : 'password'}
        className={inputClasses}
      />
      <IconButton
        size="sm"
        variant="ghost"
        icon={isVisible ? 'visibility_off' : 'visibility'}
        label={isVisible ? 'Hide password' : 'Show password'}
        aria-pressed={isVisible}
        aria-controls={inputId}
        onClick={() => setIsVisible((v) => !v)}
        className="absolute right-0.5 top-1/2 -translate-y-1/2"
      />
    </div>
  );
}
