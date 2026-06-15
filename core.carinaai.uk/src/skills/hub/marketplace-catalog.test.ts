import { describe, expect, it } from 'vitest';
import { buildBuiltinMarketplaceEntries } from './marketplace-builtin.js';
import { buildMarketplaceCatalog, queryMarketplaceCatalog, summarizeMarketplaceCatalog } from './marketplace-catalog.js';

describe('marketplace catalog', () => {
  it('builds a multi-kind builtin catalog', async () => {
    const catalog = await buildMarketplaceCatalog();
    const summary = summarizeMarketplaceCatalog(catalog);
    expect(summary.total).toBeGreaterThan(50);
    expect(summary.byKind.pack).toBeGreaterThan(10);
    expect(summary.byKind.channel).toBeGreaterThan(40);
    expect(summary.byKind.toolset).toBeGreaterThan(10);
    expect(summary.byKind.mcp).toBeGreaterThanOrEqual(6);
    expect(summary.byKind.workflow).toBeGreaterThanOrEqual(6);
    expect(summary.byKind.theme).toBeGreaterThanOrEqual(4);
    expect(summary.featured).toBeGreaterThan(0);
    expect(summary.verified).toBeGreaterThan(0);
  });

  it('includes builtin utility extensions', async () => {
    const catalog = await buildMarketplaceCatalog();
    const utilities = catalog.filter((e) => e.kind === 'extension' && e.category === 'utilities');
    expect(utilities.length).toBeGreaterThanOrEqual(10);
    expect(utilities.some((e) => e.id === 'extension:active-memory')).toBe(true);
  });

  it('filters by kind and featured', async () => {
    const { entries } = await queryMarketplaceCatalog({ kind: 'mcp', featured: true });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.kind === 'mcp' && e.trust.featured)).toBe(true);
  });

  it('includes trust metadata on every entry', () => {
    for (const entry of buildBuiltinMarketplaceEntries()) {
      expect(entry.trust.publisher).toBeTruthy();
      expect(['low', 'medium', 'high']).toContain(entry.trust.risk);
      expect(entry.install.source).toBeTruthy();
    }
  });
});
