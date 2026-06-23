import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCloudSystemPrompt } from '@/lib/cloud-identity';

const baseOpts = {
  workspaceId: 'ws-1',
  memoryBlock: '',
  enabledSkillsBlock: '',
  disabledSkillsBlock: '',
};

describe('buildCloudSystemPrompt', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('default prompt does not mention property professionals', () => {
    const prompt = buildCloudSystemPrompt(baseOpts);
    expect(prompt.toLowerCase()).not.toContain('property professionals');
    expect(prompt).toContain('horizontal agent platform');
  });

  it('with property-uk pack mentions property without excluding general abilities', () => {
    const prompt = buildCloudSystemPrompt({ ...baseOpts, activePacks: ['property-uk'] });
    expect(prompt).toContain('property-uk');
    expect(prompt).toContain('general-purpose agent');
    expect(prompt.toLowerCase()).not.toContain('property professionals only');
  });

  it('BYOK mode block states no live tools', async () => {
    vi.stubEnv('CARINA_USE_CORE_PROXY', 'false');
    vi.resetModules();
    const { buildCloudSystemPrompt: build } = await import('@/lib/cloud-identity');
    const prompt = build(baseOpts);
    expect(prompt).toContain('BYOK direct chat');
    expect(prompt).toContain('do not have live tools');
  });

  it('core-proxy mode block states tools may be available', async () => {
    vi.stubEnv('CARINA_USE_CORE_PROXY', 'true');
    vi.stubEnv('CARINA_OPS_TOKEN', 'test-token');
    vi.resetModules();
    const { buildCloudSystemPrompt: build } = await import('@/lib/cloud-identity');
    const prompt = build(baseOpts);
    expect(prompt).toContain('routes chat through the Carina core agent');
    expect(prompt).toContain('tools may be available');
  });
});
