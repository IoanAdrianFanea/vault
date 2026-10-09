/*
Shared request helper for every API call: adds the access token, refreshes it
once on a 401 and retries, and turns network, rate-limit and size failures into
readable errors. It also holds the access token in session storage and sends the
user to the login page when their session has ended.
*/


export const API_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3000');

export const TOO_MANY_ATTEMPTS_MESSAGE = 'Too many attempts. Wait a few minutes and try again.';
export const SESSION_ENDED_MESSAGE = 'Your session has ended. Sign in again.';
export const SERVER_UNAVAILABLE_MESSAGE = "Can't reach the server right now. Try again in a moment.";

const ACCESS_TOKEN_KEY = 'accessToken';
const PUBLIC_PATHS = ['/login', '/register', '/verify-email'];

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

export async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null);
  const message = data?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message.join(' ');
  }
  return fallback;
}

export type RefreshResult =
  | { kind: 'ok'; token: string }
  | { kind: 'signed-out' }
  | { kind: 'unavailable' };

let inFlight: Promise<RefreshResult> | null = null;

async function performRefresh(): Promise<RefreshResult> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      const body = await response.json().catch(() => null);
      if (body && typeof body.accessToken === 'string') {
        setAccessToken(body.accessToken);
        return { kind: 'ok', token: body.accessToken };
      }
      return { kind: 'unavailable' };
    }
    if (response.status === 401 || response.status === 403) {
      return { kind: 'signed-out' };
    }
    return { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}

export function refreshAccessToken(): Promise<RefreshResult> {
  if (inFlight) return inFlight;

  const run = async (): Promise<RefreshResult> => {
    if (!('locks' in navigator)) return performRefresh();
    return await navigator.locks.request('docindex-auth-refresh', () => performRefresh());
  };

  const tracked = run().finally(() => {
    inFlight = null;
  });
  inFlight = tracked;
  return tracked;
}

export async function ensureSession(): Promise<'signed-in' | 'signed-out' | 'unavailable'> {
  if (getAccessToken()) return 'signed-in';
  const result = await refreshAccessToken();
  return result.kind === 'ok' ? 'signed-in' : result.kind;
}

let redirecting = false;

function handleSessionEnded(): void {
  clearAccessToken();
  if (redirecting || PUBLIC_PATHS.includes(window.location.pathname)) return;
  redirecting = true;
  window.location.assign(
    `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
  );
}

export async function apiFetch(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<Response> {
  const { auth = true, headers, ...rest } = init;

  const send = (token: string | null) => {
    const requestHeaders = new Headers(headers);
    if (auth && token) requestHeaders.set('Authorization', `Bearer ${token}`);
    return fetch(`${API_URL}${path}`, { ...rest, headers: requestHeaders, credentials: 'include' });
  };

  let token: string | null = null;
  if (auth) {
    token = getAccessToken();
    if (!token) {
      const result = await refreshAccessToken();
      if (result.kind === 'signed-out') {
        handleSessionEnded();
        throw new Error(SESSION_ENDED_MESSAGE);
      }
      if (result.kind === 'unavailable') {
        throw new Error(SERVER_UNAVAILABLE_MESSAGE);
      }
      token = result.token;
    }
  }

  let response: Response;
  try {
    response = await send(token);
  } catch {
    throw new Error(SERVER_UNAVAILABLE_MESSAGE);
  }

  if (auth && response.status === 401) {
    const result = await refreshAccessToken();
    if (result.kind === 'signed-out') {
      handleSessionEnded();
      throw new Error(SESSION_ENDED_MESSAGE);
    }
    if (result.kind === 'unavailable') {
      throw new Error(SERVER_UNAVAILABLE_MESSAGE);
    }
    try {
      response = await send(result.token);
    } catch {
      throw new Error(SERVER_UNAVAILABLE_MESSAGE);
    }
    if (response.status === 401) {
      handleSessionEnded();
      throw new Error(SESSION_ENDED_MESSAGE);
    }
  }

  if (response.status === 413) {
    throw new Error(await readErrorMessage(response, 'The file is too large to upload.'));
  }
  if (response.status === 429) {
    throw new Error(await readErrorMessage(response, TOO_MANY_ATTEMPTS_MESSAGE));
  }

  return response;
}
