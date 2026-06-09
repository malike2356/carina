import { channelRegistry } from '../gateway/channels/channel-registry.js';
import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';
import type { ScheduledJob } from './cron-scheduler.js';

export interface DeliveryTarget {
  channel: ChannelName;
  conversationId: string;
}

export function parseDeliverSpec(spec: string, job: ScheduledJob): DeliveryTarget[] {
  const trimmed = spec.trim();
  if (!trimmed || trimmed === 'origin' || trimmed === 'local') {
    return [];
  }

  if (trimmed === 'all') {
    return channelRegistry.listActive().flatMap((channel) => {
      if (channel === 'cli' || channel === 'web') return [];
      return [{ channel, conversationId: job.originSessionId ?? 'broadcast' }];
    });
  }

  const targets: DeliveryTarget[] = [];
  for (const part of trimmed.split(',').map((p) => p.trim()).filter(Boolean)) {
    const colon = part.indexOf(':');
    if (colon > 0) {
      const channel = part.slice(0, colon) as ChannelName;
      const conversationId = part.slice(colon + 1);
      targets.push({ channel, conversationId });
      continue;
    }
    targets.push({ channel: part as ChannelName, conversationId: job.originSessionId ?? 'broadcast' });
  }
  return targets;
}

export async function deliverJobOutput(job: ScheduledJob, output: string): Promise<string[]> {
  const sent: string[] = [];
  const targets = parseDeliverSpec(job.deliver, job);

  for (const target of targets) {
    const adapter = channelRegistry.getByName(target.channel);
    if (!adapter?.enabled) continue;
    if (target.conversationId === 'broadcast') continue;
    try {
      await adapter.sendMessage(target.conversationId, output);
      sent.push(`${target.channel}:${target.conversationId}`);
    } catch {
      // continue other deliveries
    }
  }

  return sent;
}
