import {
  LEAF_FORBIDDEN_TOOLS,
  MAX_CONCURRENT_CHILDREN,
  MAX_SPAWN_DEPTH,
  type AgentRole,
  type AgentSpawnContext,
} from './agent-roles.js';

export function checkToolPermission(
  toolName: string,
  context: AgentSpawnContext,
): string | null {
  const normalized = toolName.toLowerCase().trim();
  if (context.role === 'leaf' && LEAF_FORBIDDEN_TOOLS.has(normalized)) {
    return `Tool "${toolName}" is not available to leaf agents. `
      + 'Complete your task with the tools you have, then return your result.';
  }
  return null;
}

export function checkSpawnPermission(
  context: AgentSpawnContext,
  currentChildCount: number,
): string | null {
  if (context.depth >= MAX_SPAWN_DEPTH) {
    return `Maximum agent spawn depth (${MAX_SPAWN_DEPTH}) reached. `
      + 'You must complete this task yourself without spawning further agents.';
  }
  if (currentChildCount >= MAX_CONCURRENT_CHILDREN) {
    return `Maximum concurrent children (${MAX_CONCURRENT_CHILDREN}) reached. `
      + 'Wait for existing agents to complete before spawning more.';
  }
  return null;
}

export function buildChildSpawnContext(
  parentContext: AgentSpawnContext,
  parentAgentId: string,
): AgentSpawnContext {
  const depth = parentContext.depth + 1;
  const role: AgentRole = depth >= MAX_SPAWN_DEPTH ? 'leaf' : 'orchestrator';
  return {
    depth,
    parentAgentId,
    role,
  };
}

export function buildLeafRolePrompt(): string {
  return [
    'AGENT ROLE: LEAF WORKER',
    '',
    'You are a leaf agent. Your job is to execute the task assigned to you and return a result.',
    'You do NOT have access to:',
    '- Spawning other agents',
    '- Delegating tasks',
    '- Sending messages to channels',
    '',
    'Focus on the task. When done, return your result clearly and concisely.',
  ].join('\n');
}

export function buildOrchestratorRolePrompt(depth: number): string {
  const remainingDepth = MAX_SPAWN_DEPTH - depth;
  return [
    `AGENT ROLE: ORCHESTRATOR (depth ${depth}/${MAX_SPAWN_DEPTH})`,
    '',
    `You can delegate subtasks to worker agents (up to ${MAX_CONCURRENT_CHILDREN} at a time).`,
    `You have ${remainingDepth} more level(s) of delegation available.`,
    'Wait for each worker to complete before using their output.',
    '',
    'When you delegate: break the task into independent subtasks, assign each to a worker,',
    'collect their summaries, and synthesize the final result.',
  ].join('\n');
}
