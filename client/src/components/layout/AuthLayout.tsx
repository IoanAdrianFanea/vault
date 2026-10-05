import type { ReactNode } from 'react';

export interface AuthLayoutProps {
  title?: string;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function AuthLayout({
  title,
  description,
  footer,
  children,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-subtle px-4 py-10 font-sans">
      <div className="mb-6 flex items-center gap-2.5">
        <div className="size-9 rounded-md bg-accent text-white flex items-center justify-center">
          <span
            className="material-symbols-outlined text-[20px] leading-none"
            aria-hidden="true"
          >
            lock
          </span>
        </div>
        <div>
          <p className="text-panel text-ink">DocIndex Manager</p>
          <p className="text-small text-ink-muted">Site document register</p>
        </div>
      </div>

      <div className="w-full max-w-[400px] rounded-md border border-line bg-canvas p-6 sm:p-8">
        {title && (
          <div>
            <h1 className="text-page-title text-ink">{title}</h1>
            {description && (
              <p className="mt-1 text-body text-ink-muted">{description}</p>
            )}
          </div>
        )}
        <div className={title ? 'mt-5' : undefined}>{children}</div>
        {footer && (
          <div className="mt-5 border-t border-line pt-4 text-center text-body text-ink-muted">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
