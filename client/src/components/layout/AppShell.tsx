/*
Main signed-in layout: header with search, upload button and profile menu, plus
a sidebar with navigation and live document status counts. It loads the current
user once and shares it with pages through context.
*/


import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ProfileSettingsModal } from './ProfileSettingsModal';
import { CurrentUserContext, type CurrentUserState } from './currentUser';
import { authService } from '../../api/auth';
import {
  documentsService,
  type DocumentStatus,
  type DocumentStatusCounts,
} from '../../api/documents';
import {
  Avatar,
  ButtonLink,
  DOCUMENT_STATUS_ORDER,
  documentStatusStyles,
  IconButton,
  Input,
} from '../ui';

interface AppShellProps {
  children: ReactNode;
}

const STATUS_FILTER_COLLAPSED_KEY = 'shell:statusFilterCollapsed';

function readStatusFilterCollapsed(): boolean {
  try {
    return sessionStorage.getItem(STATUS_FILTER_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function formatCount(count: number): string {
  return count.toLocaleString('en-GB');
}

interface ShellNavLinkProps {
  to: string;
  label: string;
  icon: string;
  isActive: boolean;
  count?: number | null;
}

function ShellNavLink({ to, label, icon, isActive, count }: ShellNavLinkProps) {
  return (
    <Link
      to={to}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center gap-2 h-8 px-2 rounded text-body transition-colors ${
        isActive
          ? 'bg-selected text-ink font-medium'
          : 'text-ink-body hover:bg-line/60'
      }`}
    >
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
    </Link>
  );
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isDocumentsPage = location.pathname.startsWith('/documents');
  const isJobsPage = location.pathname.startsWith('/jobs');
  const isAdminPage = location.pathname.startsWith('/admin');
  const isSearchPage = location.pathname.startsWith('/search');

  const [userState, setUserState] = useState<CurrentUserState>({ status: 'loading' });
  const [statusCounts, setStatusCounts] = useState<DocumentStatusCounts | null>(null);

  const urlQuery = isSearchPage ? (searchParams.get('q') ?? '') : null;
  const [syncedUrlQuery, setSyncedUrlQuery] = useState<string | null>(urlQuery);
  const [searchQuery, setSearchQuery] = useState(urlQuery ?? '');

  if (urlQuery !== syncedUrlQuery) {
    setSyncedUrlQuery(urlQuery);
    if (urlQuery !== null) setSearchQuery(urlQuery);
  }

  const [isStatusFilterCollapsed, setIsStatusFilterCollapsed] = useState<boolean>(
    readStatusFilterCollapsed,
  );
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const isMountedRef = useRef(false);

  const isAdmin = userState.status === 'ready' && userState.user.role === 'ADMIN';

  const selectedStatus = useMemo(() => {
    const statusParam = searchParams.get('status');
    return DOCUMENT_STATUS_ORDER.find((status) => status === statusParam);
  }, [searchParams]);

  const totalCount = statusCounts
    ? DOCUMENT_STATUS_ORDER.reduce((acc, status) => acc + (statusCounts[status] ?? 0), 0)
    : null;

  const visibleStatuses = DOCUMENT_STATUS_ORDER.filter(
    (status) => !isStatusFilterCollapsed || status === selectedStatus,
  );

  useEffect(() => {
    isMountedRef.current = true;
    let isActive = true;

    authService
      .getMe()
      .then((user) => {
        if (!isActive) return;
        setUserState({ status: 'ready', user });
      })
      .catch(() => {
        if (!isActive) return;
        setUserState({ status: 'error' });
      });

    return () => {
      isActive = false;
      isMountedRef.current = false;
    };
  }, []);

  const refreshCurrentUser = async () => {
    try {
      const user = await authService.getMe();
      if (isMountedRef.current) {
        setUserState({ status: 'ready', user });
      }
    } catch {
      // Keep current state on error
    }
  };

  const handleProfileSettingsClose = () => {
    setIsProfileSettingsOpen(false);
    void refreshCurrentUser();
  };

  useEffect(() => {
    let isActive = true;

    const loadStatusCounts = async () => {
      try {
        const counts = await documentsService.getStatusCounts();
        if (!isActive) return;
        setStatusCounts(counts);
      } catch (error) {
        if (!isActive) return;
        console.error('Failed to load document status counts', error);
      }
    };

    loadStatusCounts();

    return () => {
      isActive = false;
    };
  }, [location.pathname]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length >= 2) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleStatusToggle = (status: DocumentStatus) => {
    if (!isDocumentsPage) {
      navigate(`/documents?status=${status}`);
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    if (selectedStatus === status) {
      nextParams.delete('status');
    } else {
      nextParams.set('status', status);
    }
    setSearchParams(nextParams);
  };

  const toggleStatusFilterCollapsed = () => {
    const next = !isStatusFilterCollapsed;
    setIsStatusFilterCollapsed(next);
    try {
      sessionStorage.setItem(STATUS_FILTER_COLLAPSED_KEY, String(next));
    } catch {
      // Ignore storage failure
    }
  };

  return (
    <CurrentUserContext value={userState}>
      <div className="h-screen flex flex-col overflow-hidden bg-canvas font-sans">
        <header className="relative z-header h-16 shrink-0 flex items-center gap-6 px-4 bg-canvas border-b border-line">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="size-9 rounded-md bg-accent text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">
                lock
              </span>
            </div>
            <div>
              <p className="text-panel text-ink">DocIndex Manager</p>
              <p className="text-small text-ink-muted">Site document register</p>
            </div>
          </div>

          <form role="search" onSubmit={handleSearch} className="flex-1 min-w-0 max-w-2xl">
            <Input
              type="search"
              leadingIcon="search"
              placeholder="Search files or document text…"
              aria-label="Search files or document text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          <div className="ml-auto flex items-center gap-4 shrink-0">
            <ButtonLink to="/upload" variant="dark" icon="add">
              Upload document
            </ButtonLink>

            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => setIsProfileSettingsOpen(true)}
              className="flex items-center gap-2.5 h-10 pl-2 pr-1 rounded hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {userState.status === 'loading' ? (
                <>
                  <span className="sr-only">Account</span>
                  <div className="flex flex-col items-end gap-1">
                    <span className="h-3 w-24 rounded bg-line" aria-hidden="true" />
                    <span className="h-2.5 w-12 rounded bg-line" aria-hidden="true" />
                  </div>
                  <span className="size-8 rounded-full bg-line" aria-hidden="true" />
                </>
              ) : userState.status === 'ready' ? (
                <>
                  <div className="flex flex-col items-end min-w-0 text-right">
                    <span className="max-w-[180px] truncate text-body font-medium text-ink">
                      {userState.user.fullName?.trim() || userState.user.email}
                    </span>
                    <span className="text-small text-ink-muted">
                      {userState.user.role === 'ADMIN' ? 'Admin' : 'User'}
                    </span>
                  </div>
                  <Avatar
                    fullName={userState.user.fullName}
                    email={userState.user.email}
                  />
                </>
              ) : (
                <>
                  <span className="text-body font-medium text-ink">Account</span>
                  <Avatar />
                </>
              )}
            </button>
          </div>
        </header>

        <div className="relative flex flex-1 overflow-hidden">
          <aside
            aria-label="Sidebar"
            className="w-48 shrink-0 flex flex-col gap-6 overflow-y-auto bg-subtle border-r border-line px-3 py-4"
          >
            <nav aria-labelledby="shell-registers-heading">
              <h2
                id="shell-registers-heading"
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
                  />
                </li>
                <li>
                  <ShellNavLink
                    to="/jobs"
                    label="Jobs"
                    icon="folder"
                    isActive={isJobsPage}
                  />
                </li>
                {isAdmin && (
                  <li>
                    <ShellNavLink
                      to="/admin/projects"
                      label="Admin settings"
                      icon="settings"
                      isActive={isAdminPage}
                    />
                  </li>
                )}
              </ul>
            </nav>

            <section aria-labelledby="shell-status-heading">
              <div className="flex items-center justify-between pl-2 mb-1.5">
                <h2
                  id="shell-status-heading"
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
                  aria-controls="shell-status-list"
                  onClick={toggleStatusFilterCollapsed}
                />
              </div>

              <ul id="shell-status-list" className="space-y-0.5">
                {visibleStatuses.map((status) => {
                  const isActive = selectedStatus === status;
                  const style = documentStatusStyles[status];

                  return (
                    <li key={status}>
                      <button
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => handleStatusToggle(status)}
                        className={`w-full flex items-center gap-2 h-7 px-2 rounded text-body text-left transition-colors ${
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
          </aside>

          {children}
        </div>
      </div>

      <ProfileSettingsModal
        isOpen={isProfileSettingsOpen}
        onClose={handleProfileSettingsClose}
      />
    </CurrentUserContext>
  );
}
