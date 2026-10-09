/*
Converts duration strings such as '15m' or '7d' into milliseconds. Used for
refresh-token expiry and the refresh cookie's max age.
*/


export function parseDurationMs(value: string): number {
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration "${value}"`);
  }
  const amount = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Invalid duration "${value}"`);
  }
}
