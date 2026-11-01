/*
Left slide-in menu for tablet portrait screens, holding the sidebar content. It
closes on Escape or a tap outside, traps focus while open and returns focus to
the menu button when it closes.
*/


import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '../ui';
import { getFocusableElements } from '../ui/focusable';

export interface ShellMenuDrawerProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function ShellMenuDrawer({ id, isOpen, onClose, children }: ShellMenuDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (document.activeElement instanceof HTMLElement) {
      returnElementRef.current = document.activeElement;
    }
    const panel = panelRef.current;
    if (panel) {
      const focusables = getFocusableElements(panel);
      (focusables[0] ?? panel).focus();
    }

    return () => {
      if (returnElementRef.current && returnElementRef.current.isConnected) {
        returnElementRef.current.focus();
      }
    };
  }, [isOpen]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'Tab') {
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = getFocusableElements(panel);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-modal">
      <div
        className="absolute inset-0 bg-ink/40"
        aria-hidden="true"
        onMouseDown={onClose}
      />
      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="absolute inset-y-0 left-0 flex w-60 flex-col border-r border-line-strong bg-subtle shadow-overlay focus:outline-none motion-safe:animate-drawer-in"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line pl-4 pr-2">
          <p className="text-panel text-ink">Menu</p>
          <IconButton icon="close" label="Close menu" onClick={onClose} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto custom-scrollbar px-3 py-4">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
