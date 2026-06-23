import { describe, expect, it } from 'vitest';
import {
  buildWorkspacePackStorefront,
  mergeTemplatePacks,
  parseActiveSkillPacks,
  serializeActiveSkillPacks,
  togglePack,
} from './pack-storefront';

describe('pack-storefront', () => {
  it('parses active skill packs from workspace storage', () => {
    expect(parseActiveSkillPacks('finance, property-uk')).toEqual(['finance', 'property-uk']);
    expect(serializeActiveSkillPacks(['property-uk', 'finance', 'finance'])).toBe('finance,property-uk');
  });

  it('builds a branded storefront with customer-owned visibility', () => {
    const storefront = buildWorkspacePackStorefront({
      workspaceId: 'ws-1',
      activeSkillPacks: 'finance',
      productName: 'Acme Agents',
      packCatalog: [
        {
          slug: 'property-uk',
          ownership: 'reseller',
          ownerId: 'partner-1',
          visible: true,
          label: 'Acme Property',
        },
        {
          slug: 'custom-pack',
          ownership: 'customer',
          ownerId: 'ws-1',
          visible: true,
          label: 'Internal SOP pack',
        },
      ],
    });

    expect(storefront.productName).toBe('Acme Agents');
    expect(storefront.packs.find((pack) => pack.slug === 'finance')?.installed).toBe(true);
    expect(storefront.packs.find((pack) => pack.slug === 'property-uk')?.label).toBe('Acme Property');
    expect(storefront.packs.some((pack) => pack.slug === 'custom-pack')).toBe(false);
  });

  it('installs vertical template packs', () => {
    expect(mergeTemplatePacks(['finance'], 'property')).toEqual(['finance', 'legal-uk', 'property-uk']);
    expect(togglePack(['finance'], 'healthcare', true)).toEqual(['finance', 'healthcare']);
    expect(togglePack(['finance', 'healthcare'], 'finance', false)).toEqual(['healthcare']);
  });
});
