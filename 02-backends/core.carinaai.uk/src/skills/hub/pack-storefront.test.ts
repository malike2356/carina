import { describe, expect, it } from 'vitest';
import {
  filterVisiblePackCatalog,
  isPackVisibleToContext,
  mergePackCatalog,
  normalizePackCatalogRecord,
} from './pack-ownership.js';
import { applyVerticalTemplate, buildPackStorefront, toggleStorefrontPack } from './pack-storefront.js';
import { mergeTemplatePacks, packsForVerticalTemplate } from './vertical-templates.js';

describe('pack ownership', () => {
  it('normalizes catalog records and merges overrides', () => {
    const base = [{ slug: 'finance', ownership: 'platform' as const, visible: true }];
    const override = normalizePackCatalogRecord({
      slug: 'finance',
      ownership: 'reseller',
      ownerId: 'partner-1',
      visible: true,
      label: 'Agency finance pack',
    });
    expect(override).toMatchObject({ ownership: 'reseller', label: 'Agency finance pack' });
    expect(mergePackCatalog(base, [override!])).toEqual([override]);
  });

  it('hides reseller packs from unrelated workspaces', () => {
    const catalog = [
      { slug: 'finance', ownership: 'platform' as const, visible: true },
      {
        slug: 'property-uk',
        ownership: 'reseller' as const,
        ownerId: 'partner-a',
        visible: true,
      },
    ];
    const visible = filterVisiblePackCatalog(catalog, { partnerId: 'partner-b', workspaceId: 'ws-1' });
    expect(visible.map((entry) => entry.slug)).toEqual(['finance']);
    expect(
      isPackVisibleToContext(catalog[1]!, { partnerId: 'partner-a', workspaceId: 'ws-1' }),
    ).toBe(true);
  });

  it('keeps customer-owned packs scoped to the workspace', () => {
    const entry = {
      slug: 'custom-pack',
      ownership: 'customer' as const,
      ownerId: 'ws-42',
      visible: true,
    };
    expect(isPackVisibleToContext(entry, { workspaceId: 'ws-42' })).toBe(true);
    expect(isPackVisibleToContext(entry, { workspaceId: 'ws-99' })).toBe(false);
  });
});

describe('vertical templates', () => {
  it('returns starter bundles for common verticals', () => {
    expect(packsForVerticalTemplate('property')).toEqual(['property-uk', 'legal-uk']);
    expect(packsForVerticalTemplate('support')).toContain('operator-daily');
    expect(mergeTemplatePacks(['finance'], 'property')).toEqual(['finance', 'legal-uk', 'property-uk']);
  });
});

describe('pack storefront', () => {
  it('builds a branded storefront with installed state', () => {
    const storefront = buildPackStorefront({
      productName: 'Acme Agents',
      activePacks: ['finance'],
      context: { partnerId: 'partner-1', workspaceId: 'ws-1' },
      partnerPacks: [
        {
          slug: 'property-uk',
          ownership: 'reseller',
          ownerId: 'partner-1',
          visible: true,
          label: 'Acme Property',
        },
      ],
    });
    expect(storefront.productName).toBe('Acme Agents');
    expect(storefront.templates.length).toBeGreaterThan(0);
    const finance = storefront.packs.find((pack) => pack.slug === 'finance');
    const property = storefront.packs.find((pack) => pack.slug === 'property-uk');
    expect(finance?.installed).toBe(true);
    expect(property?.label).toBe('Acme Property');
  });

  it('installs template packs without unknown slugs', () => {
    const result = applyVerticalTemplate([], 'healthcare');
    expect(result.packs).toEqual(['healthcare']);
    expect(result.invalid).toEqual([]);
    const toggled = toggleStorefrontPack(result.packs, 'finance', true);
    expect(toggled.packs).toEqual(['finance', 'healthcare']);
  });
});
