import type { ChannelMessage } from '../gateway/channels/channel-adapter.interface.js';
import { lookupDirectoryPeer } from '../gateway/channels/directory.js';
import {
  buildThreadKey,
  getThreadOwnership,
  threadOwnershipEnabled,
} from '../gateway/channels/thread-ownership.js';
import { resolveInboundThreadId } from '../gateway/channels/channel-routing.js';
import { loadAgentsConfig } from './agent-registry.js';
import { resolveAgentRoute } from './agent-routing.js';
import type { AgentsConfig, RoutingContext, RoutingResult } from './types.js';

export async function enrichRoutingContext(inbound: ChannelMessage): Promise<RoutingContext> {
  const base: RoutingContext = {
    channel: inbound.channel,
    accountId: inbound.accountId,
    peerKind: inbound.isDirect ? 'direct' : 'group',
    peerId: inbound.conversationId,
    guildId: inbound.guildId,
    teamId: inbound.teamId,
  };

  try {
    const entry = await lookupDirectoryPeer(inbound.channel, inbound.externalUserId);
    if (entry) {
      const contacts = await import('../profiles/contacts.js').then((m) => m.loadAllContacts());
      const contact = contacts.find((c) => c.name === entry.displayName);
      if (contact?.id) base.contactId = contact.id;
    }
  } catch {
    // directory lookup is best-effort
  }

  return base;
}

export function resolveOwnershipRoute(
  inbound: ChannelMessage,
  config: AgentsConfig = loadAgentsConfig(),
): RoutingResult | null {
  if (!threadOwnershipEnabled()) return null;

  const threadId = resolveInboundThreadId(inbound);
  const key = buildThreadKey(inbound.channel, inbound.conversationId, threadId);
  const record = getThreadOwnership(key);
  if (!record) return null;

  const agent = config.agents.find((a) => a.id === record.agentId);
  if (!agent) return null;

  return {
    agent,
    tier: 'ownership',
    source: 'ownership',
    handoffFromAgentId: record.handoffFrom,
  };
}

export function shouldHandOffToOwner(
  bindingAgentId: string,
  ownerAgentId: string,
): boolean {
  return bindingAgentId !== ownerAgentId;
}

export async function resolveInboundAgentRoute(
  inbound: ChannelMessage,
  config: AgentsConfig = loadAgentsConfig(),
): Promise<RoutingResult> {
  const ownershipRoute = resolveOwnershipRoute(inbound, config);
  const ctx = await enrichRoutingContext(inbound);
  const bindingRoute = resolveAgentRoute(ctx, config);

  if (ownershipRoute) {
    if (shouldHandOffToOwner(bindingRoute.agent.id, ownershipRoute.agent.id)) {
      return {
        ...ownershipRoute,
        binding: bindingRoute.binding,
        handoffFromAgentId: bindingRoute.agent.id,
      };
    }
    return ownershipRoute;
  }

  return bindingRoute;
}

export function describeInboundRoute(
  inbound: ChannelMessage,
  route: RoutingResult,
  ctx: RoutingContext,
): string {
  const parts = [
    `agent=${route.agent.id}`,
    `source=${route.source}`,
    `tier=${route.tier}`,
    `channel=${ctx.channel}`,
  ];
  if (ctx.contactId) parts.push(`contact=${ctx.contactId}`);
  if (ctx.accountId) parts.push(`account=${ctx.accountId}`);
  if (ctx.peerKind && ctx.peerId) parts.push(`peer=${ctx.peerKind}:${ctx.peerId}`);
  if (route.handoffFromAgentId) parts.push(`handoffFrom=${route.handoffFromAgentId}`);
  if (route.binding?.label) parts.push(`binding=${route.binding.label}`);
  return parts.join(' ');
}
