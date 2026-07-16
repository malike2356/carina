import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getCatalog, validateCatalog } from './catalog.js';
import { clearHardwareCache, getHardwareProfile } from './hardware.js';
import { recommendModels, resolveTier } from './recommender.js';
import { buildServeCommands, formatEnvBlock } from './serve.js';
import type { HardwareProfile } from './types.js';

function mockProfile(overrides: Partial<HardwareProfile> = {}): HardwareProfile {
  return {
    platform: 'linux',
    cpuCores: 4,
    ramGb: 16,
    diskFreeGb: 100,
    gpu: null,
    warnings: [],
    ...overrides,
  };
}

describe('cookbook hardware', () => {
  beforeEach(() => {
    clearHardwareCache();
  });

  it('returns a valid profile on current machine without throwing', () => {
    const profile = getHardwareProfile(true);
    expect(profile.cpuCores).toBeGreaterThan(0);
    expect(profile.ramGb).toBeGreaterThan(0);
    expect(Array.isArray(profile.warnings)).toBe(true);
  });

  it('caches profile for the session', () => {
    const first = getHardwareProfile(true);
    const second = getHardwareProfile();
    expect(second).toBe(first);
  });
});

describe('cookbook catalog', () => {
  it('has at least 40 models', () => {
    expect(getCatalog().length).toBeGreaterThanOrEqual(40);
  });

  it('has no duplicate IDs', () => {
    expect(validateCatalog()).toEqual([]);
  });

  it('entries all have valid serveVia arrays', () => {
    for (const entry of getCatalog()) {
      expect(entry.serveVia.length).toBeGreaterThan(0);
    }
  });
});

describe('cookbook recommender', () => {
  it('assigns cpu-only tier with no GPU', () => {
    const rec = recommendModels(mockProfile({ ramGb: 4, gpu: null }));
    expect(rec.tier).toBe('cpu-only');
  });

  it('returns no recommendations for 0GB VRAM and 4GB RAM when nothing fits', () => {
    const tinyProfile = mockProfile({ gpu: null, ramGb: 4 });
    const rec = recommendModels(tinyProfile);
    for (const entry of rec.recommended) {
      expect(entry.ramRequiredGb).toBeLessThanOrEqual(4 * 0.7);
      expect(entry.format).toBe('gguf');
    }
    const starved = mockProfile({ gpu: null, ramGb: 1 });
    expect(recommendModels(starved).recommended).toHaveLength(0);
  });

  it('returns only GGUF format for cpu-only tier', () => {
    const rec = recommendModels(mockProfile({ gpu: null, ramGb: 32 }));
    expect(rec.tier).toBe('cpu-only');
    expect(rec.recommended.every((e) => e.format === 'gguf')).toBe(true);
  });

  it('respects VRAM headroom (0.85 factor)', () => {
    const rec = recommendModels(mockProfile({
      gpu: { vendor: 'NVIDIA', model: 'RTX 3080', vramGb: 10 },
      ramGb: 32,
    }));
    expect(resolveTier(mockProfile({ gpu: { vendor: 'NVIDIA', model: 'x', vramGb: 10 } }))).toBe('mid-vram');
    for (const entry of rec.recommended) {
      expect(entry.vramRequiredGb).toBeLessThanOrEqual(10 * 0.85);
    }
  });

  it('returns at most 5 recommended models', () => {
    const rec = recommendModels(mockProfile({
      gpu: { vendor: 'NVIDIA', model: 'RTX 4090', vramGb: 24 },
      ramGb: 64,
    }));
    expect(rec.recommended.length).toBeLessThanOrEqual(5);
  });
});

describe('cookbook serve', () => {
  it('prints correct Ollama commands for llama-3.1-8b-q4', () => {
    const entry = getCatalog().find((e) => e.id === 'llama-3.1-8b-q4')!;
    const cmds = buildServeCommands(entry, 'ollama');
    expect(cmds.download[0]).toContain('ollama pull');
    expect(cmds.serve[0]).toContain('ollama run');
    expect(cmds.envKeys.OLLAMA_ENABLED).toBe('true');
  });

  it('prints correct llama.cpp commands without executing', () => {
    const entry = getCatalog().find((e) => e.id === 'llama-3.1-8b-q4')!;
    const cmds = buildServeCommands(entry, 'llama.cpp');
    expect(cmds.download[0]).toMatch(/^wget/);
    expect(cmds.serve[0]).toContain('./server');
    expect(cmds.envKeys.LLAMACPP_ENABLED).toBe('true');
  });

  it('includes Carina env keys', () => {
    const entry = getCatalog()[0]!;
    const env = formatEnvBlock(buildServeCommands(entry, 'ollama').envKeys);
    expect(env.some((l) => l.includes('OLLAMA_ENABLED=true'))).toBe(true);
    expect(env.some((l) => l.includes('CARINA_LOCAL_LLM_ENABLED=true'))).toBe(true);
  });
});

describe('cookbook CLI', () => {
  it('does not call any model API', async () => {
    const llmSpy = vi.fn();
    vi.doMock('../../brain/llm.js', () => ({ llm: { chat: llmSpy } }));
    const { runCookbookDefault } = await import('../cli/commands/cookbook-cli.js');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runCookbookDefault();
    expect(llmSpy).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('serve command prints commands without executing by default', async () => {
    const { runCookbookCommand } = await import('../cli/commands/cookbook-cli.js');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runCookbookCommand(['serve', 'llama-3.1-8b-q4', '--via', 'ollama']);
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('ollama pull');
    expect(output).toContain('OLLAMA_ENABLED');
    log.mockRestore();
  });
});
