# Cursor Task: Fix and test cronjob (#22) tool in Carina

## Context

Carina is a Node.js/TypeScript autonomous AI agent at:
`/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/`

We are hardening the 27 Hermes tools one by one. This task covers tool #22:
`cronjob`.

Read these files in full before touching anything:
- `src/tools/cronjob.ts` (the only file to change)
- `src/agents/cron-scheduler.ts` (read only - understand what each function can throw)
- `src/agents/cron-delivery-registry.ts` (read only)
- `src/tools/cronjob.test.ts` (existing tests - do not remove any)

Do NOT modify `cron-scheduler.ts`, `cron-delivery-registry.ts`, or any other file
besides `src/tools/cronjob.ts` and `src/tools/cronjob.test.ts`.

---

## Bug: `run` action propagates unhandled errors

In the `run` branch of `execute`:

```typescript
if (action === 'run') {
  const job = await getJob(jobId);
  if (!job) return { error: 'Job not found.' };
  const output = await executeJob(jobId);   // throws on script error, agent failure, workdir issue
  return { job_id: jobId, output };
}
```

`executeJob` can throw for many reasons: script path blocked, script non-zero exit,
workdir resolution failure, agent crash, DB error. There is no try/catch so the
error propagates as an unhandled rejection from `execute` instead of returning
`{ error: string }`.

The same problem applies to `listJobs`, `updateJob`, and `removeJob` - all can
throw on DB connection failures.

### Fix: wrap each action's async calls in try/catch

For the `run` action:

```typescript
if (action === 'run') {
  const job = await getJob(jobId);
  if (!job) return { error: 'Job not found.' };
  try {
    const output = await executeJob(jobId);
    return { job_id: jobId, output };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
```

For the `list` action:

```typescript
if (action === 'list') {
  try {
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
        deliver_channels: j.deliverChannels,
        no_agent: j.noAgent,
        context_from: j.contextFrom,
        chain_after: j.chainAfter,
        workdir: j.workdir,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
```

For `update`, `pause`, `resume`, and `remove`: wrap the `updateJob` / `removeJob`
call in each branch with try/catch returning `{ error: string }`.

The `create` action already has a try/catch around `parseSchedule`. Wrap the
`createJob(...)` call itself in its own additional try/catch:

```typescript
try {
  const job = await createJob({ ... });
  return { job_id: job.id, status: job.status, schedule: job.schedule };
} catch (err) {
  return { error: err instanceof Error ? err.message : String(err) };
}
```

---

## Improvement: update the description

Replace the current description with:

```
'Schedule recurring tasks. Jobs persist in PostgreSQL and survive restarts. Actions: create - new job (schedule required); list - all active jobs; update - change schedule, prompt, or delivery; pause/resume - toggle without deleting; remove - soft-delete; run - execute immediately and return output. Schedule formats: 30m, every 2h, 0 9 * * * (cron), or ISO timestamp for one-shot. Modes: prompt only (agent runs the task), script only (no_agent=true, script path under data/scripts/, stdout delivered verbatim), or both (script runs first, agent gets stdout as context). deliver: origin = reply to the session that created the job, local = use deliver_channels only, all = both. context_from: inject previous job outputs as context. chain_after: run listed job IDs sequentially when this job finishes.'
```

---

## Tests to ADD in `src/tools/cronjob.test.ts`

Do not remove the 3 existing tests. Add the following. The mock setup at the top of
the file already provides all the mocks needed - reuse them.

**Test: create returns error when schedule is missing**

```typescript
it('returns error when schedule is missing on create', async () => {
  const tool = createCronjobTool('sess-1');
  const result = await tool.execute({ action: 'create', prompt: 'do something' });
  expect(result).toEqual({ error: 'schedule is required for create.' });
});
```

**Test: create returns error when parseSchedule throws**

```typescript
it('returns error when schedule format is invalid', async () => {
  parseSchedule.mockImplementation(() => { throw new Error('Unrecognized schedule format: bad-schedule'); });
  const tool = createCronjobTool('sess-1');
  const result = await tool.execute({
    action: 'create',
    schedule: 'bad-schedule',
    prompt: 'do something',
  }) as { error?: string };
  expect(result.error).toContain('Unrecognized schedule format');
});
```

