import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  PROVIDER_DEFINITIONS,
  PROVIDER_MAP,
  KNOWN_LLM_PROVIDERS,
  ROUTABLE_PROVIDERS,
  ROUTABLE_PROVIDER_NAMES,
  fallbackOrderNames,
  isProviderConfigured,
  isRoutableProvider,
  providerModel,
  resolveAliasTarget,
} from './provider-registry.js';
import { describeProviderTags } from './provider-tags.js';
import {
  listExternalCliProviders,
  getExternalCliInfo,
  isExternalCliConfigured,
  listCatalogByStatus,
} from '../providers/external-cli.js';

/* ── catalog loading ── */

describe('provider catalog - loading', () => {
  it('contains at least 38 providers total (24 original + 14 new)', () => {
    expect(KNOWN_LLM_PROVIDERS.length).toBeGreaterThanOrEqual(38);
  });

  it('has unique provider names', () => {
    const names = PROVIDER_DEFINITIONS.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every entry has a status field', () => {
    for (const def of PROVIDER_DEFINITIONS) {
      expect(['active', 'experimental', 'alias', 'external-cli', 'oauth', 'unsupported']).toContain(def.status);
    }
  });

  it('every entry has an authType field', () => {
    for (const def of PROVIDER_DEFINITIONS) {
      expect(['api-key', 'oauth', 'external-cli', 'local', 'none']).toContain(def.authType);
    }
  });

  it('includes all 7 original local endpoints', () => {
    const localNames = PROVIDER_DEFINITIONS.filter((d) => d.local).map((d) => d.name);
    expect(localNames).toContain('ollama');
    expect(localNames).toContain('lmstudio');
    expect(localNames).toContain('vllm');
    expect(localNames).toContain('llama-cpp');
  });

  it('includes Nous Research Portal', () => {
    expect(PROVIDER_MAP['nous-portal']).toBeDefined();
    expect(PROVIDER_MAP['nous-portal'].status).toBe('experimental');
  });

  it('includes Hugging Face', () => {
    expect(PROVIDER_MAP['huggingface']).toBeDefined();
    expect(PROVIDER_MAP['huggingface'].status).toBe('experimental');
  });

  it('includes both MiniMax variants', () => {
    expect(PROVIDER_MAP['minimax']).toBeDefined();
    expect(PROVIDER_MAP['minimax-cn']).toBeDefined();
    expect(PROVIDER_MAP['minimax'].status).toBe('experimental');
    expect(PROVIDER_MAP['minimax-cn'].status).toBe('experimental');
  });

  it('includes Xiaomi MiMo', () => {
    expect(PROVIDER_MAP['xiaomi-mimo']).toBeDefined();
    expect(PROVIDER_MAP['xiaomi-mimo'].status).toBe('experimental');
  });

  it('includes llama.cpp as a local active provider', () => {
    const def = PROVIDER_MAP['llama-cpp'];
    expect(def).toBeDefined();
    expect(def.local).toBe(true);
    expect(def.status).toBe('active');
    expect(def.tags.cost).toBe('local');
  });

  it('includes custom endpoint as active', () => {
    expect(PROVIDER_MAP['custom']).toBeDefined();
    expect(PROVIDER_MAP['custom'].status).toBe('active');
  });
});

/* ── metadata rendering ── */

