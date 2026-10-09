/*
Shared rate-limit settings: the 'too many attempts' message, time windows and
the key that limits login attempts per IP address and email. Used by the
global throttler and the stricter limits on auth endpoints.
*/


export const TOO_MANY_ATTEMPTS_MESSAGE =
  'Too many attempts. Wait a few minutes and try again.';
export const ONE_MINUTE_MS = 60_000;
export const FIFTEEN_MINUTES_MS = 15 * 60_000;

export function loginThrottleTracker(req: Record<string, any>): string {
  const email =
    typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : '';
  return `${req.ip ?? 'unknown'}|${email}`;
}
