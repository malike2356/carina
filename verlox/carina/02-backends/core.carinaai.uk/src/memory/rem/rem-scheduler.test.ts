import { describe, expect, it } from 'vitest';
import { remNightlyEnabled, createRemNightlyTask } from './rem-scheduler.js';

describe('rem-scheduler', () => {
  it('creates a nightly scheduled task with defaults', () => {
    const task = createRemNightlyTask();
    expect(task.name).toBe('rem-nightly-dreams');
    expect(task.hour).toBe(3);
    expect(task.minute).toBe(0);
  });

  it('respects CARINA_REM_ENABLED=false', () => {
    const prev = process.env.CARINA_REM_ENABLED;
    process.env.CARINA_REM_ENABLED = 'false';
    expect(remNightlyEnabled()).toBe(false);
    if (prev === undefined) delete process.env.CARINA_REM_ENABLED;
    else process.env.CARINA_REM_ENABLED = prev;
  });
});
