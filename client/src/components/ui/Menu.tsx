import { Fragment, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from './Button';
import type { ButtonSize } from './buttonStyles';
import { Popover } from './Popover';

export interface MenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  dividerBefore?: boolean;
}

export interface MenuProps {
  label: string;
  icon?: string;
  items: MenuItem[];
  align?: 'start' | 'end';
  size?: ButtonSize;
}

export function Menu({
  label,
  icon,
  items,
  align = 'end',
  size = 'sm',
}: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  const handleMenuKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const list = listRef.current;
    if (!list) return;

    const enabledItems = Array.from(
      list.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
    );
    if (enabledItems.length === 0) return;

    const currentIndex = enabledItems.findIndex((el) => el === document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % enabledItems.length;
      enabledItems[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIndex =
        currentIndex <= 0 ? enabledItems.length - 1 : (currentIndex - 1) % enabledItems.length;
      enabledItems[nextIndex]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      enabledItems[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      enabledItems[enabledItems.length - 1]?.focus();
    }
  };

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      kind="menu"
      label={label}
      align={align}
      panelClassName="min-w-56 py-1"
      renderTrigger={(triggerProps) => (
        <Button {...triggerProps} variant="secondary" size={size} icon={icon}>
          {label}
          <span
            className="material-symbols-outlined text-[16px] leading-none text-ink-muted"
            aria-hidden="true"
          >
            expand_more
          </span>
        </Button>
      )}
    >
      {({ close }) => (
        <ul
          ref={listRef}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          className="outline-none"
        >
          {items.map((item) => (
            <Fragment key={item.id}>
              {item.dividerBefore && (
                <li role="separator" className="my-1 border-t border-line" />
              )}
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    close();
                    item.onSelect();
                  }}
                  className="flex h-7 w-full items-center px-3 text-left text-body text-ink whitespace-nowrap tabular-nums hover:bg-subtle focus:bg-subtle focus:outline-none disabled:cursor-not-allowed disabled:text-ink-muted disabled:hover:bg-transparent"
                >
                  {item.label}
                </button>
              </li>
            </Fragment>
          ))}
        </ul>
      )}
    </Popover>
  );
}
