import chalk from 'chalk';
import { listJobs, updateJob, removeJob } from '../../agents/cron-scheduler.js';
import { initDb } from '../../memory/db.js';

export async function runCronCommand(action = 'list', id?: string): Promise<void> {
  await initDb();

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
    }
    console.log('');
    return;
  }

  if (!id) {
    console.error('Usage: carina cron <list|pause|resume|remove> [job-id]');
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

  console.error('Usage: carina cron <list|pause|resume|remove> [job-id]');
  process.exit(1);
}
