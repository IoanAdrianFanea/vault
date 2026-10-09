/*
Route guard that makes sure a session exists before showing its children,
refreshing silently when needed. It redirects to the login page when signed out
and offers a retry when the server is unreachable.
*/


import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ensureSession, getAccessToken, SERVER_UNAVAILABLE_MESSAGE } from '../../api/http';
import { Button, InlineAlert, Spinner } from '../ui';

type SessionState = 'checking' | 'signed-in' | 'signed-out' | 'unavailable';

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<SessionState>(() =>
    getAccessToken() ? 'signed-in' : 'checking',
  );

  useEffect(() => {
    if (state !== 'checking') return;

    let active = true;
    ensureSession().then((result) => {
      if (active) setState(result);
    });

    return () => {
      active = false;
    };
  }, [state]);

  if (state === 'checking') {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <Spinner label="Checking your session" />
      </div>
    );
  }

  if (state === 'unavailable') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-canvas px-4">
        <InlineAlert tone="warning">{SERVER_UNAVAILABLE_MESSAGE}</InlineAlert>
        <Button variant="secondary" onClick={() => setState('checking')}>
          Try again
        </Button>
      </div>
    );
  }

  if (state === 'signed-out') {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  return <>{children}</>;
}
