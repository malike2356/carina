import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

async function loadDomainLookup(searchResult: unknown[] = []) {
  vi.doMock('../memory/store.js', () => ({
    searchRag: vi.fn(async () => searchResult),
  }));
  const domain = await import('./domain-lookup.js');
  const { registerPropertyUkDomainData } = await import(
    '../../packages/packs/property-uk/domain-data.js'
  );
  domain.clearDomainLookupSourcesForTests();
  registerPropertyUkDomainData(domain.registerDomainLookupSource);
  return domain;
}

describe('domain_lookup', () => {
  it('dispatches hmo_minimum_room_size to the property-uk static postcode index', async () => {
    const { domainLookup } = await loadDomainLookup();

    const result = await domainLookup('hmo_minimum_room_size', { postcode: 'PO1 2AB' });

    expect(result.found).toBe(true);
    expect(result.pack).toBe('property-uk');
    expect(result.sources?.[0].url).toContain('legislation.gov.uk');
    expect(result.data).toMatchObject({
      postcodeArea: 'PO',
      jurisdiction: 'England',
    });
    expect(JSON.stringify(result.data)).toContain('6.51');
    expect(JSON.stringify(result.data)).toContain('10.22');
    expect(JSON.stringify(result.data)).toContain('4.64');
  });

  it('returns a clear no-data response rather than fabricating local values', async () => {
    const { domainLookup } = await loadDomainLookup();

    const result = await domainLookup('hmo_minimum_room_size', { postcode: 'ZZ1 1ZZ' });

    expect(result.found).toBe(false);
    expect(result.pack).toBe('property-uk');
    expect(result.message).toContain('No static HMO room-size postcode index');
    expect(result.data).toBeUndefined();
  });

  it('falls back to RAG context when no static source matches the key', async () => {
    const rag = [{ id: '1', source: 'guide.md', pack: 'property-uk', content: 'Property guide' }];
    const { domainLookup } = await loadDomainLookup(rag);

    const result = await domainLookup('unknown_property_key', { postcode: 'PO1' });

    expect(result.found).toBe(false);
    expect(result.pack).toBe('none');
    expect(result.relatedRag).toEqual(rag);
  });

  it('exposes the same lookup through the Tool interface', async () => {
    const { domainLookupTool } = await loadDomainLookup();

    const result = await domainLookupTool.execute({
      key: 'hmo_minimum_room_size',
      context: { postcodeArea: 'PO' },
    });

    expect(result).toMatchObject({ found: true, key: 'hmo_minimum_room_size' });
  });
});
