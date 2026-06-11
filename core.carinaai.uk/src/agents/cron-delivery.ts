import { channelRegistry } from '../gateway/channels/channel-registry.js';
import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';
import type { ScheduledJob } from './cron-scheduler.js';
import { getSessionDelivery, listFanoutTargets } from './cron-delivery-registry.js';

export interface DeliveryTarget {
  channel: ChannelName;
  conversationId: string;
  threadId?: string;
}

const DELIVERABLE_CHANNELS = new Set<string>([
  'telegram', 'whatsapp', 'discord', 'slack', 'sms', 'signal', 'matrix',
  'mattermost', 'dingtalk', 'feishu', 'wechat', 'imessage', 'email',
  'homeassistant',
]);

function parseDeliverPart(part: string, job: ScheduledJob): DeliveryTarget | null {
  const trimmed = part.trim();
  if (!trimmed) return null;

  const segments = trimmed.split(':');
  if (segments.length >= 2) {
    const channel = segments[0] as ChannelName;
    if (!DELIVERABLE_CHANNELS.has(channel)) {
      return null;
    }
    const conversationId = segments[1];
    const threadId = segments.length >= 3 ? segments.slice(2).join(':') : undefined;
    return { channel, conversationId, threadId };
  }

  const channel = trimmed as ChannelName;
  if (!DELIVERABLE_CHANNELS.has(channel)) return null;
  return {
    channel,
    conversationId: job.originConversationId ?? job.originSessionId ?? '',
    threadId: job.originThreadId ?? undefined,
  };
}

export function parseDeliverSpec(spec: string, job: ScheduledJob): DeliveryTarget[] {
  const trimmed = spec.trim();
  const lowered = trimmed.toLowerCase();
  if (!trimmed || lowered === 'local') {
    return [];
  }

  if (lowered === 'origin') {
    if (job.originChannel && job.originConversationId) {
      return [{
        channel: job.originChannel,
        conversationId: job.originConversationId,
        threadId: job.originThreadId ?? undefined,
      }];
    }
    const sessionTarget = job.originSessionId
      ? getSessionDelivery(job.originSessionId)
      : undefined;
    if (sessionTarget) {
      return [sessionTarget];
    }
    return [];
  }

  if (lowered === 'all') {
    return listFanoutTargets();
  }

  const targets: DeliveryTarget[] = [];
  for (const part of trimmed.split(',').map((p) => p.trim()).filter(Boolean)) {
    const target = parseDeliverPart(part, job);
    if (target?.conversationId) targets.push(target);
  }
  return dedupeTargets(targets);
}

export function collectDeliveryTargets(job: ScheduledJob): DeliveryTarget[] {
  const fromSpec = parseDeliverSpec(job.deliver, job);
  const fromChannels = (job.deliverChannels ?? []).flatMap((part) => {
    const target = parseDeliverPart(part, job);
    return target ? [target] : [];
  });
  return dedupeTargets([...fromSpec, ...fromChannels]);
}

function dedupeTargets(targets: DeliveryTarget[]): DeliveryTarget[] {
  const seen = new Set<string>();
  const out: DeliveryTarget[] = [];
  for (const t of targets) {
    const key = `${t.channel}:${t.conversationId}:${t.threadId ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export async function deliverJobOutput(job: ScheduledJob, output: string): Promise<string[]> {
  const targets = collectDeliveryTargets(job);
  const sent: string[] = [];

  await Promise.allSettled(targets.map(async (target) => {
    const adapter = channelRegistry.getByName(target.channel);
    if (!adapter?.enabled) return;
    if (!target.conversationId || target.conversationId === 'broadcast') return;
    try {
      await adapter.sendMessage(target.conversationId, output, {
        threadId: target.threadId,
      });
      sent.push(`${target.channel}:${target.conversationId}`);
    } catch {
      // continue other deliveries
    }
  }));

  return sent;
}
