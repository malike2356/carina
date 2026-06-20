import { executeJob, updateJob } from '../agents/cron-scheduler.js';
import {
  executeTaskFlowRun,
  retryTaskFlowRun,
  triggerTaskFlow,
} from '../ops/taskflows/index.js';
import type { TaskRow } from './data-provider.js';

export async function runSelectedTaskAction(
  task: TaskRow | undefined,
  action: 'pause' | 'resume' | 'run',
): Promise<string> {
  if (!task) return 'No task selected';

  if (task.kind === 'cron') {
    if (action === 'pause') {
      const job = await updateJob(task.id, { status: 'paused' });
      return job ? `Paused cron job ${task.id.slice(0, 8)}` : `Cron job not found: ${task.id}`;
    }
    if (action === 'resume') {
      const job = await updateJob(task.id, { status: 'active' });
      return job ? `Resumed cron job ${task.id.slice(0, 8)}` : `Cron job not found: ${task.id}`;
    }
    const output = await executeJob(task.id);
    const preview = output.replace(/\s+/g, ' ').slice(0, 200);
    return `Ran cron job ${task.id.slice(0, 8)}: ${preview || '(no output)'}`;
  }

  if (task.kind === 'taskflow') {
    if (action !== 'run') {
      return 'Taskflows support :run only from the TUI (use carina taskflows pause/resume for schedules)';
    }
    if (task.status === 'failed') {
      const retry = retryTaskFlowRun(task.id);
      if (retry) {
        void executeTaskFlowRun(retry.id);
        return `Retrying taskflow run ${retry.id.slice(0, 8)}`;
      }
    }
    if (task.flowId) {
      const run = triggerTaskFlow(task.flowId);
      return run
        ? `Triggered taskflow ${task.flowId.slice(0, 8)} (run ${run.id.slice(0, 8)})`
        : `Could not trigger taskflow ${task.flowId}`;
    }
    return 'Taskflow row missing flow id';
  }

  if (task.kind === 'subagent') {
    return 'Subagent rows are telemetry only; delegate new work from chat with delegate-task';
  }

  return `Action :${action} is not supported for ${task.kind} rows`;
}
