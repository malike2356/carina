import { hasPlanTier } from './plan-tier.js';
import { getWorker } from '../workers/worker-store.js';
import { listWorkerChannelDetails } from '../channels/channel-store.js';
import { getSubscription } from '../workers/aiva-subscription-store.js';
import type { AivaChannelName } from '../channels/types.js';

export const STARTER_CHANNEL_LIMIT = 3;

const COUNTED_CHANNEL_TYPES: AivaChannelName[] = [
  'whatsapp',
  'email',
  'slack',
  'telegram',
  'web',
  'sms',
  'discord',
  'teams',
];

export function channelLimitForTier(planTier: string): number | null {
  if (hasPlanTier(planTier, 'team')) return 10;
  return STARTER_CHANNEL_LIMIT;
}

export async function resolveWorkspacePlanTier(workspaceId: string): Promise<string> {
  const sub = await getSubscription(workspaceId);
  return sub?.planTier ?? 'trial';
}

export async function countConnectedChannels(
  workerId: string,
  workspaceId: string,
): Promise<number> {
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) return 0;

  const rows = await listWorkerChannelDetails(workerId);
  const rowByType = new Map(rows.map((row) => [row.channel, row]));
  let count = 0;

  for (const type of COUNTED_CHANNEL_TYPES) {
    const row = rowByType.get(type);
    const hasCredentials = Boolean(row?.credentials.encrypted);
    const connected = type === 'web' ? worker.channels.includes('web') : hasCredentials;
    if (connected) count += 1;
  }

  return count;
}

export async function assertCanAddConnectedChannel(
  workspaceId: string,
  workerId: string,
  channelType?: AivaChannelName,
): Promise<{ allowed: true; planTier: string } | { allowed: false; planTier: string; limit: number; connected: number }> {
  const planTier = await resolveWorkspacePlanTier(workspaceId);
  const limit = channelLimitForTier(planTier);
  if (limit === null) {
    return { allowed: true, planTier };
  }

  if (channelType) {
    const worker = await getWorker(workspaceId, workerId);
    const rows = await listWorkerChannelDetails(workerId);
    const existing = rows.find((row) => row.channel === channelType);
    const hasCredentials = Boolean(existing?.credentials.encrypted);
    const alreadyConnected =
      channelType === 'web'
        ? Boolean(worker?.channels.includes('web'))
        : hasCredentials;
    if (alreadyConnected) {
      return { allowed: true, planTier };
    }
  }

  const connected = await countConnectedChannels(workerId, workspaceId);
  if (connected >= limit) {
    return { allowed: false, planTier, limit, connected };
  }

  return { allowed: true, planTier };
}
