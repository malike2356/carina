import type { ProviderOverride } from '../../brain/llm.js';
import {
  enqueueTaskFlowRun,
  getTaskFlow,
  getTaskFlowRun,
  listTaskFlows,
  taskFlowsEnabled,
  updateTaskFlowRun,
  waitForTaskFlowRun,
} from './store.js';
import type { ModelOverride, TaskFlow, TaskFlowRun, TaskFlowStep, TaskFlowTrigger } from './types.js';
import { runTimeoutMs } from './config.js';

async function withJobProfile<T>(profileName: string | undefined, fn: () => Promise<T>): Promise<T> {
  const prev = process.env.CARINA_PROFILE;
  if (profileName) process.env.CARINA_PROFILE = profileName;
  try {
    return await fn();
  } finally {
    if (profileName) {
      if (prev === undefined) delete process.env.CARINA_PROFILE;
      else process.env.CARINA_PROFILE = prev;
    }
  }
}

function toProviderOverride(model?: ModelOverride): ProviderOverride | undefined {
  if (!model?.provider && !model?.model) return undefined;
  return { name: model.provider ?? '', model: model.model };
}

async function runStep(
  step: TaskFlowStep,
  runId: string,
  flow: TaskFlow,
  profileName?: string,
): Promise<string> {
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

  if (step.type === 'subagent') {
    const { ResearchAgent } = await import('../../agents/research-agent.js');
    const { CodingAgent } = await import('../../agents/coding-agent.js');
    const { CommunicationAgent } = await import('../../agents/communication-agent.js');
    const { FileAgent } = await import('../../agents/file-agent.js');
    const sessionId = `taskflow:${runId}:subagent`;
    const override = toProviderOverride(step.model ?? flow.model);
    const agents = {
      research: ResearchAgent,
      coding: CodingAgent,
      communication: CommunicationAgent,
      file: FileAgent,
    } as const;
    const AgentCtor = agents[step.agentType] ?? ResearchAgent;
    const agent = new AgentCtor(sessionId, undefined, override);
    const text = await agent.run(step.prompt);
    void triggerTaskFlowsForSubagent(step.agentType, { run_id: runId, agent_type: step.agentType, summary: text.slice(0, 500) });
    return text.slice(0, 4000);
  }

  if (step.type === 'kanban') {
    const sessionId = step.sessionId ?? `taskflow:${runId}`;
    if (step.action === 'create_cards') {
      const { addCard } = await import('../../agents/kanban-store.js');
      const titles = step.titles ?? ['TaskFlow kanban item'];
      const cardIds: string[] = [];
      for (const title of titles) {
        const card = await addCard({ sessionId, title, column: 'backlog', workPrompt: title, targetRole: 'worker' });
        cardIds.push(card.id);
      }
      return JSON.stringify({ cardIds });
    }
    if (step.action === 'run_lanes') {
      const { runParallelKanbanLanes } = await import('../../agents/orchestrator-kanban.js');
      const cardIds = step.cardIds ?? [];
      const results = await runParallelKanbanLanes(sessionId, cardIds);
      return JSON.stringify(results).slice(0, 4000);
    }
    if (step.action === 'wait_review') {
      const { listCards } = await import('../../agents/kanban-store.js');
      const cards = await listCards(sessionId, 'default', 'review');
      return JSON.stringify(cards.map((c) => ({ id: c.id, title: c.title })));
    }
    return 'kanban step complete';
  }

  if (step.type === 'flow') {
    const child = enqueueTaskFlowRun(step.flowId, { profileName });
    if (!child) throw new Error(`child flow ${step.flowId} not found or inactive`);
    if (step.wait !== false) {
      void executeTaskFlowRun(child.id);
      const finished = await waitForTaskFlowRun(child.id, runTimeoutMs());
      if (!finished || (finished.status !== 'succeeded')) {
        throw new Error(finished?.error ?? `child flow ${step.flowId} did not succeed`);
      }
      return finished.output ?? 'child flow succeeded';
    }
    void executeTaskFlowRun(child.id);
    return `triggered flow ${step.flowId}`;
  }

  if (step.type === 'agent') {
    const { CarinaAgent } = await import('../../agents/carina.js');
    const sessionId = `taskflow:${runId}`;
    const override = toProviderOverride(step.model ?? flow.model);
    const agent = new CarinaAgent(sessionId, false, undefined, {
      platform: 'taskflow',
      persistMemory: false,
      maxTurns: 8,
    });
    if (override?.name) agent.setProviderOverride(override);
    const result = await agent.runTurn(step.prompt);
    return result.text.slice(0, 4000);
  }

  return 'unknown step';
}

