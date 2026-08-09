import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { resolvePlatformGoogleClient } from '@/lib/google-oauth-config';
import { buildGoogleAuthUrl } from '@/lib/google-workspace-oauth-client';
import {
  consentCopyForMode,
  MODE_CONSENT,
  scopesForVaultDriveMode,
  SHARED_DRIVES_ENABLED,
  validateVaultDriveMode,
} from '@/lib/document-vault/google/scopes';
import {
  getDriveConnectionPublic,
  upsertDriveConnection,
} from '@/lib/document-vault/google/connection';
import { createDriveFolder, getStartPageToken } from '@/lib/document-vault/google/drive-api';
import { resolveVaultDriveAccessToken } from '@/lib/document-vault/google/token';
import { createVaultItem } from '@/lib/document-vault/pg-store';
import { stopDriveWatch } from '@/lib/document-vault/google/watch';
import { redactSecrets } from '@/lib/document-vault/google/verification-token';
import { signVaultGoogleOAuthState } from '@/lib/document-vault/google/oauth-state';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);
  const connection = await getDriveConnectionPublic(workspace.id);
  return NextResponse.json({
    data: {
      connection,
      modes: Object.entries(MODE_CONSENT).map(([mode, consent]) => ({ mode, consent })),
      sharedDrivesEnabled: SHARED_DRIVES_ENABLED,
    },
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json()) as {
    action?: string;
    mode?: string;
    rootFolderName?: string;
    googleRootFolderId?: string | null;
  };

  try {
    if (body.action === 'auth-url') {
      const mode = validateVaultDriveMode(body.mode || 'outbound_only');
      const platform = await resolvePlatformGoogleClient();
      if (!platform?.clientId) throw new Error('Google OAuth client is not configured');
      const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || '').replace(
        /\/$/,
        '',
      );
      const redirectUri = `${appOrigin}/api/vault/google/oauth/callback`;
      if (!appOrigin.startsWith('http')) throw new Error('NEXT_PUBLIC_APP_URL required for OAuth redirect');
      const scopes = scopesForVaultDriveMode(mode);
      const state = signVaultGoogleOAuthState({
        workspaceId: workspace.id,
        userId: session.user.id,
        mode,
        rootFolderName: body.rootFolderName || 'Aiva Document Vault',
        googleRootFolderId: body.googleRootFolderId ?? null,
        ts: Date.now(),
      });
      const authUrl = buildGoogleAuthUrl({
        clientId: platform.clientId,
        redirectUri,
        scopes,
        state,
      });
      return NextResponse.json({
        data: {
          authUrl,
          redirectUri,
          scopes,
          consent: consentCopyForMode(mode),
          mode,
        },
      });
    }

    if (body.action === 'configure') {
      const mode = validateVaultDriveMode(body.mode || 'outbound_only');
      const connection = await upsertDriveConnection(workspace.id, {
        mode,
        googleRootFolderId: body.googleRootFolderId ?? undefined,
        googleRootFolderName: body.rootFolderName ?? undefined,
        sharedDrivesEnabled: false,
      });
      return NextResponse.json({ data: { connection, consent: consentCopyForMode(mode) } });
    }

    if (body.action === 'ensure-root') {
      const accessToken = await resolveVaultDriveAccessToken(workspace.id);
      const name = body.rootFolderName?.trim() || 'Aiva Document Vault';
      let folderId = body.googleRootFolderId || null;
      if (!folderId) {
        const folder = await createDriveFolder({ accessToken, name });
        folderId = folder.id;
      }
      const vaultRoot = await createVaultItem({
        workspaceId: workspace.id,
        parentId: null,
        kind: 'folder',
        name,
        actorId: session.user.id,
      });
      const pageToken = await getStartPageToken(accessToken);
      const connection = await upsertDriveConnection(workspace.id, {
        googleRootFolderId: folderId,
        googleRootFolderName: name,
        vaultRootItemId: vaultRoot.id,
        pageToken,
        connected: true,
        lastError: null,
      });
      return NextResponse.json({ data: { connection, vaultRoot } });
    }

    if (body.action === 'disconnect') {
      await stopDriveWatch(workspace.id);
      const connection = await upsertDriveConnection(workspace.id, {
        connected: false,
        encryptedGrant: null,
        grantIv: null,
        grantTag: null,
        pageToken: null,
        channelId: null,
        resourceId: null,
        channelExpiresAt: null,
        verificationTokenHash: null,
        lastError: null,
      });
      return NextResponse.json({ data: { connection } });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    return NextResponse.json({ error: redactSecrets(message) as string }, { status: 400 });
  }
}
