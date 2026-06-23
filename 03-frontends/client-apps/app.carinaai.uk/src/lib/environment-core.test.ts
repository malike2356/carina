import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  buildDevEnvironmentStub,
  environmentCoreConfigured,
} from '@/lib/environment-core';

describe('environment-core', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports unconfigured when core proxy is disabled', () => {
    vi.stubEnv('CARINA_USE_CORE_PROXY', 'false');
    expect(environmentCoreConfigured()).toBe(false);
  });

  it('reports configured when core proxy token is present', () => {
    vi.stubEnv('CARINA_USE_CORE_PROXY', 'true');
    vi.stubEnv('CARINA_OPS_TOKEN', 'test-token');
    expect(environmentCoreConfigured()).toBe(true);
  });

  it('builds a stub summary for cloud-only mode', () => {
    const stub = buildDevEnvironmentStub();
    expect(stub.settings).toEqual([]);
    expect(stub.audit).toEqual({ ok: 0, warn: 0, fail: 0 });
    expect(stub.envExists).toBe(false);
  });
});
