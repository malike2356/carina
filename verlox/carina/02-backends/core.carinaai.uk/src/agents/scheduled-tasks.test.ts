import { describe, expect, it, vi } from 'vitest';
import { TaskScheduler } from './scheduled-tasks.js';

describe('TaskScheduler', () => {
  it('runs interval tasks when the interval elapses', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const scheduler = new TaskScheduler();
    scheduler.register({ name: 'check-in', intervalMinutes: 30, run });

    await scheduler.tick(new Date('2026-01-01T10:00:00Z'));
    await scheduler.tick(new Date('2026-01-01T10:29:00Z'));
    await scheduler.tick(new Date('2026-01-01T10:30:00Z'));

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('runs daily tasks once for the configured local minute', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const scheduler = new TaskScheduler();
    scheduler.register({ name: 'briefing', hour: 8, minute: 15, timezone: 'UTC', run });

    await scheduler.tick(new Date('2026-01-01T08:14:00Z'));
    await scheduler.tick(new Date('2026-01-01T08:15:00Z'));
    await scheduler.tick(new Date('2026-01-01T08:15:30Z'));
    await scheduler.tick(new Date('2026-01-02T08:15:00Z'));

    expect(run).toHaveBeenCalledTimes(2);
  });
});
