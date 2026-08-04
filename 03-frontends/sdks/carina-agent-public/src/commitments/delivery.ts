import { channelRegistry } from '../gateway/channels/channel-registry.js';
import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';
import { getSessionDelivery } from '../agents/cron-delivery-registry.js';
import { expireStaleCommitments, listCommitments, updateCommitment } from './store.js';
import { commitmentsEnabled } from './inference.js';

const NON_DELIVERABLE = new Set<ChannelName>(['cli', 'web', 'api', 'webhooks']);

export async function deliverDueCommitments(now = new Date()): Promise<number> {
  if (!commitmentsEnabled()) return 0;
  expireStaleCommitments(now);

  const pending = listCommitments({ status: 'pending' });
  let sent = 0;

  for (const commitment of pending) {
    if (new Date(commitment.dueAt).getTime() > now.getTime()) continue;

    const delivery = resolveDeliveryTarget(commitment.sessionId, commitment);
    if (!delivery || NON_DELIVERABLE.has(delivery.channel)) {
      if (new Date(commitment.dueLatestAt).getTime() <= now.getTime()) {
        updateCommitment(commitment.id, { status: 'expired' });
      }
      continue;
    }

    const adapter = channelRegistry.getByName(delivery.channel);
    if (!adapter?.enabled || !delivery.conversationId) continue;

    try {
      await adapter.sendMessage(delivery.conversationId, commitment.checkInText, {
        threadId: delivery.threadId,
      });
      updateCommitment(commitment.id, {
        status: 'sent',
        sentAt: now.toISOString(),
      });
      sent += 1;
    } catch {
      if (new Date(commitment.dueLatestAt).getTime() <= now.getTime()) {
        updateCommitment(commitment.id, { status: 'expired' });
      }
    }
  }

  return sent;
}

function resolveDeliveryTarget(
  sessionId: string,
  commitment: { channel: string | null; conversationId: string | null; threadId: string | null },
): { channel: ChannelName; conversationId: string; threadId?: string } | null {
  const live = getSessionDelivery(sessionId);
  if (live?.conversationId) return live;
  if (!commitment.channel || !commitment.conversationId) return null;
  return {
    channel: commitment.channel as ChannelName,
    conversationId: commitment.conversationId,
    threadId: commitment.threadId ?? undefined,
  };
}

export function createCommitmentDeliveryTask(): {
  name: string;
  intervalMinutes: number;
  run: () => Promise<void>;
} {
  return {
    name: 'commitment-delivery',
    intervalMinutes: Number(process.env.CARINA_COMMITMENTS_TICK_MINUTES ?? '5'),
    run: async () => {
      const sent = await deliverDueCommitments();
      if (sent > 0 && process.env.CARINA_COMMITMENTS_VERBOSE === 'true') {
        console.log(`[commitments] delivered ${sent} follow-up(s)`);
      }
    },
  };
}
