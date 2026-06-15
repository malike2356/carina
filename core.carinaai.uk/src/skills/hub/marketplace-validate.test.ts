import { describe, expect, it } from 'vitest';
import {
  assertCatalogIntegrity,
  normalizeMarketplaceEntry,
  validateMarketplaceEntryInput,
  validateMarketplaceTrust,
} from './marketplace-validate.js';

describe('marketplace validation', () => {
  it('validates trust metadata', () => {
    const trust = validateMarketplaceTrust({
      publisher: 'verified',
      featured: true,
      verified: true,
      validation: 'passed',
      risk: 'low',
    }, 'test');
    expect(trust.publisher).toBe('verified');
    expect(trust.featured).toBe(true);
  });

  it('rejects invalid slug', () => {
    expect(() => validateMarketplaceEntryInput({
      kind: 'pack',
      slug: 'Bad Slug',
      name: 'x',
      version: '1.0.0',
      description: 'd',
      author: 'a',
      trust: { publisher: 'community', featured: false, verified: false, validation: 'pending', risk: 'low' },
      install: { source: 'hub' },
    })).toThrow(/slug/);
  });

  it('normalizes marketplace entries', () => {
    const entry = normalizeMarketplaceEntry({
      kind: 'mcp',
      slug: 'filesystem',
      name: 'Filesystem',
      version: '1.0.0',
      description: 'MCP filesystem',
      author: 'MCP',
      trust: { publisher: 'verified', featured: true, verified: true, validation: 'passed', risk: 'medium' },
      install: { source: 'builtin', ref: 'filesystem' },
    });
    expect(entry.id).toBe('mcp:filesystem');
  });

  it('detects catalog integrity issues', () => {
    const good = normalizeMarketplaceEntry({
      kind: 'theme',
      slug: 'tui-operator',
      name: 'TUI',
      version: '1.0.0',
      description: 'Theme',
      author: 'Carina',
      trust: { publisher: 'carina', featured: false, verified: true, validation: 'builtin', risk: 'low' },
      install: { source: 'builtin' },
    });
    expect(assertCatalogIntegrity([good])).toEqual([]);

    const bad = { ...good, id: 'wrong:id', trust: { ...good.trust, verified: true, validation: 'failed' as const } };
    expect(assertCatalogIntegrity([bad]).length).toBeGreaterThan(0);
  });
});
