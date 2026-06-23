import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCloudCapabilities, hasCloudCapability } from '@/lib/cloud-capabilities';

describe('getCloudCapabilities', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('BYOK mode disables core-only features', () => {
    vi.stubEnv('CARINA_USE_CORE_PROXY', 'false');
    const caps = getCloudCapabilities();
    expect(caps.chatMode).toBe('byok-direct');
    expect(caps.terminal).toBe(false);
    expect(caps.agentTools).toBe(false);
  });

  it('core-proxy mode enables operator features', () => {
    vi.stubEnv('CARINA_USE_CORE_PROXY', 'true');
    vi.stubEnv('CARINA_OPS_TOKEN', 'test-token');
    const caps = getCloudCapabilities();
    expect(caps.chatMode).toBe('core-proxy');
    expect(caps.terminal).toBe(true);
    expect(hasCloudCapability(caps, 'mcp')).toBe(true);
  });
});
