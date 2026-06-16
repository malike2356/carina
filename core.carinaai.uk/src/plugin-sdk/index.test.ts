import { describe, expect, it } from 'vitest';
import {
  PLUGIN_SDK_VERSION,
  normaliseExtensionTools,
  parseDomainRulePackFile,
  validateDomainRulePack,
  validateExtensionManifest,
} from './index.js';

describe('plugin SDK contracts', () => {
  it('exports a stable SDK version', () => {
    expect(PLUGIN_SDK_VERSION).toBe('0.2.0');
  });

  it('validates extension manifests', () => {
    const manifest = validateExtensionManifest({
      manifestVersion: 1,
      id: 'demo-ext',
      version: '1.0.0',
      name: 'Demo',
      author: 'Test',
      description: 'Demo extension',
      capabilities: ['prompts'],
      entryPoints: { prompts: 'prompts' },
    });
    expect(manifest.id).toBe('demo-ext');
  });

  it('validates domain rule packs', () => {
    const pack = validateDomainRulePack({
      id: 'custom-web',
      label: 'Custom web',
      tools: ['web-search'],
      rules: ['Always cite sources.'],
    });
    expect(pack.id).toBe('custom-web');
  });

  it('rejects rule packs without tool selectors', () => {
    expect(() => validateDomainRulePack({
      id: 'bad',
      label: 'Bad',
      rules: ['noop'],
    })).toThrow(/toolsets or tools/);
  });

  it('normalises extension tool modules', () => {
    const tools = normaliseExtensionTools({
      tools: [{
        name: 'echo',
        description: 'Echo',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ ok: true }),
      }],
    });
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('echo');
  });

  it('parses rule pack arrays from JSON files', () => {
    const packs = parseDomainRulePackFile([
      {
        id: 'pack-a',
        label: 'A',
        toolsets: ['web'],
        rules: ['one'],
      },
      {
        id: 'pack-b',
        label: 'B',
        tools: ['memory'],
        rules: ['two'],
      },
    ]);
    expect(packs).toHaveLength(2);
  });
});
