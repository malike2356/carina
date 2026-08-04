import { describe, expect, it } from 'vitest';
import {
  ALL_CONFIG_DOMAINS,
  findDomainByAlias,
  listDomainSummaries,
  getDomainRequiredFields,
  getAllSensitiveFieldKeys,
  DOMAIN_CATEGORY_LABELS,
} from './settings-requirements.js';

describe('ALL_CONFIG_DOMAINS', () => {
  it('contains at least 20 domains', () => {
    expect(ALL_CONFIG_DOMAINS.length).toBeGreaterThanOrEqual(20);
  });

  it('every domain has an id, name, and at least one field', () => {
    for (const domain of ALL_CONFIG_DOMAINS) {
      expect(domain.id).toBeTruthy();
      expect(domain.name).toBeTruthy();
      expect(domain.fields.length).toBeGreaterThan(0);
    }
  });

  it('every domain has a storageMode of db or env', () => {
    for (const domain of ALL_CONFIG_DOMAINS) {
      expect(['db', 'env']).toContain(domain.storageMode);
    }
  });

  it('every field has key, label, and boolean sensitive/optional flags', () => {
    for (const domain of ALL_CONFIG_DOMAINS) {
      for (const field of domain.fields) {
        expect(field.key).toBeTruthy();
        expect(field.label).toBeTruthy();
        expect(typeof field.sensitive).toBe('boolean');
        expect(typeof field.optional).toBe('boolean');
      }
    }
  });

  it('no domain id is duplicated', () => {
    const ids = ALL_CONFIG_DOMAINS.map((d) => d.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('examples in field definitions do not contain real credentials', () => {
    const suspiciousPattern = /sk-[a-zA-Z0-9]{20,}|[a-zA-Z0-9]{40,}/;
    for (const domain of ALL_CONFIG_DOMAINS) {
      for (const field of domain.fields) {
        if (field.example) {
          expect(suspiciousPattern.test(field.example)).toBe(false);
        }
      }
    }
  });
});

describe('findDomainByAlias', () => {
  it('resolves "openai" to provider:openai', () => {
    const d = findDomainByAlias('openai');
    expect(d?.id).toBe('provider:openai');
  });

  it('resolves "gpt" to provider:openai', () => {
    const d = findDomainByAlias('gpt');
    expect(d?.id).toBe('provider:openai');
  });

  it('resolves "gpt-4" to provider:openai', () => {
    const d = findDomainByAlias('gpt-4');
    expect(d?.id).toBe('provider:openai');
  });

  it('resolves "anthropic" to provider:anthropic', () => {
    const d = findDomainByAlias('anthropic');
    expect(d?.id).toBe('provider:anthropic');
  });

  it('resolves "claude" to provider:anthropic', () => {
    const d = findDomainByAlias('claude');
    expect(d?.id).toBe('provider:anthropic');
  });

  it('resolves "deepseek" to provider:deepseek', () => {
    const d = findDomainByAlias('deepseek');
    expect(d?.id).toBe('provider:deepseek');
  });

  it('resolves "timezone" to workspace:timezone', () => {
    const d = findDomainByAlias('timezone');
    expect(d?.id).toBe('workspace:timezone');
  });

  it('resolves "quiet hours" to workspace:quiet-hours', () => {
    const d = findDomainByAlias('quiet hours');
    expect(d?.id).toBe('workspace:quiet-hours');
  });

  it('resolves "n8n" to integration:n8n', () => {
    const d = findDomainByAlias('n8n');
    expect(d?.id).toBe('integration:n8n');
  });

  it('resolves hosted Aiva email aliases', () => {
    expect(findDomainByAlias('hosted email')?.id).toBe('integration:aiva-hosted-email');
    expect(findDomainByAlias('cloudflare email')?.id).toBe('integration:aiva-hosted-email');
  });

  it('resolves "trello" to integration:trello', () => {
    const d = findDomainByAlias('trello');
    expect(d?.id).toBe('integration:trello');
  });

  it('resolves "scout" to scout:endpoint', () => {
    const d = findDomainByAlias('scout');
    expect(d?.id).toBe('scout:endpoint');
  });

  it('resolves "tts" to voice:tts', () => {
    const d = findDomainByAlias('tts');
    expect(d?.id).toBe('voice:tts');
  });

  it('resolves "default model" to model:default', () => {
    const d = findDomainByAlias('default model');
    expect(d?.id).toBe('model:default');
  });

  it('returns null for unknown alias', () => {
    expect(findDomainByAlias('xyzzy-does-not-exist')).toBeNull();
  });

  it('resolves case-insensitively', () => {
    expect(findDomainByAlias('OpenAI')?.id).toBe('provider:openai');
    expect(findDomainByAlias('SCOUT')?.id).toBe('scout:endpoint');
  });
});

describe('getDomainRequiredFields', () => {
  it('returns only non-optional fields for provider:openai', () => {
    const fields = getDomainRequiredFields('provider:openai');
    expect(fields.length).toBeGreaterThan(0);
    for (const f of fields) {
      expect(f.optional).toBe(false);
    }
  });

  it('returns empty array for unknown domain', () => {
    const fields = getDomainRequiredFields('nonexistent:domain');
    expect(fields).toEqual([]);
  });
});

describe('listDomainSummaries', () => {
  it('returns an entry for every domain', () => {
    const summaries = listDomainSummaries();
    expect(summaries.length).toBe(ALL_CONFIG_DOMAINS.length);
  });

  it('each summary has id, name, category, aliases', () => {
    for (const s of listDomainSummaries()) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.category).toBeTruthy();
      expect(Array.isArray(s.aliases)).toBe(true);
    }
  });

  it('category is derived from the domain id prefix', () => {
    for (const s of listDomainSummaries()) {
      const prefix = s.id.split(':')[0] ?? '';
      expect(s.category).toBe(prefix);
    }
  });
});

describe('getAllSensitiveFieldKeys', () => {
  it('returns a non-empty set', () => {
    const keys = getAllSensitiveFieldKeys();
    expect(keys.size).toBeGreaterThan(0);
  });

  it('includes known sensitive keys', () => {
    const keys = getAllSensitiveFieldKeys();
    expect(keys.has('OPENAI_API_KEY')).toBe(true);
    expect(keys.has('ANTHROPIC_API_KEY')).toBe(true);
    expect(keys.has('CLOUDFLARE_EMAIL_WORKER_SECRET')).toBe(true);
  });

  it('includes all registry-sensitive keys (may also include speech-scrub extras)', () => {
    const sensitiveFromRegistry = new Set<string>();
    for (const domain of ALL_CONFIG_DOMAINS) {
      for (const field of domain.fields) {
        if (field.sensitive) sensitiveFromRegistry.add(field.key);
      }
    }
    const keys = getAllSensitiveFieldKeys();
    // Every registry-sensitive key must be present in the returned set
    for (const key of sensitiveFromRegistry) {
      expect(keys.has(key)).toBe(true);
    }
  });
});

describe('DOMAIN_CATEGORY_LABELS', () => {
  it('provides human-readable labels for core categories', () => {
    expect(DOMAIN_CATEGORY_LABELS['provider']).toBeTruthy();
    expect(DOMAIN_CATEGORY_LABELS['workspace']).toBeTruthy();
    expect(DOMAIN_CATEGORY_LABELS['integration']).toBeTruthy();
    expect(DOMAIN_CATEGORY_LABELS['scout']).toBeTruthy();
    expect(DOMAIN_CATEGORY_LABELS['voice']).toBeTruthy();
  });
});
