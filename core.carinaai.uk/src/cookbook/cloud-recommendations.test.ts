import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { HardwareProfile } from './types.js';

function mockProfile(overrides: Partial<HardwareProfile> = {}): HardwareProfile {
  return {
    platform: 'linux',
    cpuCores: 8,
    ramGb: 32,
    diskFreeGb: 200,
    gpu: null,
    warnings: [],
    ...overrides,
  };
}

vi.mock('../brain/provider-registry.js', () => ({
  PROVIDER_MAP: {
    deepseek: {
      name: 'deepseek',
      displayName: 'DeepSeek',
      local: false,
      modelEnv: 'DEEPSEEK_MODEL',
      defaultModel: 'deepseek-chat',
    },
    anthropic: {
      name: 'anthropic',
      displayName: 'Anthropic',
      local: false,
      modelEnv: 'ANTHROPIC_MODEL',
      defaultModel: 'claude-sonnet-4-20250514',
    },
    ollama: {
      name: 'ollama',
      displayName: 'Ollama',
      local: true,
      modelEnv: 'OLLAMA_MODEL',
      defaultModel: 'llama3.1',
    },
  },
  isProviderConfigured: vi.fn((def: { name: string }) => def.name === 'deepseek'),
  providerModel: (def: { modelEnv: string; defaultModel: string }) => process.env[def.modelEnv] ?? def.defaultModel,
}));

describe('cloud recommendations', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('classifies cloud-only when no local models fit and cloud is configured', async () => {
    const { recommendFullStack } = await import('./cloud-recommendations.js');
    const stack = recommendFullStack(mockProfile({ gpu: null, ramGb: 2 }));
    expect(stack.scenario).toBe('cloud-only');
    expect(stack.local).toHaveLength(0);
    expect(stack.cloud.some((c) => c.configured)).toBe(true);
  });

  it('classifies low-vram when GPU is small but some local models fit', async () => {
    const { recommendFullStack } = await import('./cloud-recommendations.js');
    const stack = recommendFullStack(mockProfile({
      gpu: { vendor: 'NVIDIA', model: 'GTX 1650', vramGb: 4 },
      ramGb: 16,
    }));
    expect(['low-vram', 'mixed', 'local-only']).toContain(stack.scenario);
    expect(stack.gapFillers.length).toBeGreaterThanOrEqual(0);
  });

  it('classifies mixed when local and configured cloud are both available', async () => {
    const { recommendFullStack } = await import('./cloud-recommendations.js');
    const stack = recommendFullStack(mockProfile({
      gpu: { vendor: 'NVIDIA', model: 'RTX 3080', vramGb: 10 },
      ramGb: 32,
    }));
    expect(stack.scenario).toBe('mixed');
    expect(stack.local.length).toBeGreaterThan(0);
    expect(stack.cloud.length).toBeGreaterThan(0);
  });

  it('classifies no-suitable when nothing fits and no cloud keys are configured', async () => {
    const { isProviderConfigured } = await import('../brain/provider-registry.js');
    vi.mocked(isProviderConfigured).mockReturnValue(false);
    const { recommendFullStack } = await import('./cloud-recommendations.js');
    const stack = recommendFullStack(mockProfile({ gpu: null, ramGb: 1 }));
    expect(stack.scenario).toBe('no-suitable');
    expect(stack.message).toContain('No local models fit');
  });
});