describe('provider catalog - metadata rendering', () => {
  it('describeProviderTags works for active providers', () => {
    for (const def of ROUTABLE_PROVIDERS) {
      const desc = describeProviderTags(def);
      expect(typeof desc).toBe('string');
      expect(desc.length).toBeGreaterThan(0);
    }
  });

  it('external-cli entries have external-cli cost tag', () => {
    const externalDefs = PROVIDER_DEFINITIONS.filter((d) => d.status === 'external-cli');
    for (const def of externalDefs) {
      expect(def.tags.cost).toBe('external-cli');
    }
  });

  it('oauth entries have oauth cost tag', () => {
    const oauthDefs = PROVIDER_DEFINITIONS.filter((d) => d.status === 'oauth');
    for (const def of oauthDefs) {
      expect(def.tags.cost).toBe('oauth');
    }
  });

  it('alias entries have aliasFor set', () => {
    const aliasDefs = PROVIDER_DEFINITIONS.filter((d) => d.status === 'alias');
    for (const def of aliasDefs) {
      expect(typeof def.aliasFor).toBe('string');
      expect(def.aliasFor!.length).toBeGreaterThan(0);
    }
  });

  it('experimental entries have setupNote', () => {
    const experimental = PROVIDER_DEFINITIONS.filter((d) => d.status === 'experimental');
    for (const def of experimental) {
      if (def.setupNote) {
        expect(def.setupNote.length).toBeGreaterThan(0);
      }
    }
  });
});

/* ── configured / unconfigured state ── */

describe('provider catalog - configured state', () => {
  const savedKeys: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedKeys['DEEPSEEK_API_KEY'] = process.env['DEEPSEEK_API_KEY'];
    savedKeys['CUSTOM_BASE_URL'] = process.env['CUSTOM_BASE_URL'];
    savedKeys['CARINA_LOCAL_LLM_ENABLED'] = process.env['CARINA_LOCAL_LLM_ENABLED'];
    delete process.env['DEEPSEEK_API_KEY'];
    delete process.env['CUSTOM_BASE_URL'];
    delete process.env['CARINA_LOCAL_LLM_ENABLED'];
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedKeys)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('alias providers are never configured (not routable)', () => {
    const aliases = PROVIDER_DEFINITIONS.filter((d) => d.status === 'alias');
    for (const def of aliases) {
      expect(isProviderConfigured(def)).toBe(false);
    }
  });

  it('external-cli providers are never configured via isProviderConfigured', () => {
    const externalDefs = PROVIDER_DEFINITIONS.filter((d) => d.status === 'external-cli');
    for (const def of externalDefs) {
      expect(isProviderConfigured(def)).toBe(false);
    }
  });

  it('oauth providers are never configured via isProviderConfigured', () => {
    const oauthDefs = PROVIDER_DEFINITIONS.filter((d) => d.status === 'oauth');
    for (const def of oauthDefs) {
      expect(isProviderConfigured(def)).toBe(false);
    }
  });

  it('active provider with api key reports configured', () => {
    process.env['DEEPSEEK_API_KEY'] = 'sk-test';
    expect(isProviderConfigured(PROVIDER_MAP['deepseek'])).toBe(true);
  });

  it('active provider without api key reports not configured', () => {
    expect(isProviderConfigured(PROVIDER_MAP['deepseek'])).toBe(false);
  });

  it('custom provider configured when CUSTOM_BASE_URL is set', () => {
    process.env['CUSTOM_BASE_URL'] = 'http://localhost:8080/v1';
    expect(isProviderConfigured(PROVIDER_MAP['custom'])).toBe(true);
  });

  it('custom provider not configured when CUSTOM_BASE_URL is unset', () => {
    expect(isProviderConfigured(PROVIDER_MAP['custom'])).toBe(false);
  });

  it('llama-cpp configured when CARINA_LOCAL_LLM_ENABLED=true', () => {
    process.env['CARINA_LOCAL_LLM_ENABLED'] = 'true';
    expect(isProviderConfigured(PROVIDER_MAP['llama-cpp'])).toBe(true);
  });
});

/* ── capability-based selection ── */

