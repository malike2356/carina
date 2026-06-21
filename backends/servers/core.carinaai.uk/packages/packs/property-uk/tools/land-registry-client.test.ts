import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('land-registry-client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalises UK postcodes', async () => {
    vi.doMock('#core/config/index.js', () => ({
      config: {
        landRegistry: { apiKey: '', baseUrl: 'https://api.propertydata.co.uk' },
        propertyData: { apiKey: '' },
      },
    }));
    const { normaliseUkPostcode, extractUkPostcode, isUkPostcode } = await import('./land-registry-client.js');
    expect(normaliseUkPostcode('sw1a1aa')).toBe('SW1A 1AA');
    expect(extractUkPostcode('10 Downing Street, London SW1A 2AA')).toBe('SW1A 2AA');
    expect(isUkPostcode('SW1A 2AA')).toBe(true);
  });

  it('looks up a title number via PropertyData', async () => {
    vi.doMock('#core/config/index.js', () => ({
      config: {
        landRegistry: { apiKey: 'test-key', baseUrl: 'https://api.propertydata.co.uk' },
        propertyData: { apiKey: '' },
      },
    }));
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success', title: 'ON176985', tenure: 'freehold' }),
    } as Response);

    const { lookupTitle } = await import('./land-registry-client.js');
    const result = await lookupTitle('ON176985');
    expect(result.searchType).toBe('title');
    expect(result.status).toBe('success');
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/title?');
    expect(String(fetch.mock.calls[0]?.[0])).toContain('key=test-key');
  });

  it('chains address match to UPRN title lookup', async () => {
    vi.doMock('#core/config/index.js', () => ({
      config: {
        landRegistry: { apiKey: '', baseUrl: 'https://api.propertydata.co.uk' },
        propertyData: { apiKey: 'pd-key' },
      },
    }));
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'success', data: { uprn: '10002333678' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'success', title: 'TGL123456' }),
      } as Response);

    const { lookupByAddress } = await import('./land-registry-client.js');
    const result = await lookupByAddress('10 Downing Street, London SW1A 2AA');
    expect(result.searchType).toBe('address');
    expect(result.titleLookup).toMatchObject({ status: 'success', title: 'TGL123456' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('returns an error when no API key is configured', async () => {
    vi.doMock('#core/config/index.js', () => ({
      config: {
        landRegistry: { apiKey: '', baseUrl: 'https://api.propertydata.co.uk' },
        propertyData: { apiKey: '' },
      },
    }));
    const { runLandRegistrySearch } = await import('./land-registry-client.js');
    const result = await runLandRegistrySearch('ON176985', 'title');
    expect(result.status).toBe('error');
    expect(result.message).toContain('not configured');
  });
});
