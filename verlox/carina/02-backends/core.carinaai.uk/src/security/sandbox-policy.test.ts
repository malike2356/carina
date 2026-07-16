import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setImmediate } from 'timers/promises';

vi.mock('../config/index.js', () => ({
  config: {
    labyrinth: { instanceId: 'test-001' },
    redis: { url: 'redis://localhost' },
    database: { url: 'postgresql://localhost/carina_test' },
    resend: { apiKey: '' },
    embeddings: { dimensions: 768, maxChars: 8000, voyageMaxChars: 16000, geminiModel: 'text-embedding-004', openaiModel: 'text-embedding-3-small' },
    carina: { defaultProvider: 'deepseek', activePacks: [], taskFlowsEnabled: false },
  },
}));

vi.mock('../memory/store.js', () => ({
  clearSession: vi.fn(),
}));

vi.mock('../workspaces/agent-registry.js', () => ({
  getAgentDefinition: (id: string) =>
    id === 'locked' ? { id: 'locked', sandboxMode: 'blocked' } : null,
  getActiveAgentDefinition: () => ({ id: 'main', sandboxMode: 'default' }),
}));

describe('sandbox-policy', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    const mod = await import('./kill-switch-listener.js');
    mod._resetSandboxPolicies();
    mod._processControlMessage(
      JSON.stringify({
        action: 'set_sandbox_policy',
        instance_id: 'test-001',
        mode: 'default',
      }),
    );
  });

  it('defaults to docker when direct shell is off', async () => {
    const { resolveSandboxExecution } = await import('./sandbox-policy.js');
    const result = resolveSandboxExecution('sess-1', 'shell-exec');
    expect(result.mode).toBe('docker');
  });

  it('uses host when CARINA_DIRECT_SHELL=true and policy is default', async () => {
    vi.stubEnv('CARINA_DIRECT_SHELL', 'true');
    const { resolveSandboxExecution } = await import('./sandbox-policy.js');
    const result = resolveSandboxExecution('sess-1', 'shell-exec');
    expect(result.mode).toBe('host');
  });

  it('forces docker when operator sets host_blocked', async () => {
    const ks = await import('./kill-switch-listener.js');
    ks._processControlMessage(
      JSON.stringify({
        action: 'set_sandbox_policy',
        instance_id: 'test-001',
        mode: 'host_blocked',
      }),
    );
    await setImmediate();
    vi.stubEnv('CARINA_DIRECT_SHELL', 'true');
    const { resolveSandboxExecution } = await import('./sandbox-policy.js');
    const result = resolveSandboxExecution('sess-1', 'shell-exec');
    expect(result.mode).toBe('docker');
    expect(result.policySource).toBe('operator');
  });

  it('ignores sandbox routing for non-shell tools', async () => {
    const { resolveSandboxExecution } = await import('./sandbox-policy.js');
    expect(resolveSandboxExecution('sess-1', 'web-search').mode).toBe('host');
  });

  it('uses openshell when backend env is set', async () => {
    vi.stubEnv('CARINA_SANDBOX_BACKEND', 'openshell');
    const { resolveSandboxExecution } = await import('./sandbox-policy.js');
    expect(resolveSandboxExecution('sess-1', 'shell-exec').mode).toBe('openshell');
  });

  it('honors agent sandboxMode override', async () => {
    const { resolveSandboxExecution } = await import('./sandbox-policy.js');
    const blocked = resolveSandboxExecution('sess-1', 'shell-exec', 'locked');
    expect(blocked.mode).toBe('blocked');
    expect(blocked.policySource).toBe('agent');
  });
});
