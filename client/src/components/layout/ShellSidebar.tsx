/*
Sidebar content shared by the inline desktop sidebar and the tablet slide-in
menu: the Registers navigation and the status filter with live counts.
*/


import { Link } from 'react-router-dom';
import type { DocumentStatus, DocumentStatusCounts } from '../../api/documents';
import {
  DOCUMENT_STATUS_ORDER,
  documentStatusStyles,
  IconButton,
} from '../ui';
import { formatCount } from '../../utils/format';

interface ShellNavLinkProps {
  to?: string;
  onSelect?: () => void;
  label: string;
  icon: string;
  isActive: boolean;
  count?: number | null;
  heightClassName: string;
}

function ShellNavLink({
  to,
  onSelect,
  label,
  icon,
  isActive,
  count,
  heightClassName,
}: ShellNavLinkProps) {
  const className = `flex w-full items-center gap-2 ${heightClassName} px-2 rounded text-left text-body transition-colors ${
    isActive
      ? 'bg-selected text-ink font-medium'
      : 'text-ink-body hover:bg-line/60'
  }`;
  const content = (
    <>
      <span
        className={`material-symbols-outlined text-[18px] leading-none ${
          isActive ? 'text-accent' : 'text-ink-muted'
        }`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {typeof count === 'number' && (
        <span className="text-small tabular-nums text-ink-muted">
          {formatCount(count)}
        </span>
      )}
    </>
  );

  if (!to) {
    return (
      <button type="button" onClick={onSelect} className={className}>
        {content}
      </button>
    );
  }

  return (
    <Link
      to={to}
      aria-current={isActive ? 'page' : undefined}
      className={className}
    >
      {content}
    </Link>
  );
}

export interface ShellSidebarProps {
  // `drawer` is the tablet slide-in menu, which uses 40px rows.
  variant: 'inline' | 'drawer';
  isDocumentsPage: boolean;
  isAdminPage: boolean;
  isAdmin: boolean;
  totalCount: number | null;
  statusCounts: DocumentStatusCounts | null;
  selectedStatus: DocumentStatus | undefined;
  isStatusFilterCollapsed: boolean;
  onToggleStatusFilterCollapsed: () => void;
  onStatusToggle: (status: DocumentStatus) => void;
  onJobsSelect: () => void;
}

export function ShellSidebar({
  variant,
  isDocumentsPage,
  isAdminPage,
  isAdmin,
  totalCount,
  statusCounts,
  selectedStatus,
  isStatusFilterCollapsed,
  onToggleStatusFilterCollapsed,
  onStatusToggle,
  onJobsSelect,
}: ShellSidebarProps) {
  const idPrefix = variant === 'drawer' ? 'shell-menu' : 'shell';
  const navRowHeight = variant === 'drawer' ? 'h-10' : 'h-8 touch:h-10';
  const statusRowHeight = variant === 'drawer' ? 'h-10' : 'h-7 touch:h-10';

  const visibleStatuses = DOCUMENT_STATUS_ORDER.filter(
    (status) => !isStatusFilterCollapsed || status === selectedStatus,
  );

  return (
    <>
      <nav aria-labelledby={`${idPrefix}-registers-heading`}>
        <h2
          id={`${idPrefix}-registers-heading`}
          className="px-2 mb-1.5 text-label uppercase text-ink-muted"
        >
          Registers
        </h2>
        <ul className="space-y-0.5">
          <li>
            <ShellNavLink
              to="/documents"
              label="All documents"
              icon="description"
              isActive={isDocumentsPage}
              count={totalCount}
              heightClassName={navRowHeight}
            />
          </li>
          <li>
            <ShellNavLink
              onSelect={onJobsSelect}
              label="Jobs"
              icon="folder"
              isActive={false}
              heightClassName={navRowHeight}
            />
          </li>
          {isAdmin && (
            <li>
              <ShellNavLink
                to="/admin/projects"
                label="Admin settings"
                icon="settings"
                isActive={isAdminPage}
                heightClassName={navRowHeight}
              />
            </li>
          )}
        </ul>
      </nav>

      <section aria-labelledby={`${idPrefix}-status-heading`}>
        <div className="flex items-center justify-between pl-2 mb-1.5">
          <h2
            id={`${idPrefix}-status-heading`}
            className="text-label uppercase text-ink-muted"
          >
            Status filter
          </h2>
          <IconButton
            size="sm"
            icon={isStatusFilterCollapsed ? 'expand_more' : 'expand_less'}
            label={
              isStatusFilterCollapsed
                ? 'Expand status filter'
                : 'Collapse status filter'
            }
            aria-expanded={!isStatusFilterCollapsed}
            aria-controls={`${idPrefix}-status-list`}
            onClick={onToggleStatusFilterCollapsed}
          />
        </div>

        <ul id={`${idPrefix}-status-list`} className="space-y-0.5">
          {visibleStatuses.map((status) => {
            const isActive = selectedStatus === status;
            const style = documentStatusStyles[status];

            return (
              <li key={status}>
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onStatusToggle(status)}
                  className={`w-full flex items-center gap-2 ${statusRowHeight} px-2 rounded text-body text-left transition-colors ${
                    isActive
                      ? 'bg-selected text-ink font-medium'
                      : 'text-ink-body hover:bg-line/60'
                  }`}
                >
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${style.dotClassName}`}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate">{style.label}</span>
                  {statusCounts !== null && (
                    <span className="text-small tabular-nums text-ink-muted">
                      {formatCount(statusCounts[status])}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