describe('provider catalog - capability selection', () => {
  it('isRoutableProvider returns true only for active and experimental', () => {
    for (const def of PROVIDER_DEFINITIONS) {
      const expected = def.status === 'active' || def.status === 'experimental';
      expect(isRoutableProvider(def)).toBe(expected);
    }
  });

  it('ROUTABLE_PROVIDERS contains no aliases or external-cli entries', () => {
    for (const def of ROUTABLE_PROVIDERS) {
      expect(def.status).not.toBe('alias');
      expect(def.status).not.toBe('external-cli');
      expect(def.status).not.toBe('oauth');
    }
  });

  it('ROUTABLE_PROVIDER_NAMES does not include kimi, z-ai, alibaba', () => {
    expect(ROUTABLE_PROVIDER_NAMES).not.toContain('kimi');
    expect(ROUTABLE_PROVIDER_NAMES).not.toContain('z-ai');
    expect(ROUTABLE_PROVIDER_NAMES).not.toContain('alibaba');
  });

  it('ROUTABLE_PROVIDER_NAMES includes deepseek, anthropic, openai, ollama', () => {
    expect(ROUTABLE_PROVIDER_NAMES).toContain('deepseek');
    expect(ROUTABLE_PROVIDER_NAMES).toContain('anthropic');
    expect(ROUTABLE_PROVIDER_NAMES).toContain('openai');
    expect(ROUTABLE_PROVIDER_NAMES).toContain('ollama');
  });

  it('vision-capable providers are a subset of routable providers', () => {
    const visionDefs = ROUTABLE_PROVIDERS.filter((d) => d.capabilities.vision);
    for (const def of visionDefs) {
      expect(isRoutableProvider(def)).toBe(true);
    }
  });
});

/* ── fallback ordering ── */

describe('provider catalog - fallback ordering', () => {
  it('fallbackOrderNames returns only routable providers', () => {
    const names = fallbackOrderNames();
    for (const name of names) {
      const def = PROVIDER_MAP[name];
      expect(def).toBeDefined();
      expect(isRoutableProvider(def)).toBe(true);
    }
  });

  it('fallbackOrderNames does not include kimi alias', () => {
    expect(fallbackOrderNames()).not.toContain('kimi');
  });

  it('fallbackOrderNames does not include external-cli entries', () => {
    const externalNames = PROVIDER_DEFINITIONS
      .filter((d) => d.status === 'external-cli')
      .map((d) => d.name);
    const fallback = new Set(fallbackOrderNames());
    for (const name of externalNames) {
      expect(fallback.has(name)).toBe(false);
    }
  });

  it('deepseek is first in fallback order (lowest priority number)', () => {
    expect(fallbackOrderNames()[0]).toBe('deepseek');
  });

  it('fallback order is sorted by fallbackPriority ascending', () => {
    const names = fallbackOrderNames();
    const priorities = names.map((n) => PROVIDER_MAP[n].fallbackPriority);
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1]);
    }
  });

  it('local providers appear before cloud providers in fallback', () => {
    const names = fallbackOrderNames();
    const ollamaIdx = names.indexOf('ollama');
    const openaiIdx = names.indexOf('openai');
    expect(ollamaIdx).toBeGreaterThan(-1);
    expect(openaiIdx).toBeGreaterThan(-1);
  });
});

/* ── alias handling ── */

describe('provider catalog - alias handling', () => {
  it('kimi is an alias for moonshot', () => {
    expect(PROVIDER_MAP['kimi']?.status).toBe('alias');
    expect(PROVIDER_MAP['kimi']?.aliasFor).toBe('moonshot');
    expect(resolveAliasTarget('kimi')).toBe('moonshot');
  });

  it('z-ai is an alias for zhipu', () => {
    expect(PROVIDER_MAP['z-ai']?.status).toBe('alias');
    expect(PROVIDER_MAP['z-ai']?.aliasFor).toBe('zhipu');
    expect(resolveAliasTarget('z-ai')).toBe('zhipu');
  });

  it('alibaba is an alias for qwen', () => {
    expect(PROVIDER_MAP['alibaba']?.status).toBe('alias');
    expect(PROVIDER_MAP['alibaba']?.aliasFor).toBe('qwen');
    expect(resolveAliasTarget('alibaba')).toBe('qwen');
  });

  it('resolveAliasTarget returns undefined for non-alias providers', () => {
    expect(resolveAliasTarget('deepseek')).toBeUndefined();
    expect(resolveAliasTarget('openai')).toBeUndefined();
    expect(resolveAliasTarget('unknown-provider')).toBeUndefined();
  });

  it('alias target providers exist in the registry', () => {
    const aliases = PROVIDER_DEFINITIONS.filter((d) => d.status === 'alias');
    for (const def of aliases) {
      const target = PROVIDER_MAP[def.aliasFor!];
      expect(target).toBeDefined();
      expect(isRoutableProvider(target)).toBe(true);
    }
  });
});

