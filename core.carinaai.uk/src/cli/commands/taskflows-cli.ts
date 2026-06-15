import {
  cancelTaskFlowRun,
  executeTaskFlowRun,
  listTaskFlows,
  listTaskFlowRuns,
  listDeliveryQueue,
  pauseTaskFlow,
  processDeliveryQueue,
  processQueuedTaskFlowRuns,
  resumeTaskFlow,
  retryTaskFlowRun,
  searchTaskFlowRuns,
  summarizeTaskFlowRuns,
  taskFlowWorkerEnabled,
  taskFlowWorkerPoolSize,
  taskFlowsEnabled,
  triggerTaskFlow,
  upsertTaskFlow,
} from '../../ops/taskflows/index.js';
import { parseTaskFlowYaml } from '../../ops/taskflows/parser.js';
import fs from 'fs/promises';

function usage(): void {
  console.log(`Usage: carina taskflows <command>

Commands:
  status                 Show whether TaskFlows are enabled (on by default)
  list                   List registered flows for active profile
  runs [--status STATUS] List recent runs
  history <query>        Search run output and errors
  import <file.yaml>     Import flow from YAML
  delivery               List queued deliveries
  create <name>          Create a minimal flow (agent step from --prompt)
  trigger <flow-id>      Queue and run a flow
  pause <flow-id>        Pause a flow
  resume <flow-id>       Resume a paused flow
  cancel <run-id>        Cancel a queued or running run
  retry <run-id> [--from-step N]  Resume failed run from step N (default: failed step)
  worker [--delivery]    Process queued runs (pool size: CARINA_TASKFLOWS_WORKER_POOL)

Set CARINA_TASKFLOWS_ENABLED=false to disable.
Set CARINA_TASKFLOWS_WEBHOOK_HOOK=true to trigger flows on webhook events.
`);
}

