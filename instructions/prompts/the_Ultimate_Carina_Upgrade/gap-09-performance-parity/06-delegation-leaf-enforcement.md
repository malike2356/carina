# Gap 09 - Prompt 06: Delegation Leaf Role Enforcement

> **REUSE RULE:** See `../REUSE-RULES.md`. Implement the behavior below in Carina's own voice. No competitor product names, labels, CLI text, UI copy, or config key names may appear verbatim in shipped code. Rename all user-visible elements to Carina equivalents before committing.


**Agent:** Claude Code
**Estimated hours:** 3-4 hrs
**Depends on:** `src/agents/orchestrator.ts` exists

---

## The Problem

Carina has `src/agents/orchestrator.ts` and a kanban system, but there is no enforced distinction
between a "leaf" agent (a worker that executes tasks) and an "orchestrator" agent (a coordinator
that delegates to workers). Without this, any agent can spawn child agents recursively, leading
to unbounded spawn depth and token explosion.

Hermes enforces:
- **Leaf agents**: cannot call `delegate_task`, `clarify`, `send_message`, or spawn sub-agents.
  They receive tasks and return results. That's all.
- **Orchestrators**: can spawn workers, but bounded by `max_spawn_depth=2` and
  `max_concurrent_children=3`. When depth limit is hit, the orchestrator must do the work itself.
- Parent orchestrator waits synchronously for each child's summary before continuing.

This prevents runaway recursive delegation that burns tokens and produces no output.

---

## Read First

```
core.carinaai.uk/src/agents/orchestrator.ts           (main orchestrator)
core.carinaai.uk/src/agents/carina.ts                 (agent entry point)
core.carinaai.uk/src/agents/kanban-service.ts         (kanban task dispatch)
core.carinaai.uk/src/agents/kanban-types.ts           (type definitions)
core.carinaai.uk/src/agents/conversation-discipline.ts (agent rules enforcement)
```

---

## 1. Agent Role Types

```typescript
// src/agents/agent-roles.ts  (new file)

export type AgentRole = 'leaf' | 'orchestrator' | 'hybrid';

/**
 * Tools that leaf agents are NOT allowed to call.
 * Enforced at the tool-call level in the agent runtime.
 */
export const LEAF_FORBIDDEN_TOOLS = new Set([
  'delegate_task',
  'spawn_agent',
  'create_subagent',
  'clarify',               // asking for clarification (should clarify upfront or return partial)
  'send_message',          // sending messages through channels (orchestrator concern)
  'kanban_assign',         // assigning kanban tasks (orchestrator concern)
  'kanban_create',         // creating new kanban tasks mid-execution
]);

export const MAX_SPAWN_DEPTH = 2;
export const MAX_CONCURRENT_CHILDREN = 3;

export interface AgentSpawnContext {
  /** 0 = top-level. 1 = spawned by top-level. 2 = spawned by spawned. */
  depth: number;
  parentAgentId: string | null;
  role: AgentRole;
}
```

---

## 2. Role Enforcement Middleware

