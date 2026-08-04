import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../memory/store.js', () => ({
  clearSession: vi.fn().mockResolvedValue(undefined),
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

vi.mock('./scout/compliance-collector.js', () => ({
  syncAllFrameworkEvidenceToScout: vi.fn().mockResolvedValue({ frameworks: [], inserted: 0, errors: [] }),
  remediateStaleEvidenceIfNeeded: vi.fn().mockResolvedValue(0),
}));

vi.mock('./scout-client.js', () => ({
  reportEvent: vi.fn().mockResolvedValue(undefined),
}));

describe('scout protects carina (prompt 36)', () => {
  beforeEach(async () => {
    const mod = await import('./kill-switch-listener.js');
    mod._resetSuspendedFlag();
    mod._clearBlockedSessions();
    mod._clearQuarantinedTools();
    mod._clearOperatorBlockedDomains();
    mod._resetRateLimits();
    mod._resetSandboxPolicies();
  });

  it('suspend_session blocks only the target session', async () => {
    const { isSessionSuspended, isSessionBlocked, _processControlMessage } =
      await import('./kill-switch-listener.js');
    _processControlMessage(JSON.stringify({
      action: 'suspend_session',
      session_id: 'sess-a',
      instance_id: 'test-001',
      reason: 'critical threat',
    }));
    expect(isSessionSuspended('sess-a')).toBe(true);
    expect(isSessionBlocked('sess-a')).toBe(true);
    expect(isSessionBlocked('sess-b')).toBe(false);
  });

  it('graceful suspend completes after finalizeGracefulSessionSuspend', async () => {
    const {
      isSessionBlocked,
      isSessionGracefullySuspending,
      finalizeGracefulSessionSuspend,
      _processControlMessage,
    } = await import('./kill-switch-listener.js');

    _processControlMessage(JSON.stringify({
      action: 'suspend_session',
      session_id: 'sess-grace',
      instance_id: 'test-001',
      graceful: true,
      reason: 'wrap up',
    }));

    expect(isSessionGracefullySuspending('sess-grace')).toBe(true);
    expect(isSessionBlocked('sess-grace')).toBe(false);

    finalizeGracefulSessionSuspend('sess-grace');
    expect(isSessionGracefullySuspending('sess-grace')).toBe(false);
    expect(isSessionBlocked('sess-grace')).toBe(true);
  });

  it('resume_session clears suspend state', async () => {
    const { isSessionBlocked, _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(JSON.stringify({
      action: 'suspend_session',
      session_id: 'sess-a',
      instance_id: 'test-001',
      reason: 'test',
    }));
    _processControlMessage(JSON.stringify({
      action: 'resume_session',
      session_id: 'sess-a',
      instance_id: 'test-001',
    }));
    expect(isSessionBlocked('sess-a')).toBe(false);
  });

  it('checkSessionAllowed throws for suspended session', async () => {
    const { checkSessionAllowed, _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(JSON.stringify({
      action: 'suspend_session',
      session_id: 'sess-x',
      instance_id: 'test-001',
      reason: 'test',
    }));
    expect(() => checkSessionAllowed('sess-x')).toThrow(/suspended by Labyrinth Scout/);
  });
});

describe('policy-tracker', () => {
  it('bumps version when sandbox policy changes', async () => {
    const tracker = await import('./scout/policy-tracker.js');
    tracker._resetPolicyVersionForTests();
    const before = tracker.getPolicyVersionState().version;
    const { _processControlMessage } = await import('./kill-switch-listener.js');
    _processControlMessage(JSON.stringify({
      action: 'set_sandbox_policy',
      mode: 'docker_only',
      instance_id: 'test-001',
    }));
    await vi.waitFor(() => {
      expect(tracker.getPolicyVersionState().version).not.toBe(before);
    });
    expect(tracker.getPolicyVersionState().sandboxMode).toBe('docker_only');
  });
});

describe('trust onchain', () => {
  it('builds ERC-8004 identity from env', async () => {
    vi.stubEnv('CARINA_TRUST_AGENT_ID', '42');
    const { buildErc8004IdentityState } = await import('./trust/onchain/identity.js');
    const identity = buildErc8004IdentityState();
    expect(identity.registered).toBe(true);
    expect(identity.agentId).toBe('42');
    expect(identity.standard).toBe('ERC-8004');
    vi.unstubAllEnvs();
  });

  it('flags hash mismatch in ERC-8126 verification', async () => {
    const { computeCodeIntegrityHash, buildErc8126VerificationState } =
      await import('./trust/onchain/verification.js');
    vi.stubEnv('CARINA_TRUST_CODE_HASH', 'deadbeef');
    const verification = buildErc8126VerificationState();
    expect(verification.hashMatch).toBe(false);
    expect(verification.unifiedRiskTier).toBe('critical');
    expect(computeCodeIntegrityHash()).not.toBe('deadbeef');
    vi.unstubAllEnvs();
  });
});

describe('scout sync scheduler', () => {
  it('respects CARINA_SCOUT_SYNC=false', async () => {
    vi.stubEnv('SCOUT_ENABLED', 'true');
    vi.stubEnv('CARINA_SCOUT_SYNC', 'false');
    const sync = await import('./scout/scout-sync.js');
    sync._resetScoutSyncSchedulerForTests();
    expect(sync.scoutSyncEnabled()).toBe(false);
    const stop = sync.startScoutSyncScheduler();
    expect(typeof stop).toBe('function');
    stop();
    vi.unstubAllEnvs();
  });
});

describe('public trust API', () => {
  it('builds extended trust state payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
    const { buildExtendedSecurityTrustState } = await import('./trust/trust-state.js');
    const state = await buildExtendedSecurityTrustState();
    expect(state.identity.standard).toBe('ERC-8004');
    expect(state.verification.standard).toBe('ERC-8126');
    expect(state.instanceId).toBe('test-001');
    expect(state.policyVersion.version).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
