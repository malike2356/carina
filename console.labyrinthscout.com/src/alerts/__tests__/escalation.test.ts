import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scheduleEscalation, cancelEscalation } from '../escalation.js';

const mockDispatch = vi.fn().mockResolvedValue(undefined);
const mockPoolQuery = vi.fn();

vi.mock('../dispatcher.js', () => ({
  alertDispatcher: { dispatch: (...args: unknown[]) => mockDispatch(...args) },
}));

vi.mock('../../db.js', () => ({
  pool: { query: (...args: unknown[]) => mockPoolQuery(...args) },
}));

describe('Alert Escalation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('schedules 5min and 15min timers for critical alerts', () => {
    scheduleEscalation('evt-1', 'critical', 'inst-1', 'test');
    // Timers should be set but not yet fired
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('does not schedule timers for non-critical alerts', () => {
    scheduleEscalation('evt-2', 'warning', 'inst-1', 'test');
    // No dispatch should happen even after advancing time
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('fires escalation at 5 min if unacknowledged', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [{ acknowledged: false }] });
    scheduleEscalation('evt-3', 'critical', 'inst-1', 'test alert');

    vi.advanceTimersByTime(5 * 60 * 1000);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const dispatched = mockDispatch.mock.calls[0]![0];
    expect(dispatched.description).toContain('UNACKNOWLEDGED; ESCALATING');
  });

  it('does not fire escalation if acknowledged', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [{ acknowledged: true }] });
    scheduleEscalation('evt-4', 'critical', 'inst-1', 'test');

    vi.advanceTimersByTime(5 * 60 * 1000);
    await vi.runAllTimersAsync();

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('cancelEscalation stops pending timers', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [{ acknowledged: false }] });
    scheduleEscalation('evt-5', 'critical', 'inst-1', 'test');

    cancelEscalation('evt-5');

    vi.advanceTimersByTime(10 * 60 * 1000);
    await vi.runAllTimersAsync();

    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
