import { listJobs } from '../../agents/cron-scheduler.js';
import { listProcesses } from '../../tools/process-registry.js';
import { listTaskFlowRuns, listDeliveryQueue, taskFlowsEnabled } from '../../ops/taskflows/index.js';

export async function runTasksCommand(args: string[]): Promise<void> {
  const json = args.includes('--json');
  const section = args.find((a) => !a.startsWith('--')) ?? 'all';

  const background = listProcesses().map((p) => ({
    kind: 'background-process',
    id: p.session_id,
    status: p.status,
    command: p.command,
    pid: p.pid,
    uptime: p.uptime,
    label: p.label,
    dedupe_key: p.dedupe_key,
  }));

  let cron: Array<Record<string, unknown>> = [];
  try {
    const jobs = await listJobs();
    cron = jobs.map((j) => ({
      kind: 'cron',
      id: j.id,
      status: j.status,
      name: j.name,
      schedule: j.schedule,
      nextRun: j.nextRun?.toISOString() ?? null,
    }));
  } catch {
    cron = [];
  }

  const flows = taskFlowsEnabled()
    ? listTaskFlowRuns(50).map((r) => ({
        kind: 'taskflow',
        id: r.id,
        status: r.status,
        flow: r.flowName,
        step: r.stepIndex,
      }))
    : [];

  const delivery = taskFlowsEnabled()
    ? listDeliveryQueue().map((d) => ({
        kind: 'delivery',
        id: d.id,
        status: d.status,
        channel: d.channel,
      }))
    : [];

  const payload = {
    background,
    cron,
    taskflows: flows,
    delivery,
  };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (section === 'all' || section === 'background') {
    console.log('\nBackground processes:');
    if (background.length === 0) console.log('  (none)');
    for (const p of background) {
      const label = p.label ? `  label=${p.label}` : '';
      console.log(`  ${p.id}  ${p.status}  pid=${p.pid}  uptime=${p.uptime}s${label}  ${p.command}`);
    }
  }

  if (section === 'all' || section === 'cron') {
    console.log('\nCron jobs:');
    if (cron.length === 0) console.log('  (none)');
    for (const j of cron) {
      console.log(`  ${j.id}  ${j.status}  ${j.schedule}  ${j.name ?? ''}`);
    }
  }

  if (taskFlowsEnabled() && (section === 'all' || section === 'taskflows')) {
    console.log('\nTaskFlow runs:');
    if (flows.length === 0) console.log('  (none)');
    for (const r of flows) {
      console.log(`  ${r.id}  ${r.status}  ${r.flow}`);
    }
  }

  if (taskFlowsEnabled() && (section === 'all' || section === 'delivery')) {
    console.log('\nDelivery queue:');
    if (delivery.length === 0) console.log('  (none)');
    for (const d of delivery) {
      console.log(`  ${d.id}  ${d.status}  ${d.channel}`);
    }
  }

  console.log('');
}
