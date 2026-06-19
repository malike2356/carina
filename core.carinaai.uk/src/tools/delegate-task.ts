import type { Tool } from '../types/index.js';
import {
  canDelegate,
  clearDelegationDepth,
  createChildAbortController,
  getActiveChildCount,
  getDelegationDepth,
  getSpawnContext,
  MAX_CONCURRENT_SUBAGENTS,
  releaseChildAbortController,
  setSpawnContext,
  type SubagentRole,
} from '../agents/delegation-context.js';
import {
  buildChildSpawnContext,
  checkSpawnPermission,
} from '../agents/role-enforcer.js';
import { emitDelegationComplete } from '../agents/delegation-completion.js';
import {
  formatSubagentSummary,
  resolveSubagentAllowedTools,
  validateSubagentToolsets,
  type SubagentRole as PolicyRole,
} from '../agents/subagent-policy.js';
import { trackChildSession } from '../memory/session-scope.js';
import { runDelegatedTask } from '../agents/subagent-runner.js';

const DEFAULT_TIMEOUT_SECONDS = 60;

interface DelegateTaskInput {
  goal?: string;
  context?: string;
  toolsets?: string[];
  workdir?: string;
  timeoutSeconds?: number;
  role?: PolicyRole;
  tasks?: Array<{
    goal: string;
    context?: string;
    toolsets?: string[];
    workdir?: string;
    timeoutSeconds?: number;
    role?: PolicyRole;
  }>;
}

function normalizeRole(role: unknown): SubagentRole {
  return role === 'orchestrator' ? 'orchestrator' : 'leaf';
}

