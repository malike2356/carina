import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import type { SubagentWorkerData, SubagentWorkerMessage } from './subagent-worker.js';

export type SubagentTaskParams = {
  subSessionId: string;
  goal: string;
  context?: string;
  allowedTools: string[];
  childDepth: number;
  role?: import('./delegation-context.js').SubagentRole;
  workdir?: string;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
};

export type DelegateWorkerResult = SubagentWorkerMessage;

const DEFAULT_TIMEOUT_MS = 60_000;

function resolveSubagentWorkerUrl(): URL {
  const jsUrl = new URL('./subagent-worker.js', import.meta.url);
  if (existsSync(fileURLToPath(jsUrl))) {
    return jsUrl;
  }
  return new URL('./subagent-worker.ts', import.meta.url);
}

function workerExecArgv(): string[] | undefined {
  const jsUrl = new URL('./subagent-worker.js', import.meta.url);
  if (existsSync(fileURLToPath(jsUrl))) {
    return undefined;
  }
  return ['--import', 'tsx'];
}

function buildWorkerPayload(params: SubagentTaskParams): SubagentWorkerData {
  const workdirNote = params.workdir ? `\nWorking directory: ${params.workdir}` : '';
  const prompt = params.context
    ? `${params.context}${workdirNote}\n\nGoal: ${params.goal}`
    : `${params.goal}${workdirNote}`;

  return {
    subSessionId: params.subSessionId,
    goal: params.goal,
    prompt,
    allowedTools: params.allowedTools,
    childDepth: params.childDepth,
    workdir: params.workdir,
    role: params.role,
  };
}

export async function runDelegatedTask(params: SubagentTaskParams): Promise<string> {
  if (params.abortSignal?.aborted) {
    throw new Error('Subagent cancelled: parent turn ended.');
  }

  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const workerData = buildWorkerPayload(params);

  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(resolveSubagentWorkerUrl(), {
      workerData,
      execArgv: workerExecArgv(),
    });

    const finish = (handler: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      params.abortSignal?.removeEventListener('abort', onAbort);
      handler();
    };

    const timer = setTimeout(() => {
      void worker.terminate().catch(() => undefined);
      finish(() => {
        reject(new Error(`Delegated task timed out after ${timeoutMs}ms`));
      });
    }, timeoutMs);

    const onAbort = (): void => {
      void worker.terminate().catch(() => undefined);
      finish(() => {
        reject(new Error('Subagent cancelled: parent turn ended.'));
      });
    };

    params.abortSignal?.addEventListener('abort', onAbort, { once: true });

    worker.on('message', (msg: DelegateWorkerResult) => {
      void worker.terminate().catch(() => undefined);
      finish(() => {
        if (msg.ok) {
          resolve(msg.result);
          return;
        }
        reject(new Error(msg.error));
      });
    });

    worker.on('error', (err) => {
      finish(() => {
        reject(err);
      });
    });

    worker.on('exit', (code) => {
      if (!settled && code !== 0) {
        finish(() => {
          reject(new Error(`Subagent worker exited with code ${code ?? 1}`));
        });
      }
    });
  });
}

export async function runParallelDelegations(
  tasks: Array<{ goal: string; context?: string; workdir?: string }>,
  common: Omit<SubagentTaskParams, 'goal' | 'context' | 'workdir' | 'subSessionId'> & {
    parentSessionId: string;
  },
): Promise<string[]> {
  return Promise.all(
    tasks.map((task, index) =>
      runDelegatedTask({
        subSessionId: `${common.parentSessionId}:sub:${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        goal: task.goal,
        context: task.context,
        workdir: task.workdir,
        allowedTools: common.allowedTools,
        childDepth: common.childDepth,
        timeoutMs: common.timeoutMs,
        abortSignal: common.abortSignal,
      }),
    ),
  );
}
