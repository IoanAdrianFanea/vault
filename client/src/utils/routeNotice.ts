/*
Reads a success or warning notice passed between pages through router navigation
state, ignoring anything malformed.
*/


export interface RouteNotice {
  tone: 'success' | 'warning';
  message: string;
}

export function readRouteNotice(state: unknown): RouteNotice | null {
  if (typeof state !== 'object' || state === null || !('notice' in state)) return null;
  const notice = (state as { notice: unknown }).notice;
  if (typeof notice !== 'object' || notice === null) return null;

  const { tone, message } = notice as { tone?: unknown; message?: unknown };
  if ((tone === 'success' || tone === 'warning') && typeof message === 'string') {
    return { tone, message };
  }
  return null;
}
