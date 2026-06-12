import {
  enqueueTaskFlowRun,
  getTaskFlow,
  listTaskFlows,
  taskFlowsEnabled,
  updateTaskFlowRun,
} from './store.js';
import type { TaskFlowRun, TaskFlowStep } from './types.js';
import { runTimeoutMs } from './config.js';

const DEFAULT_STEP_TIMEOUT_MS = 120_000;

async function runStep(step: TaskFlowStep, runId: string): Promise<string> {
  if (step.type === 'delay') {
    await new Promise((r) => setTimeout(r, Math.min(step.ms, 60_000)));
    return `delayed ${step.ms}ms`;
  }

  if (step.type === 'webhook') {
    const { dispatchWebhook } = await import('../../webhooks/dispatcher.js');
    const event = step.event as 'process.complete' | 'cron.complete' | 'kanban.move' | 'agent.turn.complete';
    await dispatchWebhook(event, step.payload ?? {});
    return `webhook ${step.event} dispatched`;
  }

  if (step.type === 'cron') {
    const { executeJob } = await import('../../agents/cron-scheduler.js');
    const output = await executeJob(step.jobId);
    return output.slice(0, 4000);
  }

  if (step.type === 'tool') {
    const { executeToolCall } = await import('../../agents/tool-runner.js');
    const result = await executeToolCall(
      {
        type: 'tool_call',
        toolName: step.name,
        toolCallId: `taskflow-${runId}`,
        params: step.args ?? {},
      },
      undefined,
      false,
      `taskflow:${runId}`,
    );
    return typeof result === 'string' ? result.slice(0, 4000) : JSON.stringify(result).slice(0, 4000);
  }

  if (step.type === 'agent') {
    const { getRouter } = await import('../../gateway/router.js');
    const router = getRouter();
    const chunks: string[] = [];
    const timeout = Math.min(DEFAULT_STEP_TIMEOUT_MS, runTimeoutMs());
    const work = (async () => {
      for await (const chunk of router.handleInbound('web', {
        id: runId,
        sessionId: `taskflow:${runId}`,
        message: step.prompt,
      })) {
        chunks.push(chunk);
      }
    })();
    await Promise.race([
      work,
      new Promise((_, reject) => setTimeout(() => reject(new Error('agent step timed out')), timeout)),
    ]);
    return chunks.join('').slice(0, 4000);
  }

  return 'unknown step';
}

export async function executeTaskFlowRun(runId: string): Promise<TaskFlowRun | null> {
  if (!taskFlowsEnabled()) return null;

  const { listTaskFlowRuns } = await import('./store.js');
  const run = listTaskFlowRuns(500).find((r) => r.id === runId);
  if (!run || run.status !== 'queued') return run ?? null;

  const flow = getTaskFlow(run.flowId);
  if (!flow) {
    return updateTaskFlowRun(runId, {
      status: 'lost',
      error: 'flow definition missing',
      finishedAt: new Date().toISOString(),
    });
  }

  updateTaskFlowRun(runId, { status: 'running', startedAt: new Date().toISOString() });

  let output = '';
  try {
    for (let i = run.stepIndex; i < flow.steps.length; i++) {
      updateTaskFlowRun(runId, { stepIndex: i });
      output = await runStep(flow.steps[i]!, runId);
    }

    const finished = updateTaskFlowRun(runId, {
      status: 'succeeded',
      output,
      finishedAt: new Date().toISOString(),
    });

    for (const nextId of flow.chainOnSuccess) {
      const chained = enqueueTaskFlowRun(nextId);
      if (chained) void executeTaskFlowRun(chained.id);
    }

    return finished;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const timedOut = msg.includes('timed out');

    const maxRetries = flow.maxRetries ?? 0;
    const retryCount = run.retryCount ?? 0;
    if (!timedOut && retryCount < maxRetries) {
      return updateTaskFlowRun(runId, {
        status: 'queued',
        stepIndex: run.stepIndex,
        retryCount: retryCount + 1,
        error: `retry ${retryCount + 1}/${maxRetries}: ${msg}`,
        startedAt: undefined,
      });
    }

    return updateTaskFlowRun(runId, {
      status: timedOut ? 'timed_out' : 'failed',
      error: msg,
      output,
      finishedAt: new Date().toISOString(),
    });
  }
}

export function triggerTaskFlow(flowId: string): TaskFlowRun | null {
  const run = enqueueTaskFlowRun(flowId);
  if (run) void executeTaskFlowRun(run.id);
  return run;
}

export function triggerTaskFlowsForEvent(event: string, payload?: Record<string, unknown>): TaskFlowRun[] {
  if (!taskFlowsEnabled()) return [];
  const triggered: TaskFlowRun[] = [];
  for (const flow of listTaskFlows()) {
    if (flow.status !== 'active') continue;
    const matches = (flow.triggers ?? []).some(
      (t) => t.type === 'webhook' && t.event === event,
    );
    if (!matches) continue;
    const run = enqueueTaskFlowRun(flow.id);
    if (run) {
      updateTaskFlowRun(run.id, {
        output: payload ? JSON.stringify(payload).slice(0, 500) : undefined,
      });
      void executeTaskFlowRun(run.id);
      triggered.push(run);
    }
  }
  return triggered;
}

export function triggerTaskFlowsForCronJob(
  jobId: string,
  payload?: Record<string, unknown>,
): TaskFlowRun[] {
  if (!taskFlowsEnabled()) return [];
  const triggered: TaskFlowRun[] = [];
  for (const flow of listTaskFlows()) {
    if (flow.status !== 'active') continue;
    const matches = (flow.triggers ?? []).some(
      (t) => t.type === 'cron' && t.jobId === jobId,
    );
    if (!matches) continue;
    const run = enqueueTaskFlowRun(flow.id);
    if (run) {
      updateTaskFlowRun(run.id, {
        output: payload ? JSON.stringify(payload).slice(0, 500) : undefined,
      });
      void executeTaskFlowRun(run.id);
      triggered.push(run);
    }
  }
  return triggered;
}
