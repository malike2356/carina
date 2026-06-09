import type { Tool } from '../types/index.js';
import {
  createJob,
  executeJob,
  getJob,
  listJobs,
  parseSchedule,
  removeJob,
  updateJob,
} from '../agents/cron-scheduler.js';

export function createCronjobTool(sessionId: string): Tool {
  return {
    name: 'cronjob',
    description:
      'Schedule recurring tasks. Actions: create, list, update, pause, resume, remove, run. Supports cron syntax, 30m, every 2h, ISO timestamps.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'list', 'update', 'pause', 'resume', 'remove', 'run'],
        },
        job_id: { type: 'string' },
        schedule: { type: 'string', description: '30m, every 2h, 0 9 * * *, or ISO timestamp' },
        prompt: { type: 'string', description: 'Self-contained task description' },
        name: { type: 'string' },
        repeat: { type: 'number', description: 'Run count (1 = once, omit = forever)' },
        deliver: { type: 'string', description: 'origin, local, all, or telegram:chat_id' },
        script: { type: 'string', description: 'Path to .sh/.py script under data/scripts/' },
        no_agent: { type: 'boolean', description: 'Run script only, skip LLM' },
        context_from: { type: 'array', items: { type: 'string' } },
        chain_after: { type: 'array', items: { type: 'string' }, description: 'Job IDs to run after this job completes' },
        deliver_channels: { type: 'array', items: { type: 'string' }, description: 'e.g. telegram:123,discord:456' },
        enabled_toolsets: { type: 'array', items: { type: 'string' } },
        workdir: { type: 'string' },
      },
      required: ['action'],
    },
    execute: async (params) => {
      const action = String(params.action ?? '');

      if (action === 'create') {
        const schedule = String(params.schedule ?? '');
        if (!schedule) return { error: 'schedule is required for create.' };
        try {
          parseSchedule(schedule);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }

        const prompt = params.prompt ? String(params.prompt) : null;
        const script = params.script ? String(params.script) : null;
        if (!prompt && !script) {
          return { error: 'Either prompt or script is required.' };
        }

        const job = await createJob({
          name: params.name ? String(params.name) : null,
          schedule,
          prompt,
          scriptPath: script,
          noAgent: Boolean(params.no_agent),
          deliver: params.deliver_channels
            ? (params.deliver_channels as string[]).join(',')
            : (params.deliver ? String(params.deliver) : 'origin'),
          repeatCount: params.repeat != null ? Number(params.repeat) : null,
          runsRemaining: params.repeat != null ? Number(params.repeat) : null,
          contextFrom: (params.context_from as string[]) ?? [],
          chainAfter: (params.chain_after as string[]) ?? [],
          enabledToolsets: (params.enabled_toolsets as string[]) ?? [],
          workdir: params.workdir ? String(params.workdir) : null,
          originSessionId: sessionId,
        });
        return { job_id: job.id, status: job.status, schedule: job.schedule };
      }

      if (action === 'list') {
        const jobs = await listJobs();
        return {
          jobs: jobs.map((j) => ({
            job_id: j.id,
            name: j.name,
            schedule: j.schedule,
            status: j.status,
            last_run: j.lastRun,
            next_run: j.nextRun,
            deliver: j.deliver,
          })),
        };
      }

      const jobId = String(params.job_id ?? '');
      if (!jobId && action !== 'list') return { error: 'job_id is required.' };

      if (action === 'update') {
        const updated = await updateJob(jobId, {
          schedule: params.schedule ? String(params.schedule) : undefined,
          prompt: params.prompt ? String(params.prompt) : undefined,
          name: params.name ? String(params.name) : undefined,
          deliver: params.deliver ? String(params.deliver) : undefined,
        });
        return updated ? { job_id: updated.id, status: updated.status } : { error: 'Job not found.' };
      }

      if (action === 'pause') {
        const updated = await updateJob(jobId, { status: 'paused' });
        return updated ? { job_id: updated.id, status: 'paused' } : { error: 'Job not found.' };
      }

      if (action === 'resume') {
        const updated = await updateJob(jobId, { status: 'active' });
        return updated ? { job_id: updated.id, status: 'active' } : { error: 'Job not found.' };
      }

      if (action === 'remove') {
        const ok = await removeJob(jobId);
        return ok ? { job_id: jobId, status: 'removed' } : { error: 'Job not found.' };
      }

      if (action === 'run') {
        const job = await getJob(jobId);
        if (!job) return { error: 'Job not found.' };
        const output = await executeJob(jobId);
        return { job_id: jobId, output };
      }

      return { error: `Unknown action: ${action}` };
    },
  };
}
