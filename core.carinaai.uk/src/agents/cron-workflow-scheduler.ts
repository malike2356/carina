import { Cron } from 'croner';
import { parseSchedule } from './cron-scheduler.js';
import { executeWorkflow } from './cron-workflow-engine.js';
import type { CronWorkflow } from './cron-workflow-types.js';

interface WorkflowRuntime {
  workflow: CronWorkflow;
  cron: Cron | null;
}

const runtimes = new Map<string, WorkflowRuntime>();

export function registerWorkflow(workflow: CronWorkflow): void {
  if (workflow.status !== 'active') return;
  unregisterWorkflow(workflow.id);

  const parsed = parseSchedule(workflow.schedule);
  const runFn = () => {
    void executeWorkflow(workflow.id).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[cron-workflow] ${workflow.id} failed: ${msg}`);
    });
  };

  let cron: Cron | null = null;
  if (parsed.oneShot) {
    const delay = parsed.oneShot.getTime() - Date.now();
    if (delay > 0) setTimeout(runFn, delay).unref();
  } else {
    cron = new Cron(parsed.cronExpr, runFn);
  }

  runtimes.set(workflow.id, { workflow, cron });
}

export function unregisterWorkflow(id: string): void {
  const runtime = runtimes.get(id);
  if (runtime?.cron) runtime.cron.stop();
  runtimes.delete(id);
}

export async function loadAndRegisterAllWorkflows(): Promise<number> {
  const { listWorkflows } = await import('./cron-workflow-store.js');
  const workflows = await listWorkflows();
  for (const workflow of workflows) {
    if (workflow.status === 'active') registerWorkflow(workflow);
  }
  return workflows.length;
}
