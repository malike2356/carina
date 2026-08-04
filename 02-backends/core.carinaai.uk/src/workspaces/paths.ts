import path from 'path';
import { CARINA_HOME } from '../config/paths.js';
import { expandHome } from '../cli/config/defaults.js';
import type { AgentDefinition } from './types.js';

export function agentsConfigPath(homeDir = CARINA_HOME): string {
  return path.join(homeDir, 'agents.json');
}

export function activeAgentFile(homeDir = CARINA_HOME): string {
  return path.join(homeDir, 'active-agent');
}

export function resolveAgentWorkspace(agent: AgentDefinition): string {
  return expandHome(agent.workspace);
}

export function resolveAgentDir(agent: AgentDefinition, homeDir = CARINA_HOME): string {
  if (agent.agentDir) return expandHome(agent.agentDir);
  return path.join(homeDir, 'agents', agent.id);
}

export function agentSessionsDir(agent: AgentDefinition, homeDir = CARINA_HOME): string {
  return path.join(resolveAgentDir(agent, homeDir), 'sessions');
}

export function defaultWorkspacePath(agentId: string, homeDir = CARINA_HOME): string {
  return path.join(homeDir, 'workspaces', agentId);
}

export function defaultAgentDir(agentId: string, homeDir = CARINA_HOME): string {
  return path.join(homeDir, 'agents', agentId);
}
