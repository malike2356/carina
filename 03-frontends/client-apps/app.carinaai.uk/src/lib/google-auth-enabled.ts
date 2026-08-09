import { resolvePlatformGoogleClient } from './google-oauth-config';

export async function isGoogleAuthEnabled(): Promise<boolean> {
  return Boolean(await resolvePlatformGoogleClient());
}
