import { describe, expect, it } from 'vitest';
import {
  defaultContactsSyncSchedule,
  isContactsSyncDue,
} from './contacts-sync-schedule-store.js';

describe('contacts sync schedule due check', () => {
  it('is due when never run', () => {
    const schedule = defaultContactsSyncSchedule('00000000-0000-4000-8000-000000000001');
    expect(isContactsSyncDue(schedule)).toBe(true);
  });

  it('is not due within the interval for 1x/day', () => {
    const schedule = {
      ...defaultContactsSyncSchedule('00000000-0000-4000-8000-000000000001'),
      lastRunAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      timesPerDay: 1,
    };
    expect(isContactsSyncDue(schedule)).toBe(false);
  });

  it('is due after the interval for 2x/day', () => {
    const schedule = {
      ...defaultContactsSyncSchedule('00000000-0000-4000-8000-000000000001'),
      lastRunAt: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(),
      timesPerDay: 2,
    };
    expect(isContactsSyncDue(schedule)).toBe(true);
  });

  it('respects disabled flag', () => {
    const schedule = {
      ...defaultContactsSyncSchedule('00000000-0000-4000-8000-000000000001'),
      enabled: false,
      lastRunAt: null,
    };
    expect(isContactsSyncDue(schedule)).toBe(false);
  });
});
