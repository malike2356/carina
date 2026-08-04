export const SESSION_EXPIRED_MESSAGE =
  'Your Carina Cloud session expired. Sign in again to continue.';

export function sessionExpiredBanner(show: boolean): string | null {
  return show ? SESSION_EXPIRED_MESSAGE : null;
}