export async function runTaskFlowsCommand(args: string[]): Promise<void> {
  const cmd = args[0] ?? 'status';

  if (cmd === 'status') {
    console.log(`TaskFlows: ${taskFlowsEnabled() ? 'enabled (default)' : 'disabled'}`);
    console.log(`Worker: ${taskFlowWorkerEnabled() ? 'enabled' : 'disabled'}`);
    console.log(`Worker pool: ${taskFlowWorkerPoolSize()}`);
    console.log(`Flows: ${listTaskFlows().length}`);
    const counts = summarizeTaskFlowRuns();
    console.log(
      `Runs: queued=${counts.queued} running=${counts.running} ok=${counts.succeeded} `
      + `fail=${counts.failed} timeout=${counts.timed_out} cancelled=${counts.cancelled} lost=${counts.lost}`,
    );
    console.log(`Queued deliveries: ${listDeliveryQueue().length}`);
    return;
  }

  if (cmd === 'list') {
    for (const f of listTaskFlows()) {
      const triggers = (f.triggers ?? []).map((t) => `${t.type}${'event' in t ? `:${t.event}` : ''}`).join(', ');
      console.log(`  ${f.id}  ${f.name}  [${f.status}]  profile=${f.profileName ?? 'default'}  steps=${f.steps.length}  triggers=${triggers || '-'}`);
    }
    return;
  }

  if (cmd === 'runs') {
    const statusIdx = args.indexOf('--status');
    const status = statusIdx >= 0 ? args[statusIdx + 1] : undefined;
    const runs = listTaskFlowRuns(30).filter((r) => !status || r.status === status);
    for (const r of runs) {
      console.log(`  ${r.id.slice(0, 8)}  ${r.flowName}  ${r.status}  step=${r.stepIndex}  profile=${r.profileName ?? '-'}`);
    }
    return;
  }

  if (cmd === 'history') {
    const query = args.slice(1).join(' ').trim();
    if (!query) {
      console.error('history requires a search query');
      process.exitCode = 1;
      return;
    }
    const runs = searchTaskFlowRuns(query, 25);
    if (runs.length === 0) {
      console.log('No matching runs.');
      return;
    }
    for (const r of runs) {
      const snippet = (r.output ?? r.error ?? '').slice(0, 120).replace(/\s+/g, ' ');
      console.log(`  ${r.id.slice(0, 8)}  ${r.flowName}  ${r.status}  ${snippet}`);
    }
    return;
  }

  if (cmd === 'import') {
    const file = args[1];
    if (!file) {
      console.error('import requires a YAML file path');
      process.exitCode = 1;
      return;
    }
    const text = await fs.readFile(file, 'utf8');
    const doc = parseTaskFlowYaml(text);
    const flow = upsertTaskFlow({
      name: doc.name,
      label: doc.label,
      profileName: doc.profileName ?? doc.profile,
      model: doc.model,
      steps: doc.steps,
      chainOnSuccess: doc.chainOnSuccess ?? [],
      triggers: doc.triggers ?? [],
      status: 'active',
      maxRetries: doc.maxRetries,
    });
    console.log(`Imported flow ${flow.id} (${flow.name})`);
    return;
  }

  if (cmd === 'delivery') {
    for (const d of listDeliveryQueue()) {
      console.log(`  ${d.id.slice(0, 8)}  ${d.channel}:${d.conversationId}  ${d.status}`);
    }
    return;
  }

  if (cmd === 'create') {
    const name = args[1];
    const promptIdx = args.indexOf('--prompt');
    const cronIdx = args.indexOf('--cron');
    const profileIdx = args.indexOf('--profile');
    const prompt = promptIdx >= 0 ? args.slice(promptIdx + 1).join(' ') : 'Run scheduled task';
    const cronJobId = cronIdx >= 0 ? args[cronIdx + 1] : undefined;
    const profileName = profileIdx >= 0 ? args[profileIdx + 1] : undefined;
    if (!name) {
      console.error('create requires a name');
      process.exitCode = 1;
      return;
    }
    const triggers = cronJobId ? [{ type: 'cron' as const, jobId: cronJobId }] : [];
    const flow = upsertTaskFlow({
      name,
      profileName,
      steps: [{ type: 'agent', prompt }],
      chainOnSuccess: [],
      triggers,
      status: 'active',
    });
    console.log(`Created flow ${flow.id}${cronJobId ? ` (cron trigger: ${cronJobId})` : ''}`);
    return;
  }

  if (cmd === 'trigger') {
    const id = args[1];
    if (!id) {
      console.error('trigger requires flow id');
      process.exitCode = 1;
      return;
    }
    const run = triggerTaskFlow(id);
    if (!run) {
      console.error('Flow not found or not active');
      process.exitCode = 1;
      return;
    }
    console.log(`Triggered run ${run.id} (${run.status})`);
    return;
  }

  if (cmd === 'pause') {
    const id = args[1];
    if (!id || !pauseTaskFlow(id)) {
      console.error('Flow not found');
      process.exitCode = 1;
      return;
    }
    console.log('Flow paused');
    return;
  }

  if (cmd === 'resume') {
    const id = args[1];
    if (!id || !resumeTaskFlow(id)) {
      console.error('Flow not found');
      process.exitCode = 1;
      return;
    }
    console.log('Flow resumed');
    return;
  }

  if (cmd === 'cancel') {
    const id = args[1];
    if (!id) {
      console.error('cancel requires run id');
      process.exitCode = 1;
      return;
    }
    const run = cancelTaskFlowRun(id);
    if (!run) {
      console.error('Run not found');
      process.exitCode = 1;
      return;
    }
    console.log(`Run ${run.id.slice(0, 8)} status=${run.status}`);
    return;
  }

  if (cmd === 'retry') {
    const id = args[1];
    const fromStepIdx = args.indexOf('--from-step');
    const fromStep = fromStepIdx >= 0 ? Number(args[fromStepIdx + 1]) : undefined;
    if (!id) {
      console.error('retry requires run id (from carina taskflows runs)');
      process.exitCode = 1;
      return;
    }
    const run = retryTaskFlowRun(id, Number.isFinite(fromStep) ? { fromStep } : undefined);
    if (!run) {
      console.error('Run not found or not in a failed/timed_out/cancelled state');
      process.exitCode = 1;
      return;
    }
    void executeTaskFlowRun(run.id);
    console.log(`Retried as run ${run.id.slice(0, 8)} from step ${run.stepIndex} (from ${id.slice(0, 8)})`);
    return;
  }

  if (cmd === 'worker') {
    const started = await processQueuedTaskFlowRuns();
    console.log(`Started ${started} queued run(s) (pool=${taskFlowWorkerPoolSize()})`);
    if (args.includes('--delivery')) {
      const result = await processDeliveryQueue();
      console.log(`Delivery: ${result.delivered} delivered, ${result.failed} failed`);
    }
    return;
  }

  usage();
}
