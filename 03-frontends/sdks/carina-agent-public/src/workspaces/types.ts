import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';

export type PeerKind = 'direct' | 'group' | 'channel';

export type AgentBindingMatch = {
  channel?: ChannelName | '*';
  accountId?: string;
  peer?: { kind: PeerKind; id: string };
  guildId?: string;
  teamId?: string;
};

export type AgentBinding = {
  agentId: string;
  match: AgentBindingMatch;
  label?: string;
};

export type AgentDefinition = {
  id: string;
  name: string;
  default?: boolean;
  workspace: string;
  agentDir?: string;
  provider?: string;
  model?: string;
  skillPacks?: string[];
  description?: string;
};

export type AgentToAgentPolicy = {
  enabled: boolean;
  allow: string[];
};

export type AgentsConfig = {
  version: number;
  agents: AgentDefinition[];
  bindings: AgentBinding[];
  tools?: {
    agentToAgent?: AgentToAgentPolicy;
  };
};

export type RoutingContext = {
  channel: ChannelName;
  accountId?: string;
  peerKind?: PeerKind;
  peerId?: string;
  guildId?: string;
  teamId?: string;
};

export type RoutingResult = {
  agent: AgentDefinition;
  binding?: AgentBinding;
  tier: string;
};
