import fs from 'fs/promises';
import chalk from 'chalk';
import YAML from 'yaml';
import { listJobs, parseSchedule, removeJob, updateJob, createJob } from '../../agents/cron-scheduler.js';
import { importCronYamlDocument } from '../../agents/cron-yaml-import.js';
import { searchJobRunHistory } from '../../agents/job-history.js';
import { executeWorkflow, retryWorkflowRun } from '../../agents/cron-workflow-engine.js';
import { parseWorkflowDocument } from '../../agents/cron-workflow-parser.js';
import {
  createWorkflow,
  listWorkflowRuns,
  listWorkflows,
  removeWorkflow,
  updateWorkflow,
} from '../../agents/cron-workflow-store.js';
import {
  registerWorkflow,
  unregisterWorkflow,
} from '../../agents/cron-workflow-scheduler.js';
import { initDb } from '../../memory/db.js';

function workflowUsage(): void {
  console.log(`Usage: carina cron workflow <command>

Commands:
  list                         List workflows
  show <workflow-id>           Show workflow definition
  import <file.yaml>           Import workflow from YAML
  run <workflow-id>            Execute workflow now
  runs <workflow-id>           List recent runs
  retry <run-id>               Retry a failed run
  pause <workflow-id>          Pause scheduled workflow
  resume <workflow-id>         Resume workflow schedule
  remove <workflow-id>         Soft-delete workflow

See instructions/operations/CRON_WORKFLOWS.md for the declarative format.
`);
}

export async function runCronWorkflowCommand(args: string[]): Promise<void> {
  await initDb();
  const cmd = args[0] ?? 'list';

  if (cmd === 'help' || cmd === '--help') {
    workflowUsage();
    return;
  }

  if (cmd === 'list') {
    const rows = await listWorkflows();
    if (rows.length === 0) {
      console.log('No workflows.');
      return;
    }
    console.log(chalk.bold('\nCron workflows\n'));
    for (const wf of rows) {
      const status = wf.status === 'active' ? chalk.green(wf.status) : chalk.yellow(wf.status);
      console.log(`  ${wf.id.slice(0, 8)}  ${status}  ${wf.schedule.padEnd(14)}  ${wf.name}  steps=${wf.definition.steps.length}`);
    }
    console.log('');
    return;
  }

  if (cmd === 'import') {
    const file = args[1];
    if (!file) {
      console.error('Usage: carina cron workflow import <file.yaml>');
      process.exit(1);
    }
    const raw = await fs.readFile(file, 'utf8');
    const full = YAML.parse(raw) as Record<string, unknown>;
    const parsed = parseWorkflowDocument(full);
    const name = String(full.name ?? file.split('/').pop());
    const schedule = String(full.schedule ?? '');
    if (!schedule) {
      console.error('Workflow file must include schedule.');
      process.exit(1);
    }
    parseSchedule(schedule);
    const wf = await createWorkflow({
      name,
      schedule,
      definition: parsed,
      deliver: full.deliver ? String(full.deliver) : 'origin',
      deliverChannels: Array.isArray(full.deliver_channels)
        ? full.deliver_channels.map(String)
        : [],
      workdir: full.workdir ? String(full.workdir) : null,
    });
    registerWorkflow(wf);
    console.log(chalk.green(`Imported workflow ${wf.id} (${wf.name})`));
    return;
  }

  const id = args[1];
  if (!id && cmd !== 'import') {
    workflowUsage();
    process.exit(1);
  }

  if (cmd === 'show') {
    const wf = (await listWorkflows()).find((w) => w.id === id || w.id.startsWith(id));
    if (!wf) {
      console.error(`Workflow not found: ${id}`);
      process.exit(1);
    }
    console.log(JSON.stringify(wf, null, 2));
    return;
  }

  if (cmd === 'run') {
    const wf = (await listWorkflows()).find((w) => w.id === id || w.id.startsWith(id));
    if (!wf) {
      console.error(`Workflow not found: ${id}`);
      process.exit(1);
    }
    const result = await executeWorkflow(wf.id);
    console.log(`Run ${result.runId} -> ${result.status}`);
    if (result.error) console.log(chalk.red(result.error));
    else console.log(result.output.slice(0, 500));
    return;
  }

  if (cmd === 'runs') {
    const wf = (await listWorkflows()).find((w) => w.id === id || w.id.startsWith(id));
    if (!wf) {
      console.error(`Workflow not found: ${id}`);
      process.exit(1);
    }
    const runs = await listWorkflowRuns(wf.id, 20);
    for (const run of runs) {
      console.log(`  ${run.id.slice(0, 8)}  ${run.status}  step=${run.currentStepId ?? '-'}  ${run.error ?? ''}`);
    }
    return;
  }

  if (cmd === 'retry') {
    const result = await retryWorkflowRun(id);
    console.log(`Retry ${result.runId} -> ${result.status}`);
    return;
  }

  if (cmd === 'pause') {
    const wf = (await listWorkflows()).find((w) => w.id === id || w.id.startsWith(id));
    if (!wf) {
      console.error(`Workflow not found: ${id}`);
      process.exit(1);
    }
    unregisterWorkflow(wf.id);
    await updateWorkflow(wf.id, { status: 'paused' });
    console.log(`Paused ${wf.id}`);
    return;
  }

  if (cmd === 'resume') {
    const wf = (await listWorkflows()).find((w) => w.id === id || w.id.startsWith(id));
    if (!wf) {
      console.error(`Workflow not found: ${id}`);
      process.exit(1);
    }
    const updated = await updateWorkflow(wf.id, { status: 'active' });
    if (updated) registerWorkflow(updated);
    console.log(`Resumed ${wf.id}`);
    return;
  }

  if (cmd === 'remove') {
    const wf = (await listWorkflows()).find((w) => w.id === id || w.id.startsWith(id));
    if (!wf) {
      console.error(`Workflow not found: ${id}`);
      process.exit(1);
    }
    unregisterWorkflow(wf.id);
    await removeWorkflow(wf.id);
    console.log(`Removed ${wf.id}`);
    return;
  }

  workflowUsage();
  process.exit(1);
}

