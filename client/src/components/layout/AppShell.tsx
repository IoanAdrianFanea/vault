/*
Main signed-in layout: header with search, upload button and profile menu, plus
a sidebar with navigation and live document status counts. It loads the current
user once and shares it with pages through context, and lets pages trigger a
refresh of the status counts. Tablets in portrait get the sidebar in a slide-in
menu, and phones get a compact header with no sidebar or upload button.
*/


import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ProfileSettingsModal } from './ProfileSettingsModal';
import { CurrentUserContext, type CurrentUserState } from './currentUser';
import { DocumentStatusRefreshContext } from './documentStatusRefresh';
import { JOBS_UNAVAILABLE_MESSAGE } from './jobsAvailability';
import { ShellMenuDrawer } from './ShellMenuDrawer';
import { ShellSidebar } from './ShellSidebar';
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
  IconButton,
  Input,
  useToast,
} from '../ui';
import { useIsPhone, useIsTabletPortrait } from '../../hooks/useMediaQuery';

interface AppShellProps {
  children: ReactNode;
}

const STATUS_FILTER_COLLAPSED_KEY = 'shell:statusFilterCollapsed';
const SHELL_MENU_ID = 'shell-menu';
const PHONE_SEARCH_ID = 'phone-search';

function readStatusFilterCollapsed(): boolean {
  try {
    return sessionStorage.getItem(STATUS_FILTER_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function BrandMark({ size }: { size: 'md' | 'sm' }) {
  return (
    <div
      className={`${
        size === 'md' ? 'size-9' : 'size-8 shrink-0'
      } rounded-md bg-accent text-white flex items-center justify-center`}
    >
      <span
        className={`material-symbols-outlined ${
          size === 'md' ? 'text-[20px]' : 'text-[18px]'
        } leading-none`}
        aria-hidden="true"
      >
        lock
      </span>
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const isPhone = useIsPhone();
  const isTabletPortrait = useIsTabletPortrait();

  const isDocumentsPage = location.pathname.startsWith('/documents');
  const isAdminPage = location.pathname.startsWith('/admin');
  const isSearchPage = location.pathname.startsWith('/search');

  const [userState, setUserState] = useState<CurrentUserState>({ status: 'loading' });
  const [statusCounts, setStatusCounts] = useState<DocumentStatusCounts | null>(null);
  const [statusRefreshVersion, setStatusRefreshVersion] = useState(0);
  const refreshStatusCounts = useCallback(
    () => setStatusRefreshVersion((version) => version + 1),
    [],
  );
  const statusRefresh = useMemo(
    () => ({ version: statusRefreshVersion, refresh: refreshStatusCounts }),
    [statusRefreshVersion, refreshStatusCounts],
  );

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPhoneSearchOpen, setIsPhoneSearchOpen] = useState(isSearchPage);
  const isMountedRef = useRef(false);

  // The tablet menu closes on every navigation (including to the same URL) and
  // when the screen leaves tablet portrait, so it can't reopen after a rotation.
  const [menuNavigationKey, setMenuNavigationKey] = useState(location.key);
  if (location.key !== menuNavigationKey) {
    setMenuNavigationKey(location.key);
    setIsMenuOpen(false);
  }
  if (!isTabletPortrait && isMenuOpen) {
    setIsMenuOpen(false);
  }

  const isAdmin = userState.status === 'ready' && userState.user.role === 'ADMIN';

  const selectedStatus = useMemo(() => {
    const statusParam = searchParams.get('status');
    return DOCUMENT_STATUS_ORDER.find((status) => status === statusParam);
  }, [searchParams]);

  const totalCount = statusCounts
    ? DOCUMENT_STATUS_ORDER.reduce((acc, status) => acc + (statusCounts[status] ?? 0), 0)
    : null;

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
  }, [location.pathname, statusRefreshVersion]);

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

  const sidebarProps = {
    isDocumentsPage,
    isAdminPage,
    isAdmin,
    totalCount,
    statusCounts,
    selectedStatus,
    isStatusFilterCollapsed,
    onToggleStatusFilterCollapsed: toggleStatusFilterCollapsed,
    onStatusToggle: handleStatusToggle,
    onJobsSelect: () => showToast(JOBS_UNAVAILABLE_MESSAGE),
  };

  const phoneHeader = (
    <>
      <header className="relative z-header h-14 shrink-0 flex items-center gap-2.5 pl-4 pr-1 bg-canvas border-b border-line">
        <BrandMark size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-panel text-ink">DocIndex Manager</p>
          <p className="truncate text-small text-ink-muted">Site document register</p>
        </div>
        <IconButton
          icon="search"
          label="Search documents"
          aria-expanded={isPhoneSearchOpen}
          aria-controls={PHONE_SEARCH_ID}
          onClick={() => setIsPhoneSearchOpen((open) => !open)}
          className="max-md:size-11"
        />
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label="Account settings"
          onClick={() => setIsProfileSettingsOpen(true)}
          className="flex size-11 shrink-0 items-center justify-center rounded hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {userState.status === 'ready' ? (
            <Avatar fullName={userState.user.fullName} email={userState.user.email} />
          ) : userState.status === 'loading' ? (
            <span className="size-8 rounded-full bg-line" aria-hidden="true" />
          ) : (
            <Avatar />
          )}
        </button>
      </header>
      {isPhoneSearchOpen && (
        <form
          id={PHONE_SEARCH_ID}
          role="search"
          onSubmit={handleSearch}
          className="shrink-0 border-b border-line bg-canvas px-4 py-2"
        >
          <Input
            type="search"
            enterKeyHint="search"
            leadingIcon="search"
            placeholder="Search files or document text…"
            aria-label="Search files or document text"
            autoFocus={!isSearchPage}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      )}
    </>
  );

  const defaultHeader = (
    <header className="relative z-header h-16 shrink-0 flex items-center gap-6 px-4 bg-canvas border-b border-line md:max-lg:gap-3 md:max-lg:pl-2 md:max-lg:pr-3">
      {isTabletPortrait && (
        <IconButton
          icon="menu"
          label="Open menu"
          aria-haspopup="dialog"
          aria-expanded={isMenuOpen}
          aria-controls={SHELL_MENU_ID}
          onClick={() => setIsMenuOpen(true)}
          className="shrink-0 md:max-lg:size-11"
        />
      )}

      <div className="flex items-center gap-2.5 shrink-0">
        <BrandMark size="md" />
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

      <div className="ml-auto flex items-center gap-4 shrink-0 md:max-lg:gap-2">
        <ButtonLink to="/upload" variant="dark" icon="add">
          Upload document
        </ButtonLink>

        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={isTabletPortrait ? 'Account settings' : undefined}
          onClick={() => setIsProfileSettingsOpen(true)}
          className="flex items-center gap-2.5 h-10 pl-2 pr-1 rounded hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent touch:h-11 md:max-lg:px-1.5"
        >
          {userState.status === 'loading' ? (
            <>
              <span className="sr-only">Account</span>
              <div className="flex flex-col items-end gap-1 md:max-lg:hidden">
                <span className="h-3 w-24 rounded bg-line" aria-hidden="true" />
                <span className="h-2.5 w-12 rounded bg-line" aria-hidden="true" />
              </div>
              <span className="size-8 rounded-full bg-line" aria-hidden="true" />
            </>
          ) : userState.status === 'ready' ? (
            <>
              <div className="flex flex-col items-end min-w-0 text-right md:max-lg:hidden">
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
              <span className="text-body font-medium text-ink md:max-lg:hidden">Account</span>
              <Avatar />
            </>
          )}
        </button>
      </div>
    </header>
  );

  return (
    <CurrentUserContext value={userState}>
      <DocumentStatusRefreshContext value={statusRefresh}>
        <div className="h-screen flex flex-col overflow-hidden bg-canvas font-sans max-lg:h-dvh touch:h-dvh">
          {isPhone ? phoneHeader : defaultHeader}

          <div className="relative flex flex-1 overflow-hidden">
            {!isPhone && !isTabletPortrait && (
              <aside
                aria-label="Sidebar"
                className="w-48 shrink-0 flex flex-col gap-6 overflow-y-auto bg-subtle border-r border-line px-3 py-4"
              >
                <ShellSidebar variant="inline" {...sidebarProps} />
              </aside>
            )}

            {children}
          </div>
        </div>

        {isTabletPortrait && (
          <ShellMenuDrawer
            id={SHELL_MENU_ID}
            isOpen={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
          >
            <ShellSidebar variant="drawer" {...sidebarProps} />
          </ShellMenuDrawer>
        )}

        <ProfileSettingsModal
          isOpen={isProfileSettingsOpen}
          onClose={handleProfileSettingsClose}
        />
      </DocumentStatusRefreshContext>
    </CurrentUserContext>
  );
}
