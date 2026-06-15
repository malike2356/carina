import { dispatchWebhook } from '../webhooks/dispatcher.js';
import { deliverJobOutput } from './cron-delivery.js';
import { runCronStep, sleep } from './cron-step-runner.js';
import { buildScopedContext } from './cron-workflow-parser.js';
import {
  createWorkflowRun,
  getWorkflow,
  getWorkflowRun,
  patchWorkflowRun,
} from './cron-workflow-store.js';
import type {
  CronWorkflow,
  CronWorkflowRun,
  CronWorkflowStep,
  CronWorkflowStepState,
} from './cron-workflow-types.js';
import type { ScheduledJob } from './cron-scheduler.js';
import type { CronStepResult } from './cron-step-runner.js';

export interface ExecuteWorkflowResult {
  runId: string;
  status: CronWorkflowRun['status'];
  output: string;
  error?: string;
}

function truncate(text: string, max = 8000): string {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function dependenciesMet(step: CronWorkflowStep, states: Record<string, CronWorkflowStepState>): boolean {
  for (const need of step.needs ?? []) {
    if (states[need]?.status !== 'succeeded') return false;
  }
  return true;
}

function workflowAsJob(workflow: CronWorkflow, deliver: string, deliverChannels: string[]): ScheduledJob {
  return {
    id: workflow.id,
    name: workflow.name,
    schedule: workflow.schedule,
    prompt: null,
    scriptPath: null,
    noAgent: false,
    deliver,
    repeatCount: null,
    runsRemaining: null,
    status: workflow.status,
    lastRun: null,
    nextRun: null,
    contextFrom: [],
    chainAfter: [],
    enabledToolsets: [],
    workdir: workflow.workdir,
    originSessionId: workflow.originSessionId,
    originChannel: workflow.originChannel,
    originConversationId: workflow.originConversationId,
    originThreadId: workflow.originThreadId,
    deliverChannels,
    profileName: 'default',
    modelProvider: null,
    modelName: null,
    createdAt: workflow.createdAt,
  };
}

function resolveStepDelivery(
  workflow: CronWorkflow,
  step: CronWorkflowStep,
): { deliver: string; deliverChannels: string[] } {
  if (step.deliver === false) {
    return { deliver: 'local', deliverChannels: [] };
  }
  if (typeof step.deliver === 'string') {
    return { deliver: step.deliver, deliverChannels: [] };
  }
  if (Array.isArray(step.deliver)) {
    return { deliver: 'local', deliverChannels: step.deliver };
  }
  return { deliver: workflow.deliver, deliverChannels: workflow.deliverChannels };
}

async function deliverStepOutput(
  workflow: CronWorkflow,
  step: CronWorkflowStep,
  output: string,
): Promise<string[]> {
  const routing = resolveStepDelivery(workflow, step);
  if (routing.deliver === 'local' && routing.deliverChannels.length === 0) return [];
  const pseudoJob = workflowAsJob(workflow, routing.deliver, routing.deliverChannels);
  return deliverJobOutput(pseudoJob, output);
}

async function deliverFailure(
  workflow: CronWorkflow,
  message: string,
): Promise<string[]> {
  const spec = workflow.definition.onFailure?.deliver;
  if (!spec) return [];
  const deliver = Array.isArray(spec) ? 'local' : spec;
  const channels = Array.isArray(spec) ? spec : [];
  const pseudoJob = workflowAsJob(workflow, deliver, channels);
  return deliverJobOutput(pseudoJob, message);
}

async function runStepWithRetries(
  workflow: CronWorkflow,
  runId: string,
  step: CronWorkflowStep,
  contextBag: Record<string, string>,
): Promise<CronStepResult> {
  const maxRetries = Math.max(0, step.retries ?? 0);
  const delayMs = Math.max(0, step.retryDelayMs ?? 2000);
  const contextPrefix = buildScopedContext(step, contextBag);
  let lastError = 'step failed';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await runCronStep({
      jobId: `${runId}:${step.id}:${attempt}`,
      prompt: step.prompt ?? null,
      scriptPath: step.scriptPath ?? null,
      noAgent: Boolean(step.noAgent),
      enabledToolsets: step.enabledToolsets ?? [],
      workdir: step.workdir ?? workflow.workdir,
      contextPrefix: contextPrefix || undefined,
    });
    if (result.success) return result;
    lastError = result.error ?? 'step failed';
    if (attempt < maxRetries) await sleep(delayMs);
  }

  return { output: '', success: false, error: lastError };
}

