import { Cron } from 'croner';
import {
  listSocialChannelsForRefresh,
  readChannelCredentials,
  upsertWorkerChannel,
} from '../../channels/channel-store.js';
import type { AivaChannelName } from '../../channels/types.js';
import { refreshLinkedInToken } from './linkedin-oauth.js';
import { refreshTikTokToken } from './tiktok-oauth.js';
import { markSocialTokenExpired } from './social-oauth-finish.js';

let refreshCron: Cron | null = null;

function isExpired(iso: string | undefined): boolean {
  if (!iso?.trim()) return false;
  const expires = new Date(iso);
  if (Number.isNaN(expires.getTime())) return false;
  return expires.getTime() <= Date.now() + 5 * 60 * 1000;
}

async function refreshChannelIfNeeded(row: Awaited<ReturnType<typeof listSocialChannelsForRefresh>>[number]): Promise<void> {
  const credentials = readChannelCredentials(row);
  const channel = row.channel as AivaChannelName;

  if (channel === 'linkedin' && credentials.refresh_token && isExpired(credentials.expires_at)) {
    try {
      const refreshed = await refreshLinkedInToken(credentials.refresh_token);
      await upsertWorkerChannel({
        workerId: row.workerId,
        workspaceId: row.workspaceId,
        channel,
        identifier: row.identifier,
        credentials: {
          ...credentials,
          access_token: refreshed.accessToken,
          refresh_token: refreshed.refreshToken,
          expires_at: refreshed.expiresAt,
        },
        verified: row.verified,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markSocialTokenExpired(row.workerId, row.workspaceId, channel, row.id, message);
    }
  }

  if (
    (channel === 'instagram' || channel === 'messenger')
    && isExpired(credentials.token_expires_at)
  ) {
    await markSocialTokenExpired(
      row.workerId,
      row.workspaceId,
      channel,
      row.id,
      'Meta page token expired; reconnect required',
    );
  }

  if (channel === 'tiktok' && credentials.refresh_token && isExpired(credentials.expires_at)) {
    try {
      const refreshed = await refreshTikTokToken(credentials.refresh_token);
      await upsertWorkerChannel({
        workerId: row.workerId,
        workspaceId: row.workspaceId,
        channel,
        identifier: row.identifier,
        credentials: {
          ...credentials,
          access_token: refreshed.accessToken,
          refresh_token: refreshed.refreshToken,
          expires_at: refreshed.expiresAt,
        },
        verified: row.verified,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markSocialTokenExpired(row.workerId, row.workspaceId, channel, row.id, message);
    }
  }
}

export function startSocialTokenRefreshScheduler(): void {
  if (refreshCron) return;
  refreshCron = new Cron('0 * * * *', () => {
    void listSocialChannelsForRefresh()
      .then(async (rows) => {
        for (const row of rows) {
          await refreshChannelIfNeeded(row);
        }
      })
      .catch((err) => {
        console.warn('[social-oauth] token refresh sweep failed:', err);
      });
  });
}

export function stopSocialTokenRefreshScheduler(): void {
  refreshCron?.stop();
  refreshCron = null;
}
