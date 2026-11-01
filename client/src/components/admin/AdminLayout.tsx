/*
Layout for the /admin section: page heading, tab bar with the pending-approvals
count, and an outlet for the active admin page. Shares a refresh callback for
that count with the pages through the outlet context. Phones get a notice that
admin settings need a tablet or computer instead.
*/


import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { getPendingUsers } from '../../api/users';
import { ButtonLink, EmptyState, PageHeader, Tabs, type TabItem } from '../ui';
import { useIsPhone } from '../../hooks/useMediaQuery';
import type { AdminOutletContext } from './adminLayoutContext';

// Phones don't get the admin pages, so nothing under /admin renders or loads there.
export function AdminLayout() {
  const isPhone = useIsPhone();

  if (isPhone) {
    return (
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-canvas px-4 py-3">
        <EmptyState
          className="rounded border border-line"
          icon="desktop_windows"
          title="Admin settings are available on a tablet or computer"
          action={
            <ButtonLink to="/documents" variant="secondary" size="sm">
              Back to documents
            </ButtonLink>
          }
        />
      </main>
    );
  }

  return <AdminLayoutContent />;
}

function AdminLayoutContent() {
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const isMountedRef = useRef(true);

  const refreshPendingCount = useCallback(() => {
    getPendingUsers()
      .then((users) => {
        if (isMountedRef.current) {
          setPendingCount(users.length);
        }
      })
      .catch(() => {
        if (isMountedRef.current) {
          setPendingCount(null);
        }
      });
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    refreshPendingCount();

    return () => {
      isMountedRef.current = false;
    };
  }, [refreshPendingCount]);

  const adminTabs: TabItem[] = [
    { value: 'projects', label: 'Projects', to: '/admin/projects' },
    { value: 'users', label: 'Users', to: '/admin/users' },
    {
      value: 'pending',
      label: 'Pending approvals',
      to: '/admin/pending',
      count: pendingCount,
      countTone: 'amber',
    },
    { value: 'recycle-bin', label: 'Recycle bin', to: '/admin/recycle-bin' },
    { value: 'archive', label: 'Archive', to: '/admin/archive' },
    { value: 'filters', label: 'Filter settings', to: '/admin/filters' },
  ];

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
      <div className="shrink-0 space-y-3 px-4 pt-3">
        <PageHeader
          title="Admin settings"
          description="Manage projects, users and system settings."
        />
        <Tabs label="Admin sections" items={adminTabs} />
      </div>
      <Outlet context={{ refreshPendingCount } satisfies AdminOutletContext} />
    </main>
  );
}
