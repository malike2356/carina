import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { companiesHouseRouter } from './companies-house-api.js';

vi.mock('../integrations/companies-house/index.js', async () => {
  const actual = await vi.importActual<typeof import('../integrations/companies-house/index.js')>(
    '../integrations/companies-house/index.js',
  );
  return {
    ...actual,
    isCompaniesHouseConfigured: vi.fn(() => true),
    createCompaniesHouseClient: vi.fn(() => ({
      searchCompanies: vi.fn(async () => ({
        total_results: 1,
        items_per_page: 20,
        start_index: 0,
        items: [
          {
            company_number: '00000006',
            title: 'TEST COMPANY',
            company_status: 'active',
            company_type: 'ltd',
            date_of_creation: '1862-07-17',
            address_snippet: 'London',
          },
        ],
      })),
      getCompany: vi.fn(async () => ({
        company_name: 'TEST COMPANY',
        company_number: '00000006',
        company_status: 'active',
        type: 'ltd',
        date_of_creation: '1862-07-17',
        sic_codes: ['62012'],
        registered_office_address: {
          address_line_1: '1 Test Street',
          locality: 'London',
          postal_code: 'EC1A 1BB',
          country: 'England',
        },
      })),
      listOfficersUpTo: vi.fn(async () => ({
        items: [
          {
            name: 'SMITH, Jane',
            officer_role: 'director',
            appointed_on: '2020-01-01',
          },
        ],
        total_results: 1,
      })),
    })),
  };
});

function makeApp() {
  const app = express();
  app.use('/api/companies-house', companiesHouseRouter);
  return app;
}

describe('companiesHouseRouter', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns status when configured', async () => {
    const app = makeApp();
    const res = await new Promise<{ status: number; body: Record<string, unknown> }>((resolve) => {
      const server = app.listen(0, async () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        const response = await fetch(`http://127.0.0.1:${port}/api/companies-house/status`);
        const body = (await response.json()) as Record<string, unknown>;
        server.close();
        resolve({ status: response.status, body });
      });
    });
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(true);
    expect(res.body.enabled).toBe(true);
  });

  it('searches companies', async () => {
    const app = makeApp();
    const res = await new Promise<{ status: number; body: Record<string, unknown> }>((resolve) => {
      const server = app.listen(0, async () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        const response = await fetch(
          `http://127.0.0.1:${port}/api/companies-house/search?q=test`,
        );
        const body = (await response.json()) as Record<string, unknown>;
        server.close();
        resolve({ status: response.status, body });
      });
    });
    expect(res.status).toBe(200);
    expect(res.body.query).toBe('test');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect((res.body.items as Array<Record<string, unknown>>)[0].company_number).toBe('00000006');
  });

  it('loads company profile with officers', async () => {
    const app = makeApp();
    const res = await new Promise<{ status: number; body: Record<string, unknown> }>((resolve) => {
      const server = app.listen(0, async () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        const response = await fetch(
          `http://127.0.0.1:${port}/api/companies-house/company/00000006`,
        );
        const body = (await response.json()) as Record<string, unknown>;
        server.close();
        resolve({ status: response.status, body });
      });
    });
    expect(res.status).toBe(200);
    expect(res.body.company_number).toBe('00000006');
    expect(Array.isArray(res.body.officers)).toBe(true);
  });
});
