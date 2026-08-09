import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createCompaniesHouseTools } from './companies-house-tools.js';
import { createCompaniesHouseClient } from '../integrations/companies-house/index.js';

const getWorkerSessionContext = vi.fn();
const workerHasToolGrant = vi.fn();

vi.mock('../workers/worker-session-context.js', () => ({
  getWorkerSessionContext: (...args: unknown[]) => getWorkerSessionContext(...args),
}));

vi.mock('../workers/aiva-parity-store.js', () => ({
  workerHasToolGrant: (...args: unknown[]) => workerHasToolGrant(...args),
}));

describe('companies-house tools', () => {
  beforeEach(() => {
    getWorkerSessionContext.mockReset();
    workerHasToolGrant.mockReset();
    getWorkerSessionContext.mockReturnValue({
      worker: { id: 'w1', workspaceId: 'ws1' },
    });
    workerHasToolGrant.mockResolvedValue(true);
  });

  it('maps search-companies params to client and formats results', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              company_number: '12345678',
              title: 'ACME LTD',
              company_status: 'active',
              company_type: 'ltd',
              date_of_creation: '2010-01-01',
              address_snippet: 'London',
            },
          ],
          total_results: 1,
          start_index: 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const tools = createCompaniesHouseTools('session-1', () =>
      createCompaniesHouseClient({
        apiKey: 'k',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    );
    const search = tools.find((t) => t.name === 'companies-house-search-companies');
    expect(search).toBeTruthy();
    const result = (await search!.execute({ q: 'Acme', itemsPerPage: 5 })) as {
      ok: boolean;
      data: { items: Array<{ company_number: string }>; note: string };
    };
    expect(result.ok).toBe(true);
    expect(result.data.items[0]?.company_number).toBe('12345678');
    expect(result.data.note).toMatch(/does not return marketing emails/i);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('q=Acme');
  });

  it('lists officers with pagination stop', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (!String(url).includes('/officers')) {
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      calls += 1;
      if (calls === 1) {
        return new Response(
          JSON.stringify({
            items: Array.from({ length: 20 }, (_, i) => ({
              name: `Officer ${i}`,
              officer_role: 'director',
              appointed_on: '2020-01-01',
            })),
            total_results: 25,
            items_per_page: 20,
            start_index: 0,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          items: Array.from({ length: 5 }, (_, i) => ({
            name: `Officer ${20 + i}`,
            officer_role: 'director',
          })),
          total_results: 25,
          start_index: 20,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const tools = createCompaniesHouseTools('session-1', () =>
      createCompaniesHouseClient({
        apiKey: 'k',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    );
    const list = tools.find((t) => t.name === 'companies-house-list-officers');
    const result = (await list!.execute({ companyNumber: '00000006', maxItems: 50 })) as {
      ok: boolean;
      data: { returned: number; total_results: number };
    };
    expect(result.ok).toBe(true);
    expect(result.data.returned).toBe(25);
    expect(result.data.total_results).toBe(25);
    expect(calls).toBe(2);
  });

  it('denies when grant missing', async () => {
    workerHasToolGrant.mockResolvedValue(false);
    const tools = createCompaniesHouseTools('session-1', () =>
      createCompaniesHouseClient({ apiKey: 'k', fetchImpl: vi.fn() as unknown as typeof fetch }),
    );
    const search = tools.find((t) => t.name === 'companies-house-search-companies');
    const result = (await search!.execute({ q: 'x' })) as { ok: boolean; error: string };
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/missing Companies House grant/i);
  });
});
