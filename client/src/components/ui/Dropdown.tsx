/*
Labelled single-choice dropdown with keyboard navigation, optional dividers and
a footer slot. Used for project and sort selection.
*/


import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { buttonClassName, type ButtonSize } from './buttonStyles';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  dividerBefore?: boolean;
}

export interface DropdownProps<T extends string> {
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  footer?: ReactNode;
  align?: 'start' | 'end';
  size?: ButtonSize;
  disabled?: boolean;
}

export function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  footer,
  align = 'start',
  size = 'sm',
  disabled = false,
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const listId = useId();
  const selectedOption = options.find((opt) => opt.value === value);
  const selectedLabel = selectedOption ? selectedOption.label : '';

  const activeOptionId =
    activeIndex >= 0 && activeIndex < options.length
      ? `${listId}-option-${activeIndex}`
      : undefined;

  useEffect(() => {
    if (isOpen) {
      listRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !activeOptionId) return;
    document.getElementById(activeOptionId)?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, activeOptionId]);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isOpen]);

  const selectOption = (optValue: T) => {
    onChange(optValue);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerClick = () => {
    if (disabled) return;
    if (!isOpen) {
      const idx = options.findIndex((opt) => opt.value === value);
      setActiveIndex(idx >= 0 ? idx : 0);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      if (!isOpen) {
        const idx = options.findIndex((opt) => opt.value === value);
        setActiveIndex(idx >= 0 ? idx : 0);
        setIsOpen(true);
      }
    }
  };

  const handleListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < options.length) {
        selectOption(options[activeIndex].value);
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  const handleRootKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (isOpen && e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div
      ref={rootRef}
      onKeyDown={handleRootKeyDown}
      className="relative inline-block"
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        className={buttonClassName('secondary', size, 'max-w-xs')}
      >
        <span className="text-ink-muted">{label}:</span>
        <span className="truncate text-ink">{selectedLabel}</span>
        <span
          className="material-symbols-outlined text-[16px] leading-none text-ink-muted"
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>

      {isOpen && (
        <div
          className={`absolute top-full mt-1 z-dropdown min-w-full w-max max-w-xs rounded-md border border-line-strong bg-canvas shadow-overlay py-1 ${
            align === 'end' ? 'right-0' : 'left-0'
          }`}
        >
          <ul
            id={listId}
            ref={listRef}
            role="listbox"
            aria-label={label}
            tabIndex={-1}
            aria-activedescendant={activeOptionId}
            onKeyDown={handleListKeyDown}
            className="outline-none max-h-72 overflow-y-auto custom-scrollbar"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;
              const optionId = `${listId}-option-${index}`;

              return (
                <Fragment key={option.value}>
                  {option.dividerBefore && (
                    <li role="separator" className="my-1 border-t border-line" />
                  )}
                  <li
                    id={optionId}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectOption(option.value)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex items-center gap-2 h-7 px-2 mx-1 rounded text-body text-ink cursor-pointer ${
                      isActive ? 'bg-subtle' : ''
                    }`}
                  >
                    {isSelected ? (
                      <span
                        className="material-symbols-outlined text-[16px] leading-none text-accent"
                        aria-hidden="true"
                      >
                        check
                      </span>
                    ) : (
                      <span className="w-4 shrink-0" aria-hidden="true" />
                    )}
                    <span className="truncate">{option.label}</span>
                  </li>
                </Fragment>
              );
            })}
          </ul>

          {footer && (
            <div
              className="mt-1 border-t border-line px-1 pt-1"
              onClick={() => setIsOpen(false)}
            >
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
