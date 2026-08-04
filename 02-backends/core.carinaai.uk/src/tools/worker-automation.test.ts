import { describe, expect, it } from 'vitest';
import { parseSimpleDailySchedule } from './worker-automation.js';

describe('parseSimpleDailySchedule', () => {
  it('parses every day at 8am', () => {
    expect(parseSimpleDailySchedule('every day at 8am')).toEqual({ hour: 8, minute: 0 });
  });

  it('parses deliver at 8am everyday variants', () => {
    expect(parseSimpleDailySchedule('daily at 8 am')).toEqual({ hour: 8, minute: 0 });
    expect(parseSimpleDailySchedule('at 8:00 am')).toEqual({ hour: 8, minute: 0 });
  });

  it('parses 24h times', () => {
    expect(parseSimpleDailySchedule('every day at 08:30')).toEqual({ hour: 8, minute: 30 });
  });

  it('parses pm', () => {
    expect(parseSimpleDailySchedule('daily at 6pm')).toEqual({ hour: 18, minute: 0 });
  });

  it('returns null for empty or unclear text', () => {
    expect(parseSimpleDailySchedule('')).toBeNull();
    expect(parseSimpleDailySchedule('sometime next week')).toBeNull();
  });
});
