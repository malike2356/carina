import type { ChannelMessage, ChannelName } from './channel-adapter.interface.js';
import { channelRegistry } from './channel-registry.js';
import { shouldAcceptGroupInbound } from './channel-group-policy.js';
import { describeSessionBinding } from './channel-session-binding.js';

export type InboundNormalizeResult =
  | { ok: true; message: ChannelMessage; sessionBinding: string }
  | { ok: false; reason: string };

/**
 * Parse raw platform payload and apply shared group mention policy.
 * Keeps channel-specific parsing inside adapters; core only sees ChannelMessage.
 */
export async function normalizeChannelInbound(
  channel: ChannelName,
  raw: unknown,
): Promise<InboundNormalizeResult> {
  const inbound = await channelRegistry.getForInbound(channel, raw);
  if (!inbound) {
    return { ok: false, reason: 'adapter returned no message' };
  }

  const groupDecision = shouldAcceptGroupInbound(inbound);
  if (!groupDecision.accept) {
    return { ok: false, reason: groupDecision.reason };
  }

  return {
    ok: true,
    message: inbound,
    sessionBinding: describeSessionBinding(inbound),
  };
}
