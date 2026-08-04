import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAgentOsGlassEnabled } from './agent-os-flags';

describe('isAgentOsGlassEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults on for Aiva and off for Cloud', () => {
    vi.stubEnv('NEXT_PUBLIC_AGENT_OS_GLASS', '');
    expect(isAgentOsGlassEnabled('aiva')).toBe(true);
    expect(isAgentOsGlassEnabled('cloud')).toBe(false);
  });

  it('honours explicit public flag values', () => {
    vi.stubEnv('NEXT_PUBLIC_AGENT_OS_GLASS', 'true');
    expect(isAgentOsGlassEnabled('cloud')).toBe(true);
    vi.stubEnv('NEXT_PUBLIC_AGENT_OS_GLASS', 'false');
    expect(isAgentOsGlassEnabled('aiva')).toBe(false);
  });
});
