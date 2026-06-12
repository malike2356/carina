import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  buildCatalogRows,
  discoverConfiguredProviderNames,
  formatCompactCatalogLine,
  formatProviderCatalogReply,
  resolveProviderAlias,
} from './provider-catalog.js';
import { PROVIDER_MAP, providerTransportType } from './provider-registry.js';

describe('provider-catalog', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    saved.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    saved.CARINA_LOCAL_LLM_ENABLED = process.env.CARINA_LOCAL_LLM_ENABLED;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.CARINA_LOCAL_LLM_ENABLED;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('buildCatalogRows includes transport type and metadata', () => {
    const row = buildCatalogRows().find((r) => r.id === 'anthropic');
    expect(row).toBeDefined();
    expect(row!.transportType).toBe('anthropic-messages');
    expect(row!.authType).toBe('api-key');
    expect(row!.costTag).toBe('byo-key');
    expect(row!.status).toBe('active');
  });

  it('includes bedrock as experimental openai-compatible provider', () => {
    const def = PROVIDER_MAP.bedrock;
    expect(def).toBeDefined();
    expect(def.status).toBe('experimental');
    expect(providerTransportType(def)).toBe('openai-compatible');
  });

  it('discoverConfiguredProviderNames is sync and env-driven', () => {
    expect(discoverConfiguredProviderNames()).not.toContain('deepseek');
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    expect(discoverConfiguredProviderNames()).toContain('deepseek');
  });

  it('formatCompactCatalogLine is single-line and compact', () => {
    const row = buildCatalogRows().find((r) => r.id === 'ollama')!;
    const line = formatCompactCatalogLine(row);
    expect(line).toContain('ollama');
    expect(line).toContain('local');
    expect(line).toContain('openai-compatible');
    expect(line.split('\n').length).toBe(1);
  });

  it('formatProviderCatalogReply lists routable providers with header', () => {
    const reply = formatProviderCatalogReply({
      currentProvider: 'deepseek',
      currentModel: 'deepseek-chat',
      configuredNames: ['deepseek'],
    });
    expect(reply).toContain('Provider catalog');
    expect(reply).toContain('deepseek');
    expect(reply).toContain('name');
    expect(reply).toContain('transport');
    expect(reply).not.toContain('github-copilot');
  });

  it('resolveProviderAlias maps kimi to moonshot', () => {
    expect(resolveProviderAlias('kimi')).toBe('moonshot');
    expect(resolveProviderAlias('deepseek')).toBe('deepseek');
  });

  it('includeCatalogOnly adds aliases and external-cli entries', () => {
    const rows = buildCatalogRows({ includeCatalogOnly: true });
    expect(rows.some((r) => r.id === 'kimi')).toBe(true);
    expect(rows.some((r) => r.id === 'github-copilot')).toBe(true);
  });
});
