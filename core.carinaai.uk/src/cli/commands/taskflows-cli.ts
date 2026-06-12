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
  summarizeTaskFlowRuns,
  taskFlowWorkerEnabled,
  taskFlowsEnabled,
  triggerTaskFlow,
  upsertTaskFlow,
} from '../../ops/taskflows/index.js';

function usage(): void {
  console.log(`Usage: carina taskflows <command>

Commands:
  status                 Show whether TaskFlows are enabled
  list                   List registered flows
  runs [--status STATUS] List recent runs (queued|running|succeeded|failed|timed_out|cancelled|lost)
  delivery               List queued deliveries
  create <name>          Create a minimal flow (agent step from --prompt)
  trigger <flow-id>      Queue and run a flow
  pause <flow-id>        Pause a flow
  resume <flow-id>       Resume a paused flow
  cancel <run-id>        Cancel a queued or running run
  retry <run-id>         Requeue a failed or timed-out run from step 0
  worker [--delivery]    Process queued runs (and optionally delivery queue)

Set CARINA_TASKFLOWS_ENABLED=true to enable execution.
Set CARINA_TASKFLOWS_WEBHOOK_HOOK=true to trigger flows on webhook events.
`);
}

export async function runTaskFlowsCommand(args: string[]): Promise<void> {
  const cmd = args[0] ?? 'status';

  if (cmd === 'status') {
    console.log(`TaskFlows: ${taskFlowsEnabled() ? 'enabled' : 'disabled (set CARINA_TASKFLOWS_ENABLED=true)'}`);
    console.log(`Worker: ${taskFlowWorkerEnabled() ? 'enabled' : 'disabled'}`);
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
      console.log(`  ${f.id}  ${f.name}  [${f.status}]  steps=${f.steps.length}  triggers=${triggers || '-'}`);
    }
    return;
  }

  if (cmd === 'runs') {
    const statusIdx = args.indexOf('--status');
    const status = statusIdx >= 0 ? args[statusIdx + 1] : undefined;
    const runs = listTaskFlowRuns(30).filter((r) => !status || r.status === status);
    for (const r of runs) {
      console.log(`  ${r.id.slice(0, 8)}  ${r.flowName}  ${r.status}  step=${r.stepIndex}`);
    }
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
    const prompt = promptIdx >= 0 ? args.slice(promptIdx + 1).join(' ') : 'Run scheduled task';
    const cronJobId = cronIdx >= 0 ? args[cronIdx + 1] : undefined;
    if (!name) {
      console.error('create requires a name');
      process.exitCode = 1;
      return;
    }
    const triggers = cronJobId ? [{ type: 'cron' as const, jobId: cronJobId }] : [];
    const flow = upsertTaskFlow({
      name,
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
    if (!id) {
      console.error('retry requires run id (from carina taskflows runs)');
      process.exitCode = 1;
      return;
    }
    const run = retryTaskFlowRun(id);
    if (!run) {
      console.error('Run not found or not in a failed/timed_out state');
      process.exitCode = 1;
      return;
    }
    void executeTaskFlowRun(run.id);
    console.log(`Retried as run ${run.id.slice(0, 8)} (retried from ${id.slice(0, 8)})`);
    return;
  }

  if (cmd === 'worker') {
    const started = await processQueuedTaskFlowRuns();
    console.log(`Started ${started} queued run(s)`);
    if (args.includes('--delivery')) {
      const result = await processDeliveryQueue();
      console.log(`Delivery: ${result.delivered} delivered, ${result.failed} failed`);
    }
    return;
  }

  usage();
}
