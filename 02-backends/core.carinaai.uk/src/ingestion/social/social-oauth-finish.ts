import {
  markChannelVerified,
  readChannelCredentials,
  setChannelVerifiedStatus,
  upsertWorkerChannel,
} from '../../channels/channel-store.js';
import { credentialsConfigured } from '../../channels/credential-store.js';
import { registerChannel } from '../../channels/worker-registry.js';
import type { AivaChannelName } from '../../channels/types.js';
import { getWorker } from '../../workers/worker-store.js';
import { activateTrialOnFirstChannel } from '../../workers/aiva-subscription-store.js';
import { registerWorkerWebhook } from './webhook-register.js';
import { reportAivaScoutEvent } from '../../security/scout-event-queue.js';

export async function finishSocialOAuthConnection(input: {
  workspaceId: string;
  workerId: string;
  channel: AivaChannelName;
  identifier: string;
  credentials: Record<string, string>;
  verified?: boolean;
}): Promise<{ ok: boolean; error?: string; channelId?: string }> {
  if (!credentialsConfigured()) {
    return { ok: false, error: 'CHANNEL_CREDENTIAL_KEY is not configured' };
  }

  const worker = await getWorker(input.workspaceId, input.workerId);
  if (!worker) {
    return { ok: false, error: 'Worker not found' };
  }

  const verified = input.verified ?? true;
  const row = await upsertWorkerChannel({
    workerId: input.workerId,
    workspaceId: input.workspaceId,
    channel: input.channel,
    identifier: input.identifier,
    credentials: input.credentials,
    verified,
  });

  registerChannel(input.channel, input.identifier, {
    workerId: input.workerId,
    workspaceId: input.workspaceId,
    channelRowId: row.id,
    credentialBlob: row.credentials.encrypted ?? '',
  });

  try {
    await registerWorkerWebhook({
      workerId: input.workerId,
      channel: input.channel,
      credentials: readChannelCredentials(row),
    });
    if (verified) {
      await markChannelVerified(row.id);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }

  if (input.channel !== 'web') {
    void activateTrialOnFirstChannel(input.workspaceId).catch(() => {});
  }

  return { ok: true, channelId: row.id };
}

export async function markSocialTokenExpired(
  workerId: string,
  workspaceId: string,
  channel: AivaChannelName,
  channelRowId: string,
  reason: string,
): Promise<void> {
  await setChannelVerifiedStatus(channelRowId, false);
  await reportAivaScoutEvent({
    workspaceId,
    workerId,
    eventType: 'social_token_expired',
    description: reason,
    metadata: { channel },
  });
}