```typescript
// src/agents/role-enforcer.ts  (new file)

import { LEAF_FORBIDDEN_TOOLS, MAX_SPAWN_DEPTH, MAX_CONCURRENT_CHILDREN } from './agent-roles.js';
import type { AgentSpawnContext } from './agent-roles.js';

/**
 * Check if a tool call is permitted for the agent's role.
 * Returns an error message if forbidden, or null if allowed.
 */
export function checkToolPermission(
  toolName: string,
  context: AgentSpawnContext
): string | null {
  if (context.role === 'leaf' && LEAF_FORBIDDEN_TOOLS.has(toolName)) {
    return `Tool "${toolName}" is not available to leaf agents. ` +
      `Complete your task with the tools you have, then return your result.`;
  }
  return null;
}

/**
 * Check if spawning a new child agent is allowed.
 * Returns an error message if forbidden, or null if allowed.
 */
export function checkSpawnPermission(
  context: AgentSpawnContext,
  currentChildCount: number
): string | null {
  if (context.depth >= MAX_SPAWN_DEPTH) {
    return `Maximum agent spawn depth (${MAX_SPAWN_DEPTH}) reached. ` +
      `You must complete this task yourself without spawning further agents.`;
  }
  if (currentChildCount >= MAX_CONCURRENT_CHILDREN) {
    return `Maximum concurrent children (${MAX_CONCURRENT_CHILDREN}) reached. ` +
      `Wait for existing agents to complete before spawning more.`;
  }
  return null;
}

/**
 * Build spawn context for a child agent.
 */
export function buildChildSpawnContext(
  parentContext: AgentSpawnContext,
  parentAgentId: string
): AgentSpawnContext {
  return {
    depth: parentContext.depth + 1,
    parentAgentId,
    role: parentContext.depth + 1 >= MAX_SPAWN_DEPTH ? 'leaf' : 'orchestrator',
  };
}

/**
 * Build the system prompt suffix injected into leaf agents to explain their role.
 */
export function buildLeafRolePrompt(): string {
  return `
AGENT ROLE: LEAF WORKER

You are a leaf agent. Your job is to execute the task assigned to you and return a result.
You do NOT have access to:
- Spawning other agents
- Delegating tasks
- Sending messages to channels

Focus on the task. When done, return your result clearly and concisely.
  `.trim();
}

/**
 * Build the system prompt suffix for orchestrator agents.
 */
export function buildOrchestratorRolePrompt(depth: number): string {
  const remainingDepth = MAX_SPAWN_DEPTH - depth;
  return `
AGENT ROLE: ORCHESTRATOR (depth ${depth}/${MAX_SPAWN_DEPTH})

You can delegate subtasks to worker agents (up to ${MAX_CONCURRENT_CHILDREN} at a time).
You have ${remainingDepth} more level(s) of delegation available.
Wait for each worker to complete before using their output.

When you delegate: break the task into independent subtasks, assign each to a worker,
collect their summaries, and synthesize the final result.
  `.trim();
}
```

---

## 3. Wire Into Orchestrator

```typescript
// src/agents/orchestrator.ts  (modifications)

import {
  checkToolPermission,
  checkSpawnPermission,
  buildChildSpawnContext,
  buildLeafRolePrompt,
  buildOrchestratorRolePrompt,
} from './role-enforcer.js';
import type { AgentSpawnContext } from './agent-roles.js';

// Add spawnContext to the orchestrator config
interface OrchestratorConfig {
  // ... existing fields ...
  spawnContext?: AgentSpawnContext;
}

class Orchestrator {
  private spawnContext: AgentSpawnContext;
  private activeChildren = new Map<string, Promise<string>>();

  constructor(config: OrchestratorConfig) {
    this.spawnContext = config.spawnContext ?? {
      depth: 0,
      parentAgentId: null,
      role: 'orchestrator',
    };
  }

  /**
   * Pre-flight check before executing any tool call.
   * If role-forbidden, return an error to the LLM instead of executing.
   */
  private checkToolAccess(toolName: string): string | null {
    return checkToolPermission(toolName, this.spawnContext);
  }

  /**
   * Spawn a child agent for a subtask.
   */
  async spawnChild(task: string): Promise<string> {
    const permissionError = checkSpawnPermission(
      this.spawnContext,
      this.activeChildren.size
    );
    if (permissionError) {
      // Must do the work ourselves
      return this.executeLocally(task);
    }

    const childContext = buildChildSpawnContext(this.spawnContext, this.agentId);
    const childRolePrompt = childContext.role === 'leaf'
      ? buildLeafRolePrompt()
      : buildOrchestratorRolePrompt(childContext.depth);

    const childPromise = runChildAgent({
      task,
      spawnContext: childContext,
      systemPromptSuffix: childRolePrompt,
    });

    const childId = crypto.randomUUID();
    this.activeChildren.set(childId, childPromise);

    try {
      const result = await childPromise;
      return result;
    } finally {
      this.activeChildren.delete(childId);
    }
  }

  /** Build system prompt with role context appended */
  buildSystemPrompt(base: string): string {
    const roleBlock = this.spawnContext.role === 'leaf'
      ? buildLeafRolePrompt()
      : buildOrchestratorRolePrompt(this.spawnContext.depth);
    return `${base}\n\n---\n${roleBlock}`;
  }
}
```

