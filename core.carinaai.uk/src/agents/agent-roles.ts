export type AgentRole = 'leaf' | 'orchestrator' | 'hybrid';

/**
 * Tools leaf agents cannot call. Names match Carina kebab-case tool registry.
 */
export const LEAF_FORBIDDEN_TOOLS = new Set([
  'delegate-task',
  'clarify',
  'send-message',
  'kanban',
  'cronjob',
  'mixture-of-agents',
]);

export const MAX_SPAWN_DEPTH = 2;
export const MAX_CONCURRENT_CHILDREN = 3;

export interface AgentSpawnContext {
  depth: number;
  parentAgentId: string | null;
  role: AgentRole;
}