**Test: list returns jobs array**

```typescript
it('list returns mapped jobs array', async () => {
  listJobs.mockResolvedValue([{
    id: 'job-1', name: 'daily', schedule: '0 9 * * *', status: 'active',
    lastRun: null, nextRun: null, deliver: 'origin', deliverChannels: [],
    noAgent: false, contextFrom: [], chainAfter: [], workdir: null,
  }]);
  const tool = createCronjobTool('sess-1');
  const result = await tool.execute({ action: 'list' }) as { jobs: unknown[] };
  expect(result.jobs).toHaveLength(1);
  expect((result.jobs[0] as Record<string, unknown>).job_id).toBe('job-1');
});
```

**Test: list returns error when DB throws**

```typescript
it('list returns error when DB throws', async () => {
  listJobs.mockRejectedValue(new Error('connection refused'));
  const tool = createCronjobTool('sess-1');
  const result = await tool.execute({ action: 'list' }) as { error?: string };
  expect(result.error).toContain('connection refused');
});
```

**Test: run calls executeJob and returns output**

```typescript
it('run calls executeJob and returns output', async () => {
  getJob.mockResolvedValue({ id: 'job-1', status: 'active', name: 'test' });
  executeJob.mockResolvedValue('script ran ok');
  const tool = createCronjobTool('sess-1');
  const result = await tool.execute({ action: 'run', job_id: 'job-1' }) as { output?: string };
  expect(executeJob).toHaveBeenCalledWith('job-1');
  expect(result.output).toBe('script ran ok');
});
```

**Test: run returns error when executeJob throws**

```typescript
it('run returns error when executeJob throws', async () => {
  getJob.mockResolvedValue({ id: 'job-1', status: 'active' });
  executeJob.mockRejectedValue(new Error('Script exited with code 1: permission denied'));
  const tool = createCronjobTool('sess-1');
  const result = await tool.execute({ action: 'run', job_id: 'job-1' }) as { error?: string };
  expect(result.error).toContain('Script exited');
});
```

**Test: missing job_id returns error for non-list actions**

```typescript
it('returns error when job_id is missing for remove', async () => {
  const tool = createCronjobTool('sess-1');
  const result = await tool.execute({ action: 'remove' }) as { error?: string };
  expect(result.error).toContain('job_id');
});
```

**Test: remove returns removed status**

```typescript
it('remove returns removed status', async () => {
  removeJob.mockResolvedValue(true);
  const tool = createCronjobTool('sess-1');
  const result = await tool.execute({ action: 'remove', job_id: 'job-1' }) as { status?: string };
  expect(result.status).toBe('removed');
});
```

**Test: pause returns paused status**

```typescript
it('pause returns paused status', async () => {
  updateJob.mockResolvedValue({ id: 'job-1', status: 'paused' });
  const tool = createCronjobTool('sess-1');
  const result = await tool.execute({ action: 'pause', job_id: 'job-1' }) as { status?: string };
  expect(result.status).toBe('paused');
});
```

---

## What NOT to change

- Do not change `cron-scheduler.ts` or `cron-delivery-registry.ts`.
- Do not change `dangerous: true`, `requiresConfirmation: true`, or the parameter schema.
- Do not change `resolveDeliverMode` or `resolveDeliverChannels`.
- Do not remove any existing tests.
- Do not change `parseSchedule` mock behavior in `beforeEach` (tests that need
  different behavior set it within the test itself).

---

## General rules

- TypeScript only. No `any` unless unavoidable.
- No em dashes, no emojis anywhere.
- Run `npx tsc --noEmit` after changes and fix all errors before moving on.
- Do not touch files not listed in this prompt.

---

## Verification checklist

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx vitest run src/tools/cronjob.test.ts` - all pass (3 existing + 9 new = 12)
- [ ] In `cronjob.ts`, every action that calls an async scheduler function is wrapped in try/catch returning `{ error: string }`
- [ ] Description updated in `createCronjobTool`
- [ ] Regression: `npx vitest run src/tools/shell.test.ts src/tools/file.test.ts src/tools/patch.test.ts src/tools/search-files.test.ts src/tools/process.test.ts src/tools/delegate-task.test.ts src/tools/code.test.ts src/tools/browser/session.test.ts` - all pass