---

## 4. Tool Call Interceptor

In the tool execution layer, intercept forbidden tools:

```typescript
// src/tools/tool-executor.ts  (modify the dispatch function)

import { checkToolPermission } from '../agents/role-enforcer.js';

export async function executeTool(
  toolName: string,
  args: unknown,
  spawnContext: AgentSpawnContext
): Promise<string> {
  // Role enforcement check
  const roleError = checkToolPermission(toolName, spawnContext);
  if (roleError) {
    // Return as a tool result so the LLM gets the message and can adapt
    return `[ROLE RESTRICTION] ${roleError}`;
  }

  // ... existing tool dispatch logic ...
}
```

---

## 5. Kanban Task Assignment

When creating kanban tasks for agents, propagate the spawn context:

```typescript
// src/agents/kanban-service.ts  (modify task dispatch)

import { buildChildSpawnContext } from './role-enforcer.js';

async function dispatchTaskToAgent(
  task: KanbanTask,
  parentContext: AgentSpawnContext
): Promise<void> {
  const childContext = buildChildSpawnContext(parentContext, task.assignedBy ?? 'system');

  await createAgentRun({
    taskId: task.id,
    spawnContext: childContext,
    instructions: task.description,
  });
}
```

---

## 6. CLI Visibility

```typescript
// Add to carina agent show-context command:
registry.register({
  name: 'agent context',
  description: 'Show the current agent role and spawn depth',
  handler: async () => {
    const ctx = getCurrentSpawnContext();
    return [
      `Role:           ${ctx.role}`,
      `Depth:          ${ctx.depth}/${MAX_SPAWN_DEPTH}`,
      `Parent:         ${ctx.parentAgentId ?? 'none (top-level)'}`,
      `Active children: ${getActiveChildCount()}/${MAX_CONCURRENT_CHILDREN}`,
    ].join('\n');
  },
});
```

---

## Files to Create

```
core.carinaai.uk/src/agents/agent-roles.ts
core.carinaai.uk/src/agents/role-enforcer.ts
```

## Files to Modify

```
core.carinaai.uk/src/agents/orchestrator.ts         add spawnContext, role prompt, child spawn enforcement
core.carinaai.uk/src/tools/tool-executor.ts         add role enforcement check before dispatch
core.carinaai.uk/src/agents/kanban-service.ts       propagate spawnContext to dispatched tasks
core.carinaai.uk/src/agents/carina.ts               pass spawnContext on agent init
```

---

## Done When

- [ ] A leaf agent calling `delegate_task` receives "[ROLE RESTRICTION]" error, not an execution
- [ ] An orchestrator at depth 2 calling `delegate_task` also receives the depth-limit error
- [ ] An orchestrator at depth 0 can spawn up to 3 concurrent children
- [ ] A 4th child spawn returns an error while 3 are active
- [ ] Child agents inherit spawnContext with depth incremented
- [ ] Agents at depth 2 automatically get role='leaf'
- [ ] `carina agent context` shows role, depth, parent, and active children
- [ ] buildLeafRolePrompt / buildOrchestratorRolePrompt are appended to system prompts
- [ ] Unit test: checkToolPermission('delegate_task', leaf) returns error string
- [ ] Unit test: checkSpawnPermission at depth 2 returns error string
- [ ] Unit test: child context has depth = parent.depth + 1