import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LabyrinthScoutClient } from '../client.js';

function makeClient(overrides: Partial<ConstructorParameters<typeof LabyrinthScoutClient>[0]> = {}) {
  return new LabyrinthScoutClient({
    url: 'http://localhost:4444',
    apiKey: 'test-key',
    instanceId: 'test-instance',
    ...overrides,
  });
}

describe('LabyrinthScoutClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('report() with Scout unreachable does not throw', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'));
    const scout = makeClient();

    await expect(
      scout.report({
        severity: 'info',
        eventType: 'test_event',
        description: 'hello',
      }),
    ).resolves.toBeUndefined();

    expect(console.warn).toHaveBeenCalled();
  });

  it('checkStatus() returns suspended=true when API says so', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ suspended: true, reason: 'policy breach' }), {
        status: 200,
      }),
    );
    const scout = makeClient();

    await expect(scout.checkStatus()).resolves.toEqual({
      suspended: true,
      reason: 'policy breach',
    });
  });

  it('checkStatus() returns suspended=false when Scout is unreachable', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'));
    const scout = makeClient();

    await expect(scout.checkStatus()).resolves.toEqual({ suspended: false });
  });

  it('startKillSwitchPolling() calls onSuspend after status changes', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ suspended: false }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ suspended: true, reason: 'test' }), { status: 200 }),
      );

    const scout = makeClient();
    const onSuspend = vi.fn();
    const stop = scout.startKillSwitchPolling(onSuspend, 1000);

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1000);

    expect(onSuspend).toHaveBeenCalledOnce();
    expect(onSuspend).toHaveBeenCalledWith('test');
    stop();
    vi.useRealTimers();
  });

  it('enabled=false disables all HTTP calls', async () => {
    const scout = makeClient({ enabled: false });
    const onSuspend = vi.fn();

    await scout.report({
      severity: 'info',
      eventType: 'test',
      description: 'x',
    });
    await scout.reportToolCall({
      toolName: 'web-search',
      params: {},
      result: {},
      durationMs: 1,
    });
    await scout.heartbeat();
    await scout.checkStatus();
    scout.startKillSwitchPolling(onSuspend);

    expect(fetch).not.toHaveBeenCalled();
    expect(onSuspend).not.toHaveBeenCalled();
  });
});
