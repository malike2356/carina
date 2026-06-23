import { describe, expect, it } from 'vitest';
import {
  normalizeBrandConfig,
  platformBrandDefaults,
  resolveBrand,
} from './brand.js';

describe('normalizeBrandConfig', () => {
  it('returns empty object for invalid input', () => {
    expect(normalizeBrandConfig(null)).toEqual({});
    expect(normalizeBrandConfig('bad')).toEqual({});
  });

  it('trims strings and drops empty values', () => {
    expect(normalizeBrandConfig({
      productName: '  Acme AI  ',
      shortName: '   ',
      logoUrl: 'https://cdn.example/logo.png',
    })).toEqual({
      productName: 'Acme AI',
      logoUrl: 'https://cdn.example/logo.png',
    });
  });

  it('normalizes color token maps', () => {
    expect(normalizeBrandConfig({
      colorTokens: { '--accent': '#ff0000', '--bg-base': '  ' },
    })).toEqual({
      colorTokens: { '--accent': '#ff0000' },
    });
  });
});

describe('platformBrandDefaults', () => {
  it('returns hosted defaults', () => {
    const brand = platformBrandDefaults('hosted');
    expect(brand.productName).toBe('Carina Cloud');
    expect(brand.shortName).toBe('Carina');
  });

  it('returns private defaults', () => {
    const brand = platformBrandDefaults('private');
    expect(brand.productName).toBe('Carina');
  });

  it('returns ops defaults', () => {
    const brand = platformBrandDefaults('ops');
    expect(brand.productName).toBe('Carina Ops');
  });
});

describe('resolveBrand precedence', () => {
  it('uses platform defaults when no overrides exist', () => {
    const brand = resolveBrand({ mode: 'hosted' });
    expect(brand.productName).toBe('Carina Cloud');
    expect(brand.shortName).toBe('Carina');
    expect(brand.sources.productName).toBe('platform');
    expect(brand.logoUrl).toBeNull();
  });

  it('applies reseller overrides over platform', () => {
    const brand = resolveBrand({
      mode: 'hosted',
      reseller: { productName: 'Partner Cloud', senderName: 'Partner Ops' },
    });
    expect(brand.productName).toBe('Partner Cloud');
    expect(brand.senderName).toBe('Partner Ops');
    expect(brand.shortName).toBe('Carina');
    expect(brand.sources.productName).toBe('reseller');
    expect(brand.sources.shortName).toBe('platform');
  });

  it('applies workspace overrides over reseller', () => {
    const brand = resolveBrand({
      mode: 'hosted',
      reseller: { productName: 'Partner Cloud', logoUrl: 'https://partner/logo.png' },
      workspace: { productName: 'Client Workspace', logoUrl: 'https://client/logo.png' },
    });
    expect(brand.productName).toBe('Client Workspace');
    expect(brand.logoUrl).toBe('https://client/logo.png');
    expect(brand.sources.productName).toBe('workspace');
    expect(brand.sources.logoUrl).toBe('workspace');
  });

  it('applies user preference last for color tokens', () => {
    const brand = resolveBrand({
      mode: 'private',
      platform: { colorTokens: { '--accent': '#111111' } },
      workspace: { colorTokens: { '--accent': '#222222', '--bg-base': '#ffffff' } },
      user: { colorTokens: { '--accent': '#333333' } },
    });
    expect(brand.colorTokens).toEqual({
      '--accent': '#333333',
      '--bg-base': '#ffffff',
    });
    expect(brand.sources.colorTokens).toBe('user');
  });

  it('falls back safely when layers are null or partial', () => {
    const brand = resolveBrand({
      mode: 'private',
      reseller: null,
      workspace: { supportEmail: 'help@client.example' },
      user: null,
    });
    expect(brand.productName).toBe('Carina');
    expect(brand.supportEmail).toBe('help@client.example');
    expect(brand.logoUrl).toBeNull();
  });

  it('uses publicSiteTitle fallback from productName', () => {
    const brand = resolveBrand({
      workspace: { productName: 'Nova Agent' },
    });
    expect(brand.publicSiteTitle).toBe('Nova Agent');
  });
});
