/*
Accessible modal dialog rendered in a portal, with a focus trap, Escape to
close, a configurable size and a footer slot. The base for every modal and
confirmation dialog.
*/


import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './IconButton';
import { getFocusableElements } from './focusable';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  headerAside?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'ml' | 'lg' | 'xl';
  layer?: 'modal' | 'confirm';
  role?: 'dialog' | 'alertdialog';
  showCloseButton?: boolean;
  closeDisabled?: boolean;
  ariaDescribedBy?: string;
  bodyClassName?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

const sizeClasses: Record<'sm' | 'md' | 'ml' | 'lg' | 'xl', string> = {
  sm: 'max-w-[400px]',
  md: 'max-w-[480px]',
  ml: 'max-w-[640px]',
  lg: 'max-w-[720px]',
  xl: 'max-w-[1040px]',
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  headerAside,
  footer,
  size = 'md',
  layer = 'modal',
  role = 'dialog',
  showCloseButton = true,
  closeDisabled = false,
  ariaDescribedBy,
  bodyClassName,
  initialFocusRef,
  children,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (document.activeElement instanceof HTMLElement) {
      returnElementRef.current = document.activeElement;
    }

    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
    } else {
      const panel = panelRef.current;
      if (panel) {
        const focusables = getFocusableElements(panel);
        if (focusables.length > 0) {
          focusables[0].focus();
        } else {
          panel.focus();
        }
      }
    }

    return () => {
      if (returnElementRef.current && returnElementRef.current.isConnected) {
        returnElementRef.current.focus();
      }
    };
  }, [isOpen, initialFocusRef]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      if (!closeDisabled) {
        onClose();
      }
      return;
    }

    if (e.key === 'Tab') {
      e.stopPropagation();
      const panel = panelRef.current;
      if (!panel) return;

      const focusables = getFocusableElements(panel);
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || document.activeElement === panel) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 ${
        layer === 'confirm' ? 'z-confirm' : 'z-modal'
      } flex items-center justify-center p-4`}
    >
      <div
        className="absolute inset-0 bg-ink/40"
        aria-hidden="true"
        onMouseDown={() => {
          if (!closeDisabled) onClose();
        }}
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={ariaDescribedBy ?? (description ? descriptionId : undefined)}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`relative flex max-h-[calc(100vh-2rem)] w-full flex-col rounded-md border border-line-strong bg-canvas shadow-overlay focus:outline-none ${sizeClasses[size]}`}
      >
        <header className="flex items-start gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-panel text-ink">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-0.5 text-small text-ink-muted tabular-nums">
                {description}
              </p>
            )}
          </div>
          {headerAside && <div className="shrink-0 pt-0.5">{headerAside}</div>}
          {showCloseButton && (
            <IconButton
              icon="close"
              label="Close"
              size="sm"
              variant="ghost"
              onClick={onClose}
              disabled={closeDisabled}
              className="-mr-1.5 -mt-0.5"
            />
          )}
        </header>

        <div
          className={`min-h-0 flex-1 overflow-y-auto custom-scrollbar ${
            bodyClassName ?? 'px-4 py-3'
          }`}
        >
          {children}
        </div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-line bg-subtle px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
