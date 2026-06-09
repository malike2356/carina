import { describe, expect, it } from 'vitest';
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
