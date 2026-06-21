import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const queryMock = vi.fn().mockResolvedValue({ rows: [] });

vi.mock('../../db.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

const { MovingTarget } = await import('../moving-target.js');
const { startRotationScheduler, stopRotationScheduler } = await import('../rotation-scheduler.js');

describe('RotationScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopRotationScheduler();
  });

  afterEach(() => {
    stopRotationScheduler();
    vi.useRealTimers();
  });

  it('fires marker rotation at the configured interval', () => {
    // Use a new instance so we can spy on rotateMarker
    const mt = new MovingTarget({ marker_interval_minutes: 1 });
    const spy = vi.spyOn(mt, 'rotateMarker');

    startRotationScheduler({ marker_interval_minutes: 1 }, mt);

    // Advance by 1 minute (60,000 ms)
    vi.advanceTimersByTime(60_000);

    expect(spy).toHaveBeenCalledTimes(1);

    // Advance another minute
    vi.advanceTimersByTime(60_000);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('fires tool-name rotation at the configured interval', () => {
    const mt = new MovingTarget({ tool_name_rotation_minutes: 5 });
    const spy = vi.spyOn(mt, 'rotateToolNames');

    startRotationScheduler({ marker_interval_minutes: 1, tool_name_rotation_minutes: 5 }, mt);

    vi.advanceTimersByTime(5 * 60_000);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('stopRotationScheduler stops all timers', () => {
    const mt = new MovingTarget({ marker_interval_minutes: 1 });
    const spy = vi.spyOn(mt, 'rotateMarker');

    startRotationScheduler({ marker_interval_minutes: 1 }, mt);
    stopRotationScheduler();

    vi.advanceTimersByTime(120_000);
    expect(spy).not.toHaveBeenCalled();
  });
});