async function runSingleTask(
  parentSessionId: string,
  goal: string,
  context: string | undefined,
  toolsets: string[],
  childDepth: number,
  role: SubagentRole,
  workdir?: string,
  timeoutSeconds = DEFAULT_TIMEOUT_SECONDS,
): Promise<string> {
  const parentCtx = getSpawnContext(parentSessionId);
  const spawnErr = checkSpawnPermission(parentCtx, getActiveChildCount(parentSessionId));
  if (spawnErr) {
    return `[ROLE RESTRICTION] ${spawnErr}`;
  }

  const started = Date.now();
  const childAbort = createChildAbortController(parentSessionId);
  const subSessionId = `${parentSessionId}:sub:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  trackChildSession(subSessionId, parentSessionId);
  let effectiveRole: SubagentRole = role;

  try {
    if (childAbort.signal.aborted) {
      return 'Subagent cancelled: parent turn ended.';
    }

    const childCtx = buildChildSpawnContext(parentCtx, parentSessionId);
    effectiveRole = childCtx.role === 'leaf' ? 'leaf' : role;
    setSpawnContext(subSessionId, {
      ...childCtx,
      role: effectiveRole,
    });

    const allowedTools = resolveSubagentAllowedTools(toolsets);

    const raw = await runDelegatedTask({
      subSessionId,
      goal,
      context,
      allowedTools,
      childDepth: childCtx.depth,
      role: effectiveRole,
      workdir,
      timeoutMs: timeoutSeconds * 1000,
      abortSignal: childAbort.signal,
    });
    const summary = formatSubagentSummary(raw);
    await emitDelegationComplete({
      parentSessionId,
      subSessionId,
      goal,
      summary,
      mode: 'single',
      success: !summary.startsWith('Error:') && !summary.startsWith('Subagent cancelled'),
      role: effectiveRole,
      durationMs: Date.now() - started,
    });
    return summary;
  } catch (err) {
    const message = `Error: ${err instanceof Error ? err.message : String(err)}`;
    await emitDelegationComplete({
      parentSessionId,
      subSessionId,
      goal,
      summary: message,
      mode: 'single',
      success: false,
      role: effectiveRole,
      durationMs: Date.now() - started,
    });
    return message;
  } finally {
    releaseChildAbortController(parentSessionId, childAbort);
    clearSubagentState(subSessionId);
  }
}

function clearSubagentState(subSessionId: string): void {
  clearDelegationDepth(subSessionId);
}

async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<string>,
): Promise<string[]> {
  const results: string[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      try {
        results[idx] = await fn(items[idx], idx);
      } catch (err) {
        results[idx] = `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENT_SUBAGENTS, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

export function createDelegateTaskTool(sessionId: string): Tool {
  return {
    name: 'delegate-task',
    dangerous: true,
    requiresConfirmation: true,
    description:
      'Spawn isolated subagents in worker threads to run tasks in parallel on all platforms (Windows, Linux, macOS). Use when a task has genuinely independent sub-parts that can run concurrently. Single mode: provide goal + optional context and toolsets. Batch mode: provide a tasks array (up to 3 run concurrently, queue beyond that). Role leaf (default): worker only, no further delegation. Role orchestrator: may delegate one more level when CARINA_MAX_DELEGATION_DEPTH allows. The parent receives only the final summary from each subagent; intermediate tool calls are invisible. Subagents cannot use delegate-task (leaf), memory, clarify, send-message, todo, email, or cron. Pick toolsets from: terminal, file, web, browser, search, media. Default toolsets when omitted: terminal, file, web. Default timeout: 60 seconds per subagent. Do not delegate when a single-turn answer suffices.',
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'Single-task goal' },
        context: { type: 'string', description: 'Background: file paths, errors, constraints' },
        toolsets: {
          type: 'array',
          items: { type: 'string' },
          description: 'terminal, file, web, browser, search, media',
        },
        role: {
          type: 'string',
          enum: ['leaf', 'orchestrator'],
          description: 'leaf: no further delegation (default). orchestrator: may spawn workers when depth allows.',
        },
        workdir: { type: 'string', description: 'Working directory for the subagent' },
        timeoutSeconds: {
          type: 'number',
          description: 'Max time in seconds for the subagent; default 60',
        },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              goal: { type: 'string' },
              context: { type: 'string' },
              toolsets: { type: 'array', items: { type: 'string' } },
              workdir: { type: 'string' },
              timeoutSeconds: { type: 'number' },
              role: { type: 'string', enum: ['leaf', 'orchestrator'] },
            },
            required: ['goal'],
          },
          description: 'Batch mode: parallel tasks (max 3 concurrent, queue beyond that)',
        },
      },
    },
    execute: async (params) => {
      const parentSessionId = String(params._sessionId ?? sessionId);

      if (!canDelegate(parentSessionId)) {
        const ctx = getSpawnContext(parentSessionId);
        const spawnErr = checkSpawnPermission(ctx, getActiveChildCount(parentSessionId));
        if (spawnErr) {
          return { error: `[ROLE RESTRICTION] ${spawnErr}` };
        }
        return {
          error: `[ROLE RESTRICTION] Delegation depth limit (${ctx.depth}/${getDelegationDepth(parentSessionId)}) reached. `
            + 'Complete this task yourself without spawning further agents.',
        };
      }

      const input = params as DelegateTaskInput;
      const childDepth = getDelegationDepth(parentSessionId) + 1;
      const defaultTimeout = input.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
      const defaultRole = normalizeRole(input.role);

      if (input.tasks && input.tasks.length > 0) {
        const batch = input.tasks;
        const summaries = await runWithConcurrency(batch, async (task) => {
          const toolsets = task.toolsets ?? ['terminal', 'file', 'web'];
          const err = validateSubagentToolsets(toolsets);
          if (err) return `Error: ${err}`;
          return runSingleTask(
            parentSessionId,
            task.goal,
            task.context,
            toolsets,
            childDepth,
            normalizeRole(task.role ?? defaultRole),
            task.workdir,
            task.timeoutSeconds ?? defaultTimeout,
          );
        });
        return {
          mode: 'batch',
          taskCount: batch.length,
          concurrency: Math.min(MAX_CONCURRENT_SUBAGENTS, batch.length),
          delegatedTo: 'worker_thread',
          results: summaries,
        };
      }

      const goal = String(input.goal ?? '').trim();
      if (!goal) return { error: 'goal or tasks is required.' };

      const toolsets = input.toolsets ?? ['terminal', 'file', 'web'];
      const err = validateSubagentToolsets(toolsets);
      if (err) return { error: err };

      const summary = await runSingleTask(
        parentSessionId,
        goal,
        input.context,
        toolsets,
        childDepth,
        defaultRole,
        input.workdir ? String(input.workdir) : undefined,
        defaultTimeout,
      );
      return { mode: 'single', summary, delegatedTo: 'worker_thread', role: defaultRole };
    },
  };
}

export { runDelegatedTask } from '../agents/subagent-runner.js';
export { getDelegationDepth, setDelegationDepth } from '../agents/delegation-context.js';
