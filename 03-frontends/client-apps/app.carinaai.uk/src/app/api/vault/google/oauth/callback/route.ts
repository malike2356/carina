import { NextResponse } from 'next/server';
import { resolvePlatformGoogleClient } from '@/lib/google-oauth-config';
import { exchangeGoogleWorkspaceCode } from '@/lib/google-workspace-oauth-client';
import { verifyVaultGoogleOAuthState } from '@/lib/document-vault/google/oauth-state';
import { sealGrant, upsertDriveConnection } from '@/lib/document-vault/google/connection';
import { createDriveFolder, getStartPageToken } from '@/lib/document-vault/google/drive-api';
import { createVaultItem } from '@/lib/document-vault/pg-store';
import { validateVaultDriveMode } from '@/lib/document-vault/google/scopes';
import { registerDriveWatch } from '@/lib/document-vault/google/watch';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || '').replace(
    /\/$/,
    '',
  );
  const fail = (msg: string) =>
    NextResponse.redirect(`${appOrigin}/documents?tab=drive&driveError=${encodeURIComponent(msg)}`);

  if (oauthError) return fail(oauthError);
  if (!code || !state) return fail('missing_oauth_params');

  const payload = verifyVaultGoogleOAuthState(state);
  if (!payload?.workspaceId) return fail('invalid_state');

  const workspaceId = String(payload.workspaceId);
  const mode = validateVaultDriveMode(String(payload.mode || 'outbound_only'));
  const rootFolderName = String(payload.rootFolderName || 'Aiva Document Vault');
  const existingRoot = payload.googleRootFolderId ? String(payload.googleRootFolderId) : null;

  try {
    const platform = await resolvePlatformGoogleClient();
    if (!platform?.clientId || !platform?.clientSecret) return fail('oauth_not_configured');
    const redirectUri = `${appOrigin}/api/vault/google/oauth/callback`;
    const tokens = await exchangeGoogleWorkspaceCode({
      code,
      clientId: platform.clientId,
      clientSecret: platform.clientSecret,
      redirectUri,
    });

    const scopes = tokens.scope ? tokens.scope.split(/\s+/).filter(Boolean) : [];
    const sealed = sealGrant(workspaceId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(tokens.expiryDate).toISOString(),
      accountEmail: tokens.email || null,
      scopes,
    });

    await upsertDriveConnection(workspaceId, {
      connected: true,
      mode,
      accountEmail: tokens.email || null,
      scopesJson: scopes,
      ...sealed,
      sharedDrivesEnabled: false,
      lastError: null,
    });

    let folderId = existingRoot;
    if (!folderId) {
      const folder = await createDriveFolder({
        accessToken: tokens.accessToken,
        name: rootFolderName,
      });
      folderId = folder.id;
    }

    const vaultRoot = await createVaultItem({
      workspaceId,
      parentId: null,
      kind: 'folder',
      name: rootFolderName,
      actorId: String(payload.userId || ''),
    });
    const pageToken = await getStartPageToken(tokens.accessToken);
    await upsertDriveConnection(workspaceId, {
      googleRootFolderId: folderId,
      googleRootFolderName: rootFolderName,
      vaultRootItemId: vaultRoot.id,
      pageToken,
      connected: true,
    });

    if (mode !== 'outbound_only') {
      try {
        await registerDriveWatch(workspaceId);
      } catch {
        // Poll/manual sync still works without HTTPS watch locally.
      }
    }

    return NextResponse.redirect(`${appOrigin}/documents?tab=drive&driveConnected=1`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed';
    return fail(message.slice(0, 180));
  }
}
