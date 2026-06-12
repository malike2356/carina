import type { ChannelMessage, ChannelName } from './channel-adapter.interface.js';
import type { RoutingContext } from '../../workspaces/types.js';
import { getThreadOwnership, threadOwnershipEnabled, buildThreadKey } from './thread-ownership.js';
import { channelDmPairingEnabled } from './dm-pairing.js';

export interface InboundRoutingMeta {
  channel: ChannelName;
  threadId: string;
  peerId: string;
  conversationId: string;
  profile: string;
  instanceId: string;
  ownershipEnabled: boolean;
  dmPairingEnabled: boolean;
  ownershipState: 'free' | 'owned' | 'disabled';
  ownerAgentId?: string;
  ownerInstanceId?: string;
}

export function channelPeerScopingEnabled(): boolean {
  return process.env.CARINA_CHANNEL_PEER_SCOPING === 'true';
}

/**
 * Session isolation key for gateway sessions. Opt-in via CARINA_CHANNEL_PEER_SCOPING.
 * Legacy key preserved when flag is off.
 */
export function buildSessionExternalKey(inbound: ChannelMessage): string {
  if (!channelPeerScopingEnabled()) {
    return inbound.conversationId === inbound.externalUserId
      ? inbound.externalUserId
      : `${inbound.conversationId}:${inbound.externalUserId}`;
  }

  const peer = inbound.externalUserId;
  const conv = inbound.conversationId;
  let key = inbound.isDirect || conv === peer
    ? `${inbound.channel}:${peer}`
    : `${inbound.channel}:${conv}:${peer}`;

  if (threadOwnershipEnabled()) {
    const tid = inbound.threadId?.trim();
    if (tid && tid !== 'root') {
      key += `:t:${tid}`;
    }
  }
  return key;
}

export function buildRoutingContext(inbound: ChannelMessage): RoutingContext {
  return {
    channel: inbound.channel,
    accountId: inbound.accountId,
    peerKind: inbound.isDirect ? 'direct' : 'group',
    peerId: inbound.conversationId,
    guildId: inbound.guildId,
    teamId: inbound.teamId,
  };
}

export function resolveInboundThreadId(inbound: ChannelMessage): string {
  return inbound.threadId?.trim() || (inbound.isDirect ? 'dm' : 'root');
}

export function buildInboundRoutingMeta(
  inbound: ChannelMessage,
  agentId: string,
): InboundRoutingMeta {
  const threadId = resolveInboundThreadId(inbound);
  const profile = process.env.CARINA_PROFILE ?? 'default';
  const instanceId = process.env.CARINA_INSTANCE_ID ?? 'default';
  const ownershipOn = threadOwnershipEnabled();

  let ownershipState: InboundRoutingMeta['ownershipState'] = 'disabled';
  let ownerAgentId: string | undefined;
  let ownerInstanceId: string | undefined;

  if (ownershipOn) {
    const key = buildThreadKey(inbound.channel, inbound.conversationId, threadId);
    const record = getThreadOwnership(key);
    if (record) {
      ownershipState = 'owned';
      ownerAgentId = record.agentId;
      ownerInstanceId = record.instanceId;
    } else {
      ownershipState = 'free';
    }
  }

  return {
    channel: inbound.channel,
    threadId,
    peerId: inbound.externalUserId,
    conversationId: inbound.conversationId,
    profile,
    instanceId,
    ownershipEnabled: ownershipOn,
    dmPairingEnabled: inbound.isDirect && channelDmPairingEnabled(inbound.channel),
    ownershipState,
    ownerAgentId,
    ownerInstanceId,
  };
}
