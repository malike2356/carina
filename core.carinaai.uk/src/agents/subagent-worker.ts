import { isMainThread, parentPort, workerData } from 'worker_threads';
import { clearDelegationDepth, setDelegationDepth } from './delegation-context.js';
import type { SubagentRole } from './delegation-context.js';
import { GenericSubAgent } from './generic-sub-agent.js';

if (isMainThread) {
  throw new Error('subagent-worker.ts must be run as a Worker, not directly');
}

export type SubagentWorkerData = {
  subSessionId: string;
  goal: string;
  prompt: string;
  allowedTools: string[];
  childDepth: number;
  workdir?: string;
  role?: SubagentRole;
};

export type SubagentWorkerMessage =
  | { ok: true; result: string }
  | { ok: false; error: string; stack?: string };

async function runSubagent(data: SubagentWorkerData): Promise<string> {
  setDelegationDepth(data.subSessionId, data.childDepth);
  try {
    const agent = new GenericSubAgent(
      data.subSessionId,
      data.goal,
      data.allowedTools,
      undefined,
      undefined,
      data.childDepth,
      undefined,
      data.workdir,
      data.role ?? 'leaf',
    );
    return await agent.run(data.prompt);
  } finally {
    clearDelegationDepth(data.subSessionId);
  }
}

const task = workerData as SubagentWorkerData;

runSubagent(task)
  .then((result) => {
    parentPort?.postMessage({ ok: true, result } satisfies SubagentWorkerMessage);
  })
  .catch((err: unknown) => {
    const error = err instanceof Error ? err : new Error(String(err));
    parentPort?.postMessage({
      ok: false,
      error: error.message,
      stack: error.stack,
    } satisfies SubagentWorkerMessage);
  });
