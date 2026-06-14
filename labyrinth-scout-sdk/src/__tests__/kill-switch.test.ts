import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScoutClient } from '../client.js';
import { KillSwitchWatcher } from '../kill-switch.js';

describe('KillSwitchWatcher', () => {
  let scout: ScoutClient;
  let killSwitchStatus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    killSwitchStatus = vi.fn();
    scout = { killSwitchStatus } as unknown as ScoutClient;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('start: calls onKill when status transitions to triggered=true', async () => {
    const onKill = vi.fn();
    killSwitchStatus
      .mockResolvedValueOnce({ triggered: false })
      .mockResolvedValueOnce({ triggered: true, reason: 'breach detected' });

    const watcher = new KillSwitchWatcher(scout, { instanceId: 'inst-1', onKill, pollIntervalMs: 1000 });
    watcher.start();

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(onKill).toHaveBeenCalledWith('breach detected');
  });

  it('start: calls onResume when status transitions back to triggered=false', async () => {
    const onKill = vi.fn();
    const onResume = vi.fn();
    killSwitchStatus
      .mockResolvedValueOnce({ triggered: true, reason: 'breach' })
      .mockResolvedValueOnce({ triggered: true, reason: 'breach' })
      .mockResolvedValueOnce({ triggered: false });

    const watcher = new KillSwitchWatcher(scout, {
      instanceId: 'inst-1',
      onKill,
      onResume,
      pollIntervalMs: 1000,
    });
    watcher.start();

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(onKill).toHaveBeenCalledTimes(1);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('start: does not call onKill when Scout throws (fail-safe)', async () => {
    const onKill = vi.fn();
    killSwitchStatus.mockRejectedValue(new Error('network error'));

    const watcher = new KillSwitchWatcher(scout, { instanceId: 'inst-1', onKill, pollIntervalMs: 1000 });
    watcher.start();

    await vi.advanceTimersByTimeAsync(3000);

    expect(onKill).not.toHaveBeenCalled();
  });

  it('stop: clears poll timer and stops checking', async () => {
    const onKill = vi.fn();
    killSwitchStatus.mockResolvedValue({ triggered: true, reason: 'breach' });

    const watcher = new KillSwitchWatcher(scout, { instanceId: 'inst-1', onKill, pollIntervalMs: 1000 });
    watcher.start();
    watcher.stop();

    await vi.advanceTimersByTimeAsync(5000);

    expect(killSwitchStatus).not.toHaveBeenCalled();
    expect(onKill).not.toHaveBeenCalled();
  });

  it('stop: does not call onKill after stop() even if triggered', async () => {
    const onKill = vi.fn();
    killSwitchStatus.mockResolvedValue({ triggered: true, reason: 'breach' });

    const watcher = new KillSwitchWatcher(scout, { instanceId: 'inst-1', onKill, pollIntervalMs: 1000 });
    watcher.start();
    await vi.advanceTimersByTimeAsync(1000);
    watcher.stop();
    onKill.mockClear();

    await vi.advanceTimersByTimeAsync(5000);

    expect(onKill).not.toHaveBeenCalled();
  });
});
