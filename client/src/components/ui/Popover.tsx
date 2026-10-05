import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { getFocusableElements } from './focusable';

export interface PopoverTriggerProps {
  ref: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
  'aria-expanded': boolean;
  'aria-controls': string;
  'aria-haspopup': 'dialog' | 'menu';
}

export interface PopoverRenderApi {
  close: () => void;
}

export interface PopoverProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  renderTrigger: (props: PopoverTriggerProps) => ReactNode;
  children: (api: PopoverRenderApi) => ReactNode;
  label: string;
  kind?: 'dialog' | 'menu';
  align?: 'start' | 'end';
  panelClassName?: string;
}

export function Popover({
  isOpen,
  onOpenChange,
  renderTrigger,
  children,
  label,
  kind = 'dialog',
  align = 'start',
  panelClassName,
}: PopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const panelId = useId();

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      triggerRef.current?.focus();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const panel = panelRef.current;
    if (panel) {
      const focusables = getFocusableElements(panel);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        panel.focus();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isOpen, onOpenChange]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (isOpen && e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      close();
    }
  };

  const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (
      isOpen &&
      e.relatedTarget &&
      rootRef.current &&
      !rootRef.current.contains(e.relatedTarget as Node)
    ) {
      onOpenChange(false);
    }
  };

  const triggerProps: PopoverTriggerProps = {
    ref: triggerRef,
    onClick: () => onOpenChange(!isOpen),
    'aria-expanded': isOpen,
    'aria-controls': panelId,
    'aria-haspopup': kind,
  };

  return (
    <div
      ref={rootRef}
      className="relative inline-block"
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      {renderTrigger(triggerProps)}

      {isOpen && (
        <div
          ref={panelRef}
          id={panelId}
          role={kind === 'dialog' ? 'dialog' : undefined}
          aria-label={kind === 'dialog' ? label : undefined}
          tabIndex={-1}
          className={`absolute top-full mt-1 z-popover rounded-md border border-line-strong bg-canvas shadow-overlay focus:outline-none ${
            align === 'end' ? 'right-0' : 'left-0'
          } ${panelClassName ?? ''}`}
        >
          {children({ close })}
        </div>
      )}
    </div>
  );
}