export async function runCronCommand(action = 'list', id?: string, extra: string[] = []): Promise<void> {
  if (action === 'workflow') {
    await runCronWorkflowCommand(extra);
    return;
  }

  await initDb();

  if (action === 'history') {
    const query = extra.join(' ').trim() || id;
    if (!query) {
      console.error('Usage: carina cron history <search-text>');
      process.exit(1);
    }
    const rows = await searchJobRunHistory(query, { limit: 25 });
    if (rows.length === 0) {
      console.log('No matching job runs.');
      return;
    }
    for (const row of rows) {
      const snippet = row.output.slice(0, 100).replace(/\s+/g, ' ');
      console.log(`  ${row.id.slice(0, 8)}  ${row.jobName ?? row.jobId.slice(0, 8)}  ${row.success ? 'ok' : 'fail'}  ${snippet}`);
    }
    return;
  }

  if (action === 'import') {
    const file = extra[0] ?? id;
    if (!file) {
      console.error('Usage: carina cron import <file.yaml>');
      process.exit(1);
    }
    const raw = await fs.readFile(file, 'utf8');
    const doc = YAML.parse(raw);
    const ids = await importCronYamlDocument(doc);
    console.log(chalk.green(`Imported ${ids.length} cron job(s).`));
    for (const jobId of ids) {
      console.log(chalk.gray(`  ${jobId.slice(0, 8)}`));
    }
    return;
  }

  if (action === 'list') {
    const jobs = await listJobs();
    if (jobs.length === 0) {
      console.log('No scheduled jobs.');
      return;
    }
    console.log(chalk.bold('\nScheduled jobs\n'));
    for (const j of jobs) {
      const status = j.status === 'active' ? chalk.green(j.status) : chalk.yellow(j.status);
      console.log(`  ${j.id.slice(0, 8)}  ${status}  ${j.schedule.padEnd(16)}  ${j.name ?? '(unnamed)'}`);
      if (j.prompt) console.log(chalk.gray(`           prompt: ${j.prompt.slice(0, 60)}`));
      if (j.deliver) console.log(chalk.gray(`           deliver: ${j.deliver}`));
      if (j.chainAfter.length > 0) console.log(chalk.gray(`           chain_after: ${j.chainAfter.join(', ')}`));
    }
    console.log(chalk.gray('\nCreate: carina cron add --schedule "0 9 * * *" --prompt "..." --name daily\n'));
    return;
  }

  if (action === 'add') {
    const scheduleFlag = extra.find((a) => a.startsWith('--schedule='))?.split('=').slice(1).join('=')
      ?? extra[0];
    const promptFlag = extra.find((a) => a.startsWith('--prompt='))?.split('=').slice(1).join('=')
      ?? extra[1];
    const nameFlag = extra.find((a) => a.startsWith('--name='))?.split('=')[1]
      ?? 'scheduled-task';
    const deliverFlag = extra.find((a) => a.startsWith('--deliver='))?.split('=')[1]
      ?? 'origin';

    if (!scheduleFlag || !promptFlag) {
      console.error('Usage: carina cron add --schedule "<expr>" --prompt "<text>" [--name label] [--deliver origin|local|all]');
      process.exit(1);
    }

    try {
      parseSchedule(scheduleFlag);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    const job = await createJob({
      name: nameFlag,
      schedule: scheduleFlag,
      prompt: promptFlag,
      scriptPath: null,
      scriptConfig: null,
      noAgent: false,
      deliver: deliverFlag,
      repeatCount: null,
      runsRemaining: null,
      contextFrom: [],
      chainAfter: [],
      enabledToolsets: [],
      workdir: null,
      originSessionId: null,
      originChannel: null,
      originConversationId: null,
      originThreadId: null,
      deliverChannels: [],
      profileName: 'default',
      modelProvider: null,
      modelName: null,
      failureLimit: 3,
      failureCount: 0,
    });
    console.log(chalk.green(`Created cron job ${job.id.slice(0, 8)} (${job.name ?? 'unnamed'})`));
    console.log(chalk.gray(`  schedule: ${job.schedule}`));
    console.log(chalk.gray(`  deliver: ${job.deliver}`));
    return;
  }

  if (!id) {
    console.error('Usage: carina cron <list|add|import|pause|resume|remove|history|workflow> [job-id]');
    process.exit(1);
  }

  if (action === 'pause') {
    const job = await updateJob(id, { status: 'paused' });
    console.log(job ? `Paused ${id}` : `Job not found: ${id}`);
    return;
  }

  if (action === 'resume') {
    const job = await updateJob(id, { status: 'active' });
    console.log(job ? `Resumed ${id}` : `Job not found: ${id}`);
    return;
  }

  if (action === 'remove') {
    const ok = await removeJob(id);
    console.log(ok ? `Removed ${id}` : `Job not found: ${id}`);
    return;
  }

  console.error('Usage: carina cron <list|add|pause|resume|remove|history|workflow> [job-id]');
  process.exit(1);
}