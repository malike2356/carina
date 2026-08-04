import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CompaniesHouseAuthError,
  CompaniesHouseNotFoundError,
  CompaniesHouseRateLimitError,
  buildCompaniesHouseAuthHeader,
  createCompaniesHouseClient,
  resolveCompaniesHouseApiKey,
} from './index.js';

describe('companies-house client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('builds Basic auth with api key as username and empty password', () => {
    const header = buildCompaniesHouseAuthHeader('test-key-123');
    expect(header).toBe(`Basic ${Buffer.from('test-key-123:', 'utf8').toString('base64')}`);
  });

  it('refuses to call when key missing', () => {
    vi.stubEnv('COMPANIES_HOUSE_API_KEY', '');
    expect(() => resolveCompaniesHouseApiKey()).toThrow(CompaniesHouseAuthError);
    expect(() => createCompaniesHouseClient()).toThrow(CompaniesHouseAuthError);
  });

  it('sends auth header and maps 404', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const client = createCompaniesHouseClient({
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(client.getCompany('00000006')).rejects.toBeInstanceOf(CompaniesHouseNotFoundError);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Authorization: buildCompaniesHouseAuthHeader('k'),
    });
  });

  it('retries once on 429 then succeeds', async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('slow down', {
          status: 429,
          headers: { 'Retry-After': '1' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            company_name: 'BROADCASTING HOUSE',
            company_number: '00000006',
            company_status: 'active',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const client = createCompaniesHouseClient({
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
    });
    const profile = await client.getCompany('00000006');
    expect(profile.company_number).toBe('00000006');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it('throws rate limit after retries exhausted', async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi.fn(async () =>
      new Response('rate', {
        status: 429,
        headers: { 'Retry-After': '2' },
      }),
    );
    const client = createCompaniesHouseClient({
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
    });
    await expect(client.searchCompanies({ q: 'BBC' })).rejects.toBeInstanceOf(
      CompaniesHouseRateLimitError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('maps 401 to auth error without leaking key', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 }));
    const client = createCompaniesHouseClient({
      apiKey: 'secret-key-value',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    try {
      await client.searchOfficers({ q: 'Test' });
      expect.fail('expected auth error');
    } catch (err) {
      expect(err).toBeInstanceOf(CompaniesHouseAuthError);
      expect(String(err)).not.toContain('secret-key-value');
    }
  });

  it('searches companies with paging query params', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain('/search/companies');
      expect(url).toContain('q=Acme');
      expect(url).toContain('items_per_page=10');
      expect(url).toContain('start_index=5');
      return new Response(
        JSON.stringify({
          items: [{ company_number: '12345678', title: 'ACME LTD', company_status: 'active' }],
          total_results: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    const client = createCompaniesHouseClient({
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await client.searchCompanies({ q: 'Acme', itemsPerPage: 10, startIndex: 5 });
    expect(result.items?.[0]?.company_number).toBe('12345678');
  });

  it('extracts officer id and lists appointments', async () => {
    const { extractOfficerId } = await import('./client.js');
    expect(extractOfficerId('/officers/abc123XYZ/appointments')).toBe('abc123XYZ');
    expect(extractOfficerId('raw-officer-id')).toBe('raw-officer-id');

    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain('/officers/abc123XYZ/appointments');
      return new Response(
        JSON.stringify({
          name: 'SMITH, Jane',
          total_results: 1,
          items: [
            {
              officer_role: 'director',
              appointed_on: '2020-01-01',
              appointed_to: {
                company_name: 'ACME LTD',
                company_number: '12345678',
                company_status: 'active',
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    const client = createCompaniesHouseClient({
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await client.listOfficerAppointmentsUpTo('/officers/abc123XYZ/appointments', 20);
    expect(result.officer_id).toBe('abc123XYZ');
    expect(result.name).toBe('SMITH, Jane');
    expect(result.items[0]?.appointed_to?.company_number).toBe('12345678');
  });
});