export async function executeWorkflow(
  workflowId: string,
  options: { resumeRunId?: string } = {},
): Promise<ExecuteWorkflowResult> {
  const workflow = await getWorkflow(workflowId);
  if (!workflow || workflow.status === 'removed') {
    throw new Error(`Workflow ${workflowId} not found.`);
  }

  let run = options.resumeRunId
    ? await getWorkflowRun(options.resumeRunId)
    : await createWorkflowRun(workflowId);
  if (!run) throw new Error(`Workflow run ${options.resumeRunId} not found.`);

  const stepStates = { ...run.stepStates };
  const contextBag = { ...run.context };
  const maxChars = workflow.definition.maxStepOutputChars ?? 8000;
  const deliverOn = workflow.definition.deliverOn ?? 'last';

  await patchWorkflowRun(run.id, {
    status: 'running',
    startedAt: run.startedAt ?? new Date(),
    stepStates,
    context: contextBag,
    currentStepId: run.currentStepId,
    error: null,
  });

  let lastOutput = '';
  let failedStep: CronWorkflowStep | null = null;

  for (const step of workflow.definition.steps) {
    if (stepStates[step.id]?.status === 'succeeded') {
      lastOutput = stepStates[step.id]?.output ?? lastOutput;
      continue;
    }

    if (!dependenciesMet(step, stepStates)) {
      stepStates[step.id] = {
        status: 'skipped',
        attempts: 0,
        error: 'dependencies not satisfied',
        finishedAt: new Date().toISOString(),
      };
      await patchWorkflowRun(run.id, { currentStepId: step.id, stepStates });
      continue;
    }

    stepStates[step.id] = { status: 'running', attempts: 0 };
    await patchWorkflowRun(run.id, { currentStepId: step.id, stepStates });

    const result = await runStepWithRetries(workflow, run.id, step, contextBag);
    if (!result.success) {
      stepStates[step.id] = {
        status: 'failed',
        attempts: (step.retries ?? 0) + 1,
        error: result.error,
        finishedAt: new Date().toISOString(),
      };
      failedStep = step;
      await patchWorkflowRun(run.id, { stepStates, error: result.error ?? 'step failed' });
      break;
    }

    const output = truncate(result.output, maxChars);
    stepStates[step.id] = {
      status: 'succeeded',
      attempts: 1,
      output,
      finishedAt: new Date().toISOString(),
    };
    contextBag[step.id] = output;
    lastOutput = output;

    await patchWorkflowRun(run.id, { stepStates, context: contextBag });

    if (deliverOn === 'each' || step.deliver === true || typeof step.deliver === 'string' || Array.isArray(step.deliver)) {
      await deliverStepOutput(workflow, step, output);
    }
  }

  if (failedStep) {
    const failMsg = workflow.definition.onFailure?.message
      ? workflow.definition.onFailure.message.replace('{{step}}', failedStep.id)
      : `[Workflow failed] ${workflow.name} stopped at step ${failedStep.id}: ${stepStates[failedStep.id]?.error ?? 'error'}`;

    if (deliverOn === 'failed' || workflow.definition.onFailure?.deliver) {
      await deliverFailure(workflow, failMsg);
    }

    const finished = await patchWorkflowRun(run.id, {
      status: 'failed',
      finishedAt: new Date(),
      error: stepStates[failedStep.id]?.error ?? 'step failed',
    });

    void dispatchWebhook('cron.complete', {
      workflow_id: workflowId,
      run_id: run.id,
      name: workflow.name,
      success: false,
      failed_step: failedStep.id,
    });

    return {
      runId: run.id,
      status: finished?.status ?? 'failed',
      output: lastOutput,
      error: finished?.error ?? undefined,
    };
  }

  if (deliverOn === 'last' && lastOutput) {
    const lastStep = workflow.definition.steps[workflow.definition.steps.length - 1];
    if (lastStep) await deliverStepOutput(workflow, lastStep, lastOutput);
  }

  const finished = await patchWorkflowRun(run.id, {
    status: 'succeeded',
    finishedAt: new Date(),
    error: null,
  });

  void dispatchWebhook('cron.complete', {
    workflow_id: workflowId,
    run_id: run.id,
    name: workflow.name,
    output: lastOutput.slice(0, 2000),
    success: true,
  });

  return {
    runId: run.id,
    status: finished?.status ?? 'succeeded',
    output: lastOutput,
  };
}

export async function retryWorkflowRun(runId: string): Promise<ExecuteWorkflowResult> {
  const run = await getWorkflowRun(runId);
  if (!run) throw new Error(`Workflow run ${runId} not found.`);
  if (run.status !== 'failed' && run.status !== 'partial') {
    throw new Error(`Run ${runId} is not retryable (status=${run.status}).`);
  }
  return executeWorkflow(run.workflowId, { resumeRunId: runId });
}
