import { describe, expect, it } from 'vitest';
import { resolveBrand } from '@/lib/brand';

describe('brand shell defaults', () => {
  it('keeps default Carina Cloud branding when no overrides exist', () => {
    const brand = resolveBrand({ mode: 'hosted' });
    expect(brand.productName).toBe('Carina Cloud');
    expect(brand.logoUrl).toBe('/carina_logo_1.png');
    expect(brand.faviconUrl).toBe('/carina-logo.png');
  });

  it('supports branded product name and assets for shell rendering', () => {
    const brand = resolveBrand({
      mode: 'hosted',
      workspace: {
        productName: 'Nova Workspace',
        shortName: 'Nova',
        logoUrl: 'https://cdn.example/logo.png',
        faviconUrl: 'https://cdn.example/favicon.ico',
        colorTokens: { '--accent': '#3366ff' },
      },
    });
    expect(brand.productName).toBe('Nova Workspace');
    expect(brand.logoUrl).toBe('https://cdn.example/logo.png');
    expect(brand.faviconUrl).toBe('https://cdn.example/favicon.ico');
    expect(brand.colorTokens['--accent']).toBe('#3366ff');
  });
});
