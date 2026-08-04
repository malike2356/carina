import { loadWorkspaceContext } from '../workspace/context-files.js';
import type { AgentDefinition } from './types.js';
import { resolveAgentWorkspace } from './paths.js';

export type AgentRuntimeContext = {
  agent: AgentDefinition;
  workspaceDir: string;
  workspaceContext: string;
  providerOverride?: { name: string; model?: string };
};

export async function buildAgentRuntimeContext(agent: AgentDefinition): Promise<AgentRuntimeContext> {
  const workspaceDir = resolveAgentWorkspace(agent);
  const parts = await loadWorkspaceContext(workspaceDir);
  const header = [
    `# Agent workspace: ${agent.name} (${agent.id})`,
    agent.description ? agent.description : '',
  ].filter(Boolean).join('\n');
  const workspaceContext = parts.length > 0
    ? `${header}\n\n${parts.join('\n\n---\n\n')}`
    : header;

  const providerOverride = agent.provider
    ? { name: agent.provider, model: agent.model }
    : undefined;

  return { agent, workspaceDir, workspaceContext, providerOverride };
}

export function applyAgentRuntimeEnv(ctx: AgentRuntimeContext): void {
  process.env.CARINA_ACTIVE_AGENT = ctx.agent.id;
  process.env.CARINA_AGENT_WORKSPACE = ctx.workspaceDir;
}

export function clearAgentRuntimeEnv(): void {
  delete process.env.CARINA_ACTIVE_AGENT;
  delete process.env.CARINA_AGENT_WORKSPACE;
}
