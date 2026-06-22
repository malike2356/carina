import { describe, expect, it } from 'vitest';
import {
  mergeBrandSettings,
  normalizeBrandConfig,
  resolveBrand,
  resolveWorkspaceBrand,
} from './brand';

describe('app brand helpers', () => {
  it('merges partial brand patches', () => {
    expect(mergeBrandSettings(
      { productName: 'Acme', colorTokens: { '--accent': '#111111' } },
      { logoUrl: 'https://cdn.example/logo.png', colorTokens: { '--accent': '#222222' } },
    )).toEqual({
      productName: 'Acme',
      logoUrl: 'https://cdn.example/logo.png',
      colorTokens: { '--accent': '#222222' },
    });
  });

  it('resolves workspace brand with reseller precedence', () => {
    const brand = resolveWorkspaceBrand({
      resellerBrand: { productName: 'Partner Cloud' },
      workspaceBrand: { productName: 'Client Portal', supportEmail: 'help@client.example' },
    });
    expect(brand.productName).toBe('Client Portal');
    expect(brand.supportEmail).toBe('help@client.example');
    expect(brand.sources.productName).toBe('workspace');
  });

  it('returns platform defaults for empty brand data', () => {
    const brand = resolveBrand({ mode: 'hosted' });
    expect(brand.productName).toBe('Carina Cloud');
    expect(normalizeBrandConfig(null)).toEqual({});
  });
});
