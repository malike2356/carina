import { afterEach, describe, expect, it, vi } from 'vitest';

const reportEvent = vi.fn().mockResolvedValue(undefined);
const clearSessionMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../memory/store.js', () => ({
  clearSession: (...args: unknown[]) => clearSessionMock(...args),
}));

vi.mock('../config/index.js', () => ({
  config: {
    labyrinth: {
      enabled: true,
      instanceId: 'test-001',
      instanceName: 'Test',
      url: 'http://localhost:4444',
      apiKey: 'test-key',
    },
    scout: { mode: 'colocated', endpoint: '', enabled: true },
    redis: { url: 'redis://localhost:6379' },
  },
}));

vi.mock('./load-scout-package.js', () => ({
  importScoutPackage: vi.fn().mockResolvedValue({ reportEvent }),
  scoutIntegrationRequested: () => true,
}));

vi.mock('../admin/scout-signal-cache.js', () => ({
  insertScoutSignalCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../billing/platform-event-emitter.js', () => ({
  emitPlatformEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./scout/investigation-engine.js', () => ({
  runInvestigation: vi.fn().mockResolvedValue({
    reportId: 'inv-1',
    verdict: 'suspicious',
    sessionId: 'sess-abc',
  }),
}));

describe('scout mutual architecture (prompt 34)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('resolveScoutMode defaults to colocated', async () => {
    vi.stubEnv('SCOUT_ENABLED', 'true');
    const { resolveScoutMode } = await import('./scout-mode.js');
    expect(resolveScoutMode()).toBe('colocated');
  });

  it('resolveScoutMode honours carina_only', async () => {
    vi.stubEnv('SCOUT_MODE', 'carina_only');
    const { resolveScoutMode, isScoutMutualIntegrationActive } = await import('./scout-mode.js');
    expect(resolveScoutMode()).toBe('carina_only');
    expect(isScoutMutualIntegrationActive()).toBe(false);
  });

  it('reportScoutSignal is a no-op when scout integration inactive', async () => {
    vi.stubEnv('SCOUT_MODE', 'carina_only');
    const { reportScoutSignal } = await import('./scout-client.js');
    await reportScoutSignal({
      signal_id: 'sig-1',
      timestamp: new Date().toISOString(),
      agent_id: 'carina:test',
      category: 'threat_analysis',
      action: 'test',
      target: 'session-1',
      details: {},
    });
    expect(reportEvent).not.toHaveBeenCalled();
  });

  it('reportScoutSignal maps threat_analysis to reportEvent', async () => {
    vi.stubEnv('SCOUT_ENABLED', 'true');
    const { reportScoutSignal } = await import('./scout-client.js');
    await reportScoutSignal({
      signal_id: 'sig-2',
      timestamp: new Date().toISOString(),
      agent_id: 'carina:test-001',
      category: 'threat_analysis',
      action: 'threat_analysis_queued',
      target: 'threat-9',
      details: { status: 'queued' },
      threat_score: 88,
    });
    expect(reportEvent).toHaveBeenCalledOnce();
    const event = reportEvent.mock.calls[0][0];
    expect(event.event_type).toBe('threat_analysis');
    expect(event.metadata?.threat_score).toBe(88);
  });

  it('investigate_session command runs investigation engine', async () => {
    vi.stubEnv('SCOUT_ENABLED', 'true');
    const { applyAgenticScoutCommand, _resetScoutHoneypotActivation } =
      await import('./scout-command-handlers.js');
    _resetScoutHoneypotActivation();
    const handled = await applyAgenticScoutCommand({
      action: 'investigate_session',
      instance_id: 'test-001',
      session_id: 'sess-abc',
      reason: 'anomaly cluster',
    });
    expect(handled).toBe(true);
  });

  it('activate_honeypots sets local activation flag', async () => {
    vi.stubEnv('SCOUT_ENABLED', 'true');
    const {
      applyAgenticScoutCommand,
      areScoutHoneypotsActivated,
      _resetScoutHoneypotActivation,
    } = await import('./scout-command-handlers.js');
    _resetScoutHoneypotActivation();
    expect(areScoutHoneypotsActivated()).toBe(false);
    await applyAgenticScoutCommand({
      action: 'activate_honeypots',
      instance_id: 'test-001',
    });
    expect(areScoutHoneypotsActivated()).toBe(true);
  });

  it('kill-switch suspend still works alongside agentic commands', async () => {
    const mod = await import('./kill-switch-listener.js');
    mod._resetSuspendedFlag();
    mod._processControlMessage(
      JSON.stringify({ action: 'suspend', instance_id: 'test-001', reason: 'test' }),
    );
    expect(mod.isSuspended()).toBe(true);
  });

  it('initScoutListener is no-op when mode is carina_only', async () => {
    vi.stubEnv('SCOUT_MODE', 'carina_only');
    const { initScoutListener } = await import('./scout-listener.js');
    const cleanup = initScoutListener();
    expect(typeof cleanup).toBe('function');
    cleanup();
  });
});
