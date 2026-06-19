import { describe, expect, it, vi } from 'vitest';

vi.mock('../memory/db.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../profiles/isolation.js', () => ({
  activeCronProfile: () => 'default',
}));

vi.mock('./cron-context-chain.js', () => ({
  buildCronPrompt: vi.fn(),
  runJobScript: vi.fn(),
}));

vi.mock('./cron-job-store.js', () => ({
  incrementFailureCount: vi.fn(),
  resetFailureCount: vi.fn(),
}));

vi.mock('./cron-step-runner.js', () => ({
  runCronStep: vi.fn(),
}));

vi.mock('../webhooks/dispatcher.js', () => ({
  dispatchWebhook: vi.fn(),
}));

import { parseSchedule } from './cron-scheduler.js';

describe('parseSchedule', () => {
  it('parses minute shorthand', () => {
    const result = parseSchedule('30m');
    expect(result.cronExpr).toBe('*/30 * * * *');
  });

  it('parses hour shorthand', () => {
    const result = parseSchedule('every 2h');
    expect(result.cronExpr).toBe('0 */2 * * *');
  });

  it('parses standard cron expression', () => {
    const result = parseSchedule('0 9 * * *');
    expect(result.cronExpr).toBe('0 9 * * *');
  });

  it('parses ISO timestamp as one-shot', () => {
    const result = parseSchedule('2026-12-25T09:00:00Z');
    expect(result.oneShot).toBeInstanceOf(Date);
  });

  it('rejects unknown format', () => {
    expect(() => parseSchedule('sometime later')).toThrow('Unrecognized schedule');
  });
});
