import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';

export type PeerKind = 'direct' | 'group' | 'channel';

export type AgentBindingMatch = {
  channel?: ChannelName | '*';
  accountId?: string;
  peer?: { kind: PeerKind; id: string };
  contactId?: string;
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
  /** Per-agent sandbox routing override for shell/code tools */
  sandboxMode?: AgentSandboxMode;
};

export type AgentSandboxMode =
  | 'default'
  | 'host'
  | 'docker'
  | 'session'
  | 'openshell'
  | 'blocked';

export type AgentToAgentPolicy = {
  enabled: boolean;
  allow: string[];
};

export type ShareLearningPolicy = {
  mode: 'off' | 'kernel' | 'allowlist';
  allowAgents?: string[];
  minSuccessCount?: number;
};

export type AgentsConfig = {
  version: number;
  agents: AgentDefinition[];
  bindings: AgentBinding[];
  tools?: {
    agentToAgent?: AgentToAgentPolicy;
  };
  learning?: {
    shareAcrossAgents?: ShareLearningPolicy;
  };
};

export type RoutingContext = {
  channel: ChannelName;
  accountId?: string;
  peerKind?: PeerKind;
  peerId?: string;
  contactId?: string;
  guildId?: string;
  teamId?: string;
};

export type RoutingSource = 'ownership' | 'binding' | 'default';

export type RoutingResult = {
  agent: AgentDefinition;
  binding?: AgentBinding;
  tier: string;
  source: RoutingSource;
  handoffFromAgentId?: string;
};
