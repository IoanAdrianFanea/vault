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
import { useIsPhone } from '../../hooks/useMediaQuery';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  headerAside?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'ml' | 'lg' | 'xl';
  // `sheet` slides up from the bottom of the screen with rounded top corners.
  variant?: 'dialog' | 'sheet';
  layer?: 'modal' | 'confirm';
  role?: 'dialog' | 'alertdialog';
  showCloseButton?: boolean;
  closeDisabled?: boolean;
  // Dialogs fill the screen on phones unless this is false.
  fullScreenOnPhone?: boolean;
  // On phones, close with a back arrow at the start of the header instead of a cross.
  phoneCloseStyle?: 'close' | 'back';
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
  variant = 'dialog',
  layer = 'modal',
  role = 'dialog',
  showCloseButton = true,
  closeDisabled = false,
  fullScreenOnPhone = true,
  phoneCloseStyle = 'close',
  ariaDescribedBy,
  bodyClassName,
  initialFocusRef,
  children,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnElementRef = useRef<HTMLElement | null>(null);
  const isPhone = useIsPhone();
  const isSheet = variant === 'sheet';
  const isFullScreen = !isSheet && fullScreenOnPhone;
  const showBackButton = isPhone && isFullScreen && phoneCloseStyle === 'back';

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

  const overlayClasses = [
    'fixed inset-0',
    layer === 'confirm' ? 'z-confirm' : 'z-modal',
    isSheet
      ? 'flex items-end justify-center md:items-center md:p-4'
      : 'flex items-center justify-center p-4',
    isFullScreen ? 'max-md:p-0' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const panelClasses = isSheet
    ? `relative flex max-h-[calc(100dvh-4rem)] w-full flex-col rounded-t-lg border-t border-line-strong bg-canvas shadow-overlay focus:outline-none motion-safe:animate-sheet-up md:max-h-[calc(100vh-2rem)] md:rounded-md md:border md:motion-safe:animate-none ${sizeClasses[size]}`
    : [
        `relative flex max-h-[calc(100vh-2rem)] w-full flex-col rounded-md border border-line-strong bg-canvas shadow-overlay focus:outline-none ${sizeClasses[size]}`,
        isFullScreen
          ? 'max-md:h-full max-md:max-h-none max-md:max-w-none max-md:rounded-none max-md:border-0'
          : '',
      ]
        .filter(Boolean)
        .join(' ');

  const headerClasses = [
    isSheet
      ? 'flex items-center gap-2 border-b border-line py-1.5 pl-4 pr-1'
      : 'flex items-start gap-3 border-b border-line px-4 py-3',
    showBackButton ? 'max-md:gap-1 max-md:pl-1' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const footerClasses = [
    'flex items-center justify-end gap-2 border-t border-line bg-subtle px-4 py-3',
    isSheet || isFullScreen ? 'max-md:bg-canvas max-md:pb-5' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <div className={overlayClasses}>
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
        className={panelClasses}
      >
        <header className={headerClasses}>
          {showBackButton && (
            <IconButton
              icon="arrow_back"
              label="Back"
              variant="ghost"
              onClick={onClose}
              disabled={closeDisabled}
              className="shrink-0 max-md:size-11"
            />
          )}
          <div className={`min-w-0 flex-1 ${showBackButton ? 'pt-2.5' : ''}`}>
            <h2
              id={titleId}
              className="truncate text-panel text-ink max-md:whitespace-normal max-md:[overflow-wrap:anywhere]"
            >
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-0.5 text-small text-ink-muted tabular-nums">
                {description}
              </p>
            )}
          </div>
          {headerAside && <div className="shrink-0 pt-0.5">{headerAside}</div>}
          {showCloseButton && !showBackButton && (
            <IconButton
              icon="close"
              label="Close"
              size="sm"
              variant="ghost"
              onClick={onClose}
              disabled={closeDisabled}
              className={isSheet ? 'max-md:size-11' : '-mr-1.5 -mt-0.5'}
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

        {footer && <footer className={footerClasses}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
