import { Cron } from 'croner';
import {
  getWorkerChannelByWorkerAndChannel,
  listSocialChannelsForRefresh,
  mergeWorkerChannelCredentials,
  readChannelCredentials,
} from '../../channels/channel-store.js';
import { fetchTikTokInboundSince, parseTikTokPollMessage } from './tiktok-messaging.js';
import { handleParsedInbound } from '../../channels/message-router.js';
import type { RegistryEntry } from '../../channels/worker-registry.js';
import { isAiWorkersEnabled } from '../../workers/aiva-message-handler.js';

let pollCron: Cron | null = null;

function webhookRegistered(credentials: Record<string, string>): boolean {
  return credentials.webhook_registered === 'true';
}

export async function pollTikTokChannel(row: Awaited<ReturnType<typeof listSocialChannelsForRefresh>>[number]): Promise<number> {
  const credentials = readChannelCredentials(row);
  if (webhookRegistered(credentials)) return 0;

  const sinceIso = credentials.last_polled_at?.trim() || undefined;
  const inbound = await fetchTikTokInboundSince({ credentials, sinceIso });
  let processed = 0;

  const entry: RegistryEntry = {
    workerId: row.workerId,
    workspaceId: row.workspaceId,
    channelRowId: row.id,
    credentialBlob: row.credentials.encrypted ?? '',
  };

  for (const messageRow of inbound) {
    const parsed = parseTikTokPollMessage(
      {
        conversation_id: messageRow.conversationId,
        sender_id: messageRow.contactId,
        text: { body: messageRow.text },
        message_id: messageRow.messageId,
        create_time: messageRow.timestamp.toISOString(),
      },
      row.workerId,
      row.workspaceId,
      credentials.open_id ?? credentials.business_id ?? '',
    );
    if (!parsed) continue;
    await handleParsedInbound(parsed, row.identifier, entry);
    processed += 1;
  }

  await mergeWorkerChannelCredentials(row.workerId, 'tiktok', {
    last_polled_at: new Date().toISOString(),
  });
  return processed;
}

export async function pollAllTikTokChannels(): Promise<Array<{ workerId: string; processed: number }>> {
  const rows = await listSocialChannelsForRefresh();
  const results: Array<{ workerId: string; processed: number }> = [];
  for (const row of rows) {
    if (row.channel !== 'tiktok' || !row.enabled || !row.verified) continue;
    try {
      const processed = await pollTikTokChannel(row);
      if (processed > 0) {
        results.push({ workerId: row.workerId, processed });
      }
    } catch (err) {
      console.warn(`[tiktok-poller] poll failed for worker ${row.workerId}:`, err);
    }
  }
  return results;
}

export function startTikTokPoller(): void {
  if (pollCron || !isAiWorkersEnabled()) return;
  pollCron = new Cron('*/5 * * * *', () => {
    void pollAllTikTokChannels()
      .then((results) => {
        const total = results.reduce((sum, item) => sum + item.processed, 0);
        if (total > 0) {
          console.log(`[tiktok-poller] Processed ${total} inbound message(s)`);
        }
      })
      .catch((err) => {
        console.warn('[tiktok-poller] cycle failed:', err);
      });
  });
}

export function stopTikTokPoller(): void {
  pollCron?.stop();
  pollCron = null;
}

export async function pollTikTokWorker(workerId: string): Promise<number> {
  const row = await getWorkerChannelByWorkerAndChannel(workerId, 'tiktok');
  if (!row || !row.enabled) return 0;
  return pollTikTokChannel(row);
}
