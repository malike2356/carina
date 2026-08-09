import { randomUUID } from 'node:crypto';
import {
  getDriveConnection,
  upsertDriveConnection,
} from './connection';
import { getStartPageToken, stopChannel, watchChanges } from './drive-api';
import { resolveVaultDriveAccessToken } from './token';
import { newWatchVerificationToken } from './verification-token';
import { shouldRenewWatch, webhookPublicUrl } from './watch-helpers';

export async function registerDriveWatch(workspaceId: string): Promise<{
  channelId: string;
  resourceId: string | null;
  channelExpiresAt: string | null;
  webhookAddress: string;
}> {
  const address = webhookPublicUrl();
  if (!address.startsWith('https://')) {
    throw new Error(
      'HTTPS webhook URL required for Drive push; set DOCUMENT_VAULT_GOOGLE_WEBHOOK_URL or NEXT_PUBLIC_APP_URL',
    );
  }
  const conn = await getDriveConnection(workspaceId);
  if (!conn?.connected) throw new Error('Google Drive not connected');

  const accessToken = await resolveVaultDriveAccessToken(workspaceId);
  let pageToken = conn.pageToken;
  if (!pageToken) {
    pageToken = await getStartPageToken(accessToken);
    await upsertDriveConnection(workspaceId, { pageToken });
  }

  const { plaintext, digest } = newWatchVerificationToken();
  const channelId = `aiva-dv-${workspaceId.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
  const remote = await watchChanges({
    accessToken,
    channelId,
    address,
    token: plaintext,
    pageToken,
  });

  let expiresAt: Date | null = null;
  if (remote.expiration) {
    try {
      expiresAt = new Date(Number(remote.expiration));
    } catch {
      expiresAt = new Date(Date.now() + 20 * 60 * 60 * 1000);
    }
  }

  await upsertDriveConnection(workspaceId, {
    channelId: String(remote.id || channelId),
    resourceId: String(remote.resourceId || ''),
    channelExpiresAt: expiresAt,
    verificationTokenHash: digest,
    pageToken,
    lastError: null,
  });

  return {
    channelId: String(remote.id || channelId),
    resourceId: remote.resourceId ? String(remote.resourceId) : null,
    channelExpiresAt: expiresAt ? expiresAt.toISOString() : null,
    webhookAddress: address,
  };
}

export async function renewDriveWatchIfNeeded(
  workspaceId: string,
  overlapHours = 2,
): Promise<{ renewed: boolean; channelId?: string; channelExpiresAt?: string | null; stoppedPrevious?: boolean }> {
  const conn = await getDriveConnection(workspaceId);
  if (!conn?.channelId) {
    const registered = await registerDriveWatch(workspaceId);
    return { renewed: true, channelId: registered.channelId, channelExpiresAt: registered.channelExpiresAt };
  }
  if (
    !shouldRenewWatch({
      channelExpiresAt: conn.channelExpiresAt?.toISOString?.() ?? (conn.channelExpiresAt as unknown as string),
      overlapHours,
    })
  ) {
    return {
      renewed: false,
      channelId: conn.channelId,
      channelExpiresAt: conn.channelExpiresAt ? conn.channelExpiresAt.toISOString() : null,
    };
  }

  const oldChannel = conn.channelId;
  const oldResource = conn.resourceId;
  const registered = await registerDriveWatch(workspaceId);
  if (oldChannel && oldResource) {
    try {
      const accessToken = await resolveVaultDriveAccessToken(workspaceId);
      await stopChannel(accessToken, oldChannel, oldResource);
    } catch {
      /* previous channel may already be expired */
    }
  }
  return {
    renewed: true,
    stoppedPrevious: Boolean(oldChannel),
    channelId: registered.channelId,
    channelExpiresAt: registered.channelExpiresAt,
  };
}

export async function stopDriveWatch(workspaceId: string): Promise<void> {
  const conn = await getDriveConnection(workspaceId);
  if (!conn) return;
  if (conn.channelId && conn.resourceId) {
    try {
      const accessToken = await resolveVaultDriveAccessToken(workspaceId);
      await stopChannel(accessToken, conn.channelId, conn.resourceId);
    } catch {
      /* ignore */
    }
  }
  await upsertDriveConnection(workspaceId, {
    channelId: null,
    resourceId: null,
    channelExpiresAt: null,
    verificationTokenHash: null,
  });
}
