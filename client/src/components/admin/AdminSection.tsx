import type { ReactNode } from 'react';

export interface AdminSectionProps {
  toolbarStart?: ReactNode;
  toolbarEnd?: ReactNode;
  bulkBarSpace?: boolean;
  children: ReactNode;
}

export function AdminSection({
  toolbarStart,
  toolbarEnd,
  bulkBarSpace = false,
  children,
}: AdminSectionProps) {
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto custom-scrollbar px-4 pt-3 ${
        bulkBarSpace ? 'pb-20' : 'pb-4'
      }`}
    >
      {(toolbarStart || toolbarEnd) && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">{toolbarStart}</div>
          {toolbarEnd && (
            <div className="ml-auto flex items-center gap-2">{toolbarEnd}</div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