export async function executeTaskFlowRun(runId: string): Promise<TaskFlowRun | null> {
  if (!taskFlowsEnabled()) return null;

  const run = getTaskFlowRun(runId);
  if (!run || run.status !== 'queued') return run ?? null;

  const flow = getTaskFlow(run.flowId);
  if (!flow) {
    return updateTaskFlowRun(runId, {
      status: 'lost',
      error: 'flow definition missing',
      finishedAt: new Date().toISOString(),
    });
  }

  const profileName = run.profileName ?? flow.profileName;
  return withJobProfile(profileName, async () => {
    updateTaskFlowRun(runId, { status: 'running', startedAt: new Date().toISOString() });

    let output = '';
    let stepOutputs = { ...(run.stepOutputs ?? {}) };
    try {
      for (let i = run.stepIndex; i < flow.steps.length; i++) {
        const cached = stepOutputs[String(i)];
        if (cached) {
          output = cached;
          continue;
        }
        updateTaskFlowRun(runId, { stepIndex: i, stepOutputs });
        output = await runStep(flow.steps[i]!, runId, flow, profileName);
        stepOutputs = { ...stepOutputs, [String(i)]: output };
        updateTaskFlowRun(runId, { stepOutputs, output });
      }

      const finished = updateTaskFlowRun(runId, {
        status: 'succeeded',
        output,
        stepOutputs,
        finishedAt: new Date().toISOString(),
      });

      for (const nextId of flow.chainOnSuccess) {
        const chained = enqueueTaskFlowRun(nextId, { profileName });
        if (chained) void executeTaskFlowRun(chained.id);
      }

      return finished;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const timedOut = msg.includes('timed out');
      const current = getTaskFlowRun(runId);
      const maxRetries = flow.maxRetries ?? 0;
      const retryCount = current?.retryCount ?? 0;
      if (!timedOut && retryCount < maxRetries) {
        return updateTaskFlowRun(runId, {
          status: 'queued',
          stepIndex: current?.stepIndex ?? run.stepIndex,
          stepOutputs,
          retryCount: retryCount + 1,
          error: `retry ${retryCount + 1}/${maxRetries}: ${msg}`,
          startedAt: undefined,
        });
      }

      return updateTaskFlowRun(runId, {
        status: timedOut ? 'timed_out' : 'failed',
        error: msg,
        output,
        stepOutputs,
        finishedAt: new Date().toISOString(),
      });
    }
  });
}

export function triggerTaskFlow(flowId: string): TaskFlowRun | null {
  const flow = getTaskFlow(flowId);
  const run = enqueueTaskFlowRun(flowId, { profileName: flow?.profileName });
  if (run) void executeTaskFlowRun(run.id);
  return run;
}

function flowMatchesTrigger(flow: TaskFlow, predicate: (t: TaskFlowTrigger) => boolean): boolean {
  return (flow.triggers ?? []).some(predicate);
}

export function triggerTaskFlowsForEvent(event: string, payload?: Record<string, unknown>): TaskFlowRun[] {
  if (!taskFlowsEnabled()) return [];
  const hourBucket = new Date().toISOString().slice(0, 13);
  const triggered: TaskFlowRun[] = [];
  for (const flow of listTaskFlows()) {
    if (flow.status !== 'active') continue;
    const matches = flowMatchesTrigger(flow, (t) =>
      t.type === 'webhook' && t.event === event);
    if (!matches) continue;
    const idempotencyKey = `webhook:${event}:${flow.id}:${hourBucket}`;
    const run = enqueueTaskFlowRun(flow.id, { idempotencyKey, profileName: flow.profileName });
    if (run && run.status === 'queued' && !run.startedAt) {
      updateTaskFlowRun(run.id, {
        output: payload ? JSON.stringify(payload).slice(0, 500) : undefined,
      });
      void executeTaskFlowRun(run.id);
      triggered.push(run);
    } else if (run) {
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
  const hourBucket = new Date().toISOString().slice(0, 13);
  const triggered: TaskFlowRun[] = [];
  for (const flow of listTaskFlows()) {
    if (flow.status !== 'active') continue;
    const matches = flowMatchesTrigger(flow, (t) => t.type === 'cron' && t.jobId === jobId);
    if (!matches) continue;
    const idempotencyKey = `cron:${jobId}:${flow.id}:${hourBucket}`;
    const run = enqueueTaskFlowRun(flow.id, { idempotencyKey, profileName: flow.profileName });
    if (run && run.status === 'queued' && !run.startedAt) {
      updateTaskFlowRun(run.id, {
        output: payload ? JSON.stringify(payload).slice(0, 500) : undefined,
      });
      void executeTaskFlowRun(run.id);
      triggered.push(run);
    } else if (run) {
      triggered.push(run);
    }
  }
  return triggered;
}

export function triggerTaskFlowsForSubagent(
  agentType: string,
  payload?: Record<string, unknown>,
): TaskFlowRun[] {
  if (!taskFlowsEnabled()) return [];
  const triggered: TaskFlowRun[] = [];
  for (const flow of listTaskFlows()) {
    if (flow.status !== 'active') continue;
    const matches = flowMatchesTrigger(flow, (t) =>
      t.type === 'subagent' && (!t.agentType || t.agentType === agentType));
    if (!matches) continue;
    const run = enqueueTaskFlowRun(flow.id, { profileName: flow.profileName });
    if (run) {
      void executeTaskFlowRun(run.id);
      triggered.push(run);
    }
  }
  return triggered;
}

export function triggerTaskFlowsForKanban(
  event: 'review' | 'done' | 'move',
  payload?: Record<string, unknown>,
): TaskFlowRun[] {
  if (!taskFlowsEnabled()) return [];
  const triggered: TaskFlowRun[] = [];
  for (const flow of listTaskFlows()) {
    if (flow.status !== 'active') continue;
    const matches = flowMatchesTrigger(flow, (t) => t.type === 'kanban' && t.event === event);
    if (!matches) continue;
    const run = enqueueTaskFlowRun(flow.id, { profileName: flow.profileName });
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
