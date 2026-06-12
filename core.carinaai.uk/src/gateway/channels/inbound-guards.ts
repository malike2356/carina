import type { ChannelMessage } from './channel-adapter.interface.js';
import { checkDmAllowed, channelDmPairingEnabled } from './dm-pairing.js';
import {
  tryAcquireThreadOwnership,
  threadOwnershipEnabled,
} from './thread-ownership.js';

export type InboundGuardResult =
  | { allow: true; threadKey?: string }
  | { allow: false; reason: string; code: 'dm_blocked' | 'thread_owned' };

const OWNERSHIP_CHANNELS = new Set([
  'slack', 'discord', 'telegram', 'whatsapp', 'matrix', 'mattermost', 'imessage', 'signal', 'irc',
]);

export function guardInboundMessage(
  inbound: ChannelMessage,
  agentId: string,
): InboundGuardResult {
  const dmOn = inbound.isDirect && channelDmPairingEnabled(inbound.channel);
  const ownershipOn = threadOwnershipEnabled();
  if (!dmOn && !ownershipOn) {
    return { allow: true };
  }

  if (dmOn) {
    const dm = checkDmAllowed(inbound.channel, inbound.externalUserId, true);
    if (!dm.allowed) {
      return { allow: false, reason: dm.reason ?? 'DM not allowed', code: 'dm_blocked' };
    }
  }

  if (!ownershipOn || !OWNERSHIP_CHANNELS.has(inbound.channel)) {
    return { allow: true };
  }

  const threadId = inbound.threadId ?? (inbound.isDirect ? 'dm' : 'root');
  const acquire = tryAcquireThreadOwnership({
    channel: inbound.channel,
    conversationId: inbound.conversationId,
    threadId,
    agentId,
  });

  if (!acquire.ok) {
    return {
      allow: false,
      reason: acquire.reason,
      code: 'thread_owned',
    };
  }

  return { allow: true, threadKey: acquire.record.key };
}
