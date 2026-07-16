import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';

export interface CronDeliveryTarget {
  channel: ChannelName;
  conversationId: string;
  threadId?: string;
}

const sessionOrigins = new Map<string, CronDeliveryTarget>();
const recentByChannel = new Map<ChannelName, CronDeliveryTarget>();

const SKIP_FANOUT: ReadonlySet<ChannelName> = new Set(['cli', 'web', 'api', 'webhooks']);

export function bindSessionDelivery(sessionId: string, target: CronDeliveryTarget): void {
  sessionOrigins.set(sessionId, target);
  if (!SKIP_FANOUT.has(target.channel)) {
    recentByChannel.set(target.channel, target);
  }
}

export function getSessionDelivery(sessionId: string): CronDeliveryTarget | undefined {
  return sessionOrigins.get(sessionId);
}

export function listFanoutTargets(): CronDeliveryTarget[] {
  return [...recentByChannel.values()];
}

export function clearDeliveryRegistryForTests(): void {
  sessionOrigins.clear();
  recentByChannel.clear();
}
