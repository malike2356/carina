import type { AgentBinding, AgentBindingMatch, AgentDefinition, AgentsConfig, RoutingContext, RoutingResult } from './types.js';
import { getDefaultAgentDefinition, loadAgentsConfig } from './agent-registry.js';

type ScoredBinding = { binding: AgentBinding; tier: number };

function matchAccount(rule: string | undefined, ctxAccount?: string): boolean {
  if (!rule) return true;
  if (rule === '*') return true;
  const account = ctxAccount ?? 'default';
  return rule === account;
}

function matchPeer(rule: AgentBindingMatch['peer'], peerKind?: string, peerId?: string): boolean {
  if (!rule) return true;
  if (!peerKind || !peerId) return false;
  return rule.kind === peerKind && rule.id === peerId;
}

function bindingTier(binding: AgentBinding, ctx: RoutingContext): number | null {
  const m = binding.match;
  if (m.channel && m.channel !== '*' && m.channel !== ctx.channel) return null;

  if (m.contactId) {
    if (!ctx.contactId || m.contactId !== ctx.contactId) return null;
    let tier = 105;
    if (m.accountId && matchAccount(m.accountId, ctx.accountId)) tier += 5;
    return tier;
  }

  if (m.peer) {
    if (!matchPeer(m.peer, ctx.peerKind, ctx.peerId)) return null;
    let tier = 100;
    if (m.accountId && matchAccount(m.accountId, ctx.accountId)) tier += 10;
    if (m.guildId && m.guildId === ctx.guildId) tier += 5;
    if (m.teamId && m.teamId === ctx.teamId) tier += 5;
    return tier;
  }

  if (m.guildId) {
    if (m.guildId !== ctx.guildId) return null;
    let tier = 60;
    if (m.teamId && m.teamId === ctx.teamId) tier += 5;
    if (m.accountId && matchAccount(m.accountId, ctx.accountId)) tier += 5;
    return tier;
  }

  if (m.teamId) {
    if (m.teamId !== ctx.teamId) return null;
    let tier = 50;
    if (m.accountId && matchAccount(m.accountId, ctx.accountId)) tier += 5;
    return tier;
  }

  if (m.accountId) {
    if (!matchAccount(m.accountId, ctx.accountId)) return null;
    return 40;
  }

  if (m.channel && m.channel !== '*') {
    return 30;
  }

  if (m.channel === '*') {
    return 10;
  }

  return null;
}

function tierLabel(tier: number): string {
  if (tier >= 105) return 'contact';
  if (tier >= 100) return 'peer';
  if (tier >= 60) return 'guild';
  if (tier >= 50) return 'team';
  if (tier >= 40) return 'account';
  if (tier >= 30) return 'channel';
  return 'default';
}

export function resolveAgentRoute(
  ctx: RoutingContext,
  config: AgentsConfig = loadAgentsConfig(),
): RoutingResult {
  const scored: ScoredBinding[] = [];
  for (const binding of config.bindings) {
    const tier = bindingTier(binding, ctx);
    if (tier !== null) scored.push({ binding, tier });
  }

  scored.sort((a, b) => b.tier - a.tier);
  const winner = scored[0];
  if (winner) {
    const agent = config.agents.find((a) => a.id === winner.binding.agentId);
    if (agent) {
      return { agent, binding: winner.binding, tier: tierLabel(winner.tier), source: 'binding' };
    }
  }

  return { agent: getDefaultAgentDefinition(), tier: 'default', source: 'default' };
}

export function describeRoute(
  ctx: RoutingContext,
  config: AgentsConfig = loadAgentsConfig(),
): string {
  const result = resolveAgentRoute(ctx, config);
  const parts = [
    `agent=${result.agent.id}`,
    `tier=${result.tier}`,
    `channel=${ctx.channel}`,
  ];
  if (ctx.accountId) parts.push(`account=${ctx.accountId}`);
  if (ctx.peerKind && ctx.peerId) parts.push(`peer=${ctx.peerKind}:${ctx.peerId}`);
  if (result.binding?.label) parts.push(`binding=${result.binding.label}`);
  return parts.join(' ');
}
