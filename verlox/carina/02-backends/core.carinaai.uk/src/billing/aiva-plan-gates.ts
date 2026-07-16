import { effectivePlanTier } from './plan-tier.js';
import { tierAllowsCustomDomain } from './aiva-tier.js';
import { channelLimitFromCapabilities } from '../workspace/workspace-capabilities.js';
import { getWorker } from '../workers/worker-store.js';
import { listWorkerChannelDetails } from '../channels/channel-store.js';
import { getSubscription } from '../workers/aiva-subscription-store.js';
import type { AivaChannelName } from '../channels/types.js';

/** @deprecated Channel limits removed; all workspaces get full Carina channels. */
export const STARTER_CHANNEL_LIMIT = 2;

const COUNTED_CHANNEL_TYPES: AivaChannelName[] = [
  'whatsapp',
  'email',
  'slack',
  'telegram',
  'web',
  'sms',
  'discord',
  'teams',
  'linkedin',
  'instagram',
  'messenger',
  'twitter',
  'tiktok',
];

function isChannelConnected(
  type: AivaChannelName,
  worker: Awaited<ReturnType<typeof getWorker>>,
  row: { identifier: string; credentials: { encrypted?: string } } | undefined,
): boolean {
  if (type === 'web') return Boolean(worker?.channels.includes('web'));
  if (!row?.credentials.encrypted) return false;
  if (row.identifier === 'pending') return false;
  return true;
}

export function channelLimitForTier(planTier: string): number | null {
  return channelLimitFromCapabilities(planTier);
}

export async function assertCanUseCustomDomain(workspaceId: string): Promise<void> {
  const planTier = await resolveWorkspacePlanTier(workspaceId);
  if (!tierAllowsCustomDomain(planTier)) {
    throw Object.assign(
      new Error('Custom domain requires the Aiva Business plan.'),
      { status: 403, code: 'CUSTOM_DOMAIN_PLAN_GATE' },
    );
  }
}

export async function resolveWorkspacePlanTier(workspaceId: string): Promise<string> {
  const sub = await getSubscription(workspaceId);
  if (!sub) return 'trial';
  return effectivePlanTier(sub.planTier, sub.status);
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
    if (isChannelConnected(type, worker, row)) count += 1;
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
    if (isChannelConnected(channelType, worker, existing)) {
      return { allowed: true, planTier };
    }
  }

  const connected = await countConnectedChannels(workerId, workspaceId);
  if (connected >= limit) {
    return { allowed: false, planTier, limit, connected };
  }

  return { allowed: true, planTier };
}
