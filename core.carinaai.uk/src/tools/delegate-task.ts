import type { Tool } from '../types/index.js';
import {
  canDelegate,
  clearDelegationDepth,
  createChildAbortController,
  getDelegationDepth,
  MAX_CONCURRENT_SUBAGENTS,
  releaseChildAbortController,
  setDelegationDepth,
} from '../agents/delegation-context.js';
import { runDelegatedTask } from '../agents/subagent-runner.js';
import { resolveToolset, LEAF_EXCLUDED_TOOLS } from './toolset.js';

const DEFAULT_TIMEOUT_SECONDS = 60;

interface DelegateTaskInput {
  goal?: string;
  context?: string;
  toolsets?: string[];
  workdir?: string;
  timeoutSeconds?: number;
  tasks?: Array<{
    goal: string;
    context?: string;
    toolsets?: string[];
    workdir?: string;
    timeoutSeconds?: number;
  }>;
}

function validateToolsets(toolsets: string[]): string | null {
  const excludedSet = new Set<string>(LEAF_EXCLUDED_TOOLS);
  for (const set of toolsets) {
    const key = set.toLowerCase().trim().replace(/_/g, '-');
    if (excludedSet.has(key)) {
      return `Subagents cannot use ${key}.`;
    }
  }
  const resolved = resolveToolset(toolsets);
  for (const tool of resolved) {
    if (excludedSet.has(tool)) {
      return `Subagents cannot use ${tool}.`;
    }
  }
  return null;
}

async function runSingleTask(
  parentSessionId: string,
  goal: string,
  context: string | undefined,
  toolsets: string[],
  childDepth: number,
  workdir?: string,
  timeoutSeconds = DEFAULT_TIMEOUT_SECONDS,
): Promise<string> {
  const childAbort = createChildAbortController(parentSessionId);
  const subSessionId = `${parentSessionId}:sub:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  try {
    if (childAbort.signal.aborted) {
      return 'Subagent cancelled: parent turn ended.';
    }

    setDelegationDepth(subSessionId, childDepth);

    const allowedTools = resolveToolset(toolsets.length > 0 ? toolsets : ['terminal', 'file', 'web']);

    return await runDelegatedTask({
      subSessionId,
      goal,
      context,
      allowedTools,
      childDepth,
      workdir,
      timeoutMs: timeoutSeconds * 1000,
      abortSignal: childAbort.signal,
    });
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
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
      'Spawn isolated subagents in worker threads to run tasks in parallel on all platforms (Windows, Linux, macOS). Use when a task has genuinely independent sub-parts that can run concurrently. Single mode: provide goal + optional context and toolsets. Batch mode: provide a tasks array (up to 3 run concurrently, queue beyond that). The parent receives only the final summary from each subagent; intermediate tool calls are invisible. Subagents cannot use delegate-task, memory, clarify, todo, email, or cron. Pick toolsets from: terminal, file, web, browser, search, media. Default toolsets when omitted: terminal, file, web. Default timeout: 60 seconds per subagent. Do not delegate when a single-turn answer suffices.',
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'Single-task goal' },
        context: { type: 'string', description: 'Background: file paths, errors, constraints' },
        toolsets: {
          type: 'array',
          items: { type: 'string' },
          description: 'terminal, file, web, browser, search',
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
        return {
          error: `Delegation depth limit (${getDelegationDepth(parentSessionId)}) reached. Subagents cannot delegate further.`,
        };
      }

      const input = params as DelegateTaskInput;
      const childDepth = getDelegationDepth(parentSessionId) + 1;
      const defaultTimeout = input.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;

      if (input.tasks && input.tasks.length > 0) {
        const batch = input.tasks;
        const summaries = await runWithConcurrency(batch, async (task) => {
          const toolsets = task.toolsets ?? ['terminal', 'file', 'web'];
          const err = validateToolsets(toolsets);
          if (err) return `Error: ${err}`;
          return runSingleTask(
            parentSessionId,
            task.goal,
            task.context,
            toolsets,
            childDepth,
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
      const err = validateToolsets(toolsets);
      if (err) return { error: err };

      const summary = await runSingleTask(
        parentSessionId,
        goal,
        input.context,
        toolsets,
        childDepth,
        input.workdir ? String(input.workdir) : undefined,
        defaultTimeout,
      );
      return { mode: 'single', summary, delegatedTo: 'worker_thread' };
    },
  };
}

export { runDelegatedTask } from '../agents/subagent-runner.js';
export { getDelegationDepth, setDelegationDepth } from '../agents/delegation-context.js';
