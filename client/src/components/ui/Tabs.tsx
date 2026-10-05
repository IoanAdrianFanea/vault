import {
  useRef,
  type KeyboardEvent,
} from 'react';
import { NavLink } from 'react-router-dom';
import { Badge, type BadgeTone } from './Badge';
import { getTabId, getTabPanelId } from './tabIds';
import { formatCount } from '../../utils/format';

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  count?: number | null;
  countTone?: BadgeTone;
  to?: string;
  end?: boolean;
}

export interface TabsProps<T extends string> {
  label: string;
  items: TabItem<T>[];
  value?: T;
  onChange?: (value: T) => void;
  idPrefix?: string;
  variant?: 'underline' | 'segmented';
  className?: string;
}

export function Tabs<T extends string>({
  label,
  items,
  value,
  onChange,
  idPrefix = 'tabs',
  variant = 'underline',
  className = '',
}: TabsProps<T>) {
  const isRouted = items.every((item) => Boolean(item.to));
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (isRouted) {
    const navClasses = [
      'flex items-end gap-5 border-b border-line',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const linkBase =
      '-mb-px inline-flex h-9 items-center gap-1.5 border-b-2 px-0.5 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

    return (
      <nav aria-label={label} className={navClasses}>
        {items.map((item) => (
          <NavLink
            key={item.value}
            to={item.to!}
            end={item.end}
            className={({ isActive }) =>
              [
                linkBase,
                isActive
                  ? 'border-accent font-medium text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink',
              ].join(' ')
            }
          >
            <span>{item.label}</span>
            {typeof item.count === 'number' && item.count > 0 && (
              <Badge tone={item.countTone ?? 'slate'}>
                {formatCount(item.count)}
              </Badge>
            )}
          </NavLink>
        ))}
      </nav>
    );
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex = -1;

    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % items.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = items.length - 1;
    }

    if (nextIndex >= 0) {
      e.preventDefault();
      const nextItem = items[nextIndex];
      onChange?.(nextItem.value);
      tabRefs.current[nextIndex]?.focus();
    }
  };

  if (variant === 'segmented') {
    const containerClasses = [
      'inline-flex items-center gap-0.5 rounded border border-line bg-subtle p-0.5',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div role="tablist" aria-label={label} className={containerClasses}>
        {items.map((item, index) => {
          const isSelected = item.value === value;
          const countText =
            typeof item.count === 'number'
              ? ` (${formatCount(item.count)})`
              : '';

          return (
            <button
              key={item.value}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={getTabId(idPrefix, item.value)}
              aria-selected={isSelected}
              aria-controls={getTabPanelId(idPrefix, item.value)}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onChange?.(item.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={[
                'h-7 rounded-sm px-3 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                isSelected
                  ? 'bg-canvas font-medium text-ink ring-1 ring-line'
                  : 'text-ink-muted hover:text-ink',
              ].join(' ')}
            >
              <span>{item.label}</span>
              {countText && <span className="tabular-nums">{countText}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  const containerClasses = [
    'flex items-end gap-5 border-b border-line',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const tabBase =
    '-mb-px inline-flex h-9 items-center gap-1.5 border-b-2 px-0.5 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

  return (
    <div role="tablist" aria-label={label} className={containerClasses}>
      {items.map((item, index) => {
        const isSelected = item.value === value;

        return (
          <button
            key={item.value}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={getTabId(idPrefix, item.value)}
            aria-selected={isSelected}
            aria-controls={getTabPanelId(idPrefix, item.value)}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange?.(item.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={[
              tabBase,
              isSelected
                ? 'border-accent font-medium text-ink'
                : 'border-transparent text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            <span>{item.label}</span>
            {typeof item.count === 'number' && item.count > 0 && (
              <Badge tone={item.countTone ?? 'slate'}>
                {formatCount(item.count)}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
