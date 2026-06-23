import { describe, expect, it } from 'vitest';
import {
  resolveAgentDisplayName,
  resolveBrandedProductSurface,
  stripPlatformEquivalentBrand,
} from './brand-compat.js';
import { resolveBrand } from './brand.js';

describe('brand-compat', () => {
  it('keeps ordinary Carina hosted defaults when no customer brand is set', () => {
    const prev = process.env.CARINA_PRODUCT_MODE;
    process.env.CARINA_PRODUCT_MODE = 'hosted';
    try {
      const surface = resolveBrandedProductSurface('app.carinaai.uk');
      expect(surface.branding.productName).toBe('Carina Cloud');
      expect(surface.branding.titleSuffix).toBe('Carina Cloud');
    } finally {
      if (prev === undefined) delete process.env.CARINA_PRODUCT_MODE;
      else process.env.CARINA_PRODUCT_MODE = prev;
    }
  });

  it('keeps ordinary private defaults on operator hosts', () => {
    const surface = resolveBrandedProductSurface('core.carinaai.uk');
    expect(surface.branding.productName).toBe('Carina');
  });

  it('applies customer workspace brand without breaking platform fallbacks', () => {
    const surface = resolveBrandedProductSurface('agents.client.example', {
      workspace: { productName: 'Acme Agents', supportEmail: 'help@acme.example' },
    });
    expect(surface.branding.productName).toBe('Acme Agents');
    expect(surface.branding.workspaceName).toBe('Acme Agents');
    expect(surface.branding.titleSuffix).toBe('Acme Agents');
  });

  it('strips legacy platform labels from stored workspace brand JSON', () => {
    const stripped = stripPlatformEquivalentBrand(
      { productName: 'Carina Cloud', supportEmail: 'help@client.example' },
      'hosted',
    );
    expect(stripped.productName).toBeUndefined();
    expect(stripped.supportEmail).toBe('help@client.example');
    const brand = resolveBrand({ mode: 'hosted', workspace: stripped });
    expect(brand.productName).toBe('Carina Cloud');
    expect(brand.supportEmail).toBe('help@client.example');
  });

  it('resolves agent display name from customer brand with Carina fallback', () => {
    expect(resolveAgentDisplayName()).toBe('Carina');
    expect(resolveAgentDisplayName({ shortName: 'Nova', productName: 'Nova Cloud' })).toBe('Nova');
    expect(resolveAgentDisplayName({ productName: 'Acme Agents' })).toBe('Acme Agents');
  });
});