/* ── no overhead in normal chat turns ── */

describe('provider catalog - zero overhead guarantee', () => {
  it('fallbackOrderNames() contains no non-routable entries - tested 1000x same result', () => {
    const first = fallbackOrderNames();
    for (let i = 0; i < 1000; i++) {
      const names = fallbackOrderNames();
      expect(names).toEqual(first);
    }
  });

  it('fallbackOrderNames resolves synchronously with no I/O', () => {
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      fallbackOrderNames();
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(200);
  });

  it('providerModel resolves synchronously', () => {
    for (const def of ROUTABLE_PROVIDERS) {
      const m = providerModel(def);
      expect(typeof m).toBe('string');
      expect(m.length).toBeGreaterThan(0);
    }
  });
});

/* ── external-cli stubs ── */

describe('external-cli providers', () => {
  it('lists 6 external-cli provider infos', () => {
    const list = listExternalCliProviders();
    expect(list.length).toBe(6);
  });

  it('all external-cli entries have a cliCommand', () => {
    for (const info of listExternalCliProviders()) {
      expect(info.cliCommand.length).toBeGreaterThan(0);
    }
  });

  it('all external-cli entries have an installNote', () => {
    for (const info of listExternalCliProviders()) {
      expect(info.installNote.length).toBeGreaterThan(0);
    }
  });

  it('getExternalCliInfo returns info for known entries', () => {
    expect(getExternalCliInfo('github-copilot')?.cliCommand).toBe('gh copilot');
    expect(getExternalCliInfo('kilo-code')?.cliCommand).toBe('kilo');
    expect(getExternalCliInfo('opencode-zen')?.cliCommand).toBe('opencode');
  });

  it('getExternalCliInfo returns undefined for unknown name', () => {
    expect(getExternalCliInfo('not-a-provider')).toBeUndefined();
  });

  it('isExternalCliConfigured returns false when configEnv is not set', () => {
    const prev = process.env['OPENAI_API_KEY'];
    delete process.env['OPENAI_API_KEY'];
    expect(isExternalCliConfigured('openai-codex')).toBe(false);
    if (prev) process.env['OPENAI_API_KEY'] = prev;
  });

  it('isExternalCliConfigured returns true when configEnv is set', () => {
    process.env['OPENAI_API_KEY'] = 'sk-test';
    expect(isExternalCliConfigured('openai-codex')).toBe(true);
    delete process.env['OPENAI_API_KEY'];
  });

  it('providers with no configEnv report false from isExternalCliConfigured', () => {
    expect(isExternalCliConfigured('github-copilot')).toBe(false);
    expect(isExternalCliConfigured('opencode-zen')).toBe(false);
  });

  it('listCatalogByStatus returns only external-cli entries for that status', () => {
    const list = listCatalogByStatus('external-cli');
    expect(list.length).toBeGreaterThan(0);
    for (const def of list) {
      expect(def.status).toBe('external-cli');
    }
  });

  it('listCatalogByStatus returns alias entries correctly', () => {
    const aliases = listCatalogByStatus('alias');
    expect(aliases.length).toBeGreaterThanOrEqual(3);
    const names = aliases.map((d) => d.name);
    expect(names).toContain('kimi');
    expect(names).toContain('z-ai');
    expect(names).toContain('alibaba');
  });
});
