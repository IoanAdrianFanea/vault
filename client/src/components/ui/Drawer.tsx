import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react';
import { IconButton } from './IconButton';

export interface DrawerProps {
  title: ReactNode;
  headerAside?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function Drawer({
  title,
  headerAside,
  description,
  footer,
  onClose,
  children,
  className = '',
}: DrawerProps) {
  const titleId = useId();
  const asideRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    asideRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[aria-modal="true"]')) return;

      onCloseRef.current();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const containerClasses = [
    'flex w-[360px] shrink-0 flex-col border-l border-line bg-canvas focus:outline-none',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <aside
      ref={asideRef}
      aria-labelledby={titleId}
      tabIndex={-1}
      className={containerClasses}
    >
      <header className="flex items-start gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="truncate text-panel text-ink">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-small text-ink-muted">{description}</p>
          )}
        </div>
        {headerAside && <div className="shrink-0 pt-0.5">{headerAside}</div>}
        <IconButton
          icon="close"
          label="Close"
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="-mr-1.5 -mt-0.5"
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-4 py-3">
        {children}
      </div>

      {footer && (
        <footer className="flex items-center gap-2 border-t border-line bg-subtle px-4 py-3">
          {footer}
        </footer>
      )}
    </aside>
  );
}
