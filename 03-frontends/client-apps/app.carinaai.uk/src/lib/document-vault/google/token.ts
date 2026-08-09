import { refreshGoogleWorkspaceAccessToken } from '@/lib/google-workspace-oauth-client';
import { resolvePlatformGoogleClient } from '@/lib/google-oauth-config';
import { getDriveConnection, openGrant, sealGrant, upsertDriveConnection } from './connection';

/**
 * Resolve a live Google access token for vault Drive sync.
 * Refresh tokens stay encrypted on the connection row; never log them.
 */
export async function resolveVaultDriveAccessToken(workspaceId: string): Promise<string> {
  const row = await getDriveConnection(workspaceId);
  if (!row?.connected) throw new Error('Google Drive not connected');
  const grant = openGrant(workspaceId, row);
  if (!grant?.refreshToken && !grant?.accessToken) {
    throw new Error('Google Drive grant missing; reconnect OAuth');
  }

  const expiresAt = grant.expiresAt ? Date.parse(grant.expiresAt) : 0;
  if (grant.accessToken && expiresAt > Date.now() + 60_000) {
    return grant.accessToken;
  }
  if (!grant.refreshToken) {
    if (grant.accessToken) return grant.accessToken;
    throw new Error('Google OAuth refresh failure: no refresh token');
  }

  const platform = await resolvePlatformGoogleClient();
  if (!platform?.clientId || !platform?.clientSecret) {
    throw new Error('Google OAuth client credentials are not configured');
  }

  try {
    const refreshed = await refreshGoogleWorkspaceAccessToken({
      refreshToken: grant.refreshToken,
      clientId: platform.clientId,
      clientSecret: platform.clientSecret,
    });
    const nextGrant = {
      ...grant,
      accessToken: refreshed.accessToken,
      expiresAt: new Date(refreshed.expiryDate).toISOString(),
      scopes: refreshed.scope ? refreshed.scope.split(/\s+/).filter(Boolean) : grant.scopes,
    };
    const sealed = sealGrant(workspaceId, nextGrant);
    await upsertDriveConnection(workspaceId, {
      ...sealed,
      scopesJson: nextGrant.scopes,
      lastError: null,
    });
    return refreshed.accessToken;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth refresh failed';
    await upsertDriveConnection(workspaceId, { lastError: message, connected: true });
    throw new Error(`Google OAuth refresh failure: ${message}`);
  }
}
