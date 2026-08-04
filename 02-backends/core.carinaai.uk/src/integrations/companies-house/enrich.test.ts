import { describe, expect, it, vi } from 'vitest';
import {
  createCompaniesHouseClient,
  enrichCompanyFromNumber,
  formatCompactCompanyProfile,
  formatRegisteredOffice,
} from './index.js';

describe('companies-house enrich', () => {
  it('formats registered office without inventing fields', () => {
    expect(
      formatRegisteredOffice({
        address_line_1: '1 Street',
        locality: 'London',
        postal_code: 'W1A 1AA',
      }),
    ).toBe('1 Street, London, W1A 1AA');
    expect(formatRegisteredOffice(undefined)).toBeUndefined();
  });

  it('builds enrich record from profile + officers fixtures', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/officers')) {
        return new Response(
          JSON.stringify({
            items: [
              { name: 'SMITH, Jane', officer_role: 'director', appointed_on: '2020-01-01' },
              { name: 'DOE, John', officer_role: 'secretary', resigned_on: '2021-01-01' },
            ],
            total_results: 2,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/persons-with-significant-control')) {
        return new Response(
          JSON.stringify({
            items: [{ name: 'SMITH, Jane', natures_of_control: ['ownership-of-shares-75-to-100-percent'] }],
            total_results: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          company_name: 'EXAMPLE LTD',
          company_number: '00000006',
          company_status: 'active',
          type: 'ltd',
          date_of_creation: '1900-01-01',
          sic_codes: ['62012'],
          registered_office_address: {
            address_line_1: 'Broadcasting House',
            locality: 'London',
            postal_code: 'W1A 1AA',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const client = createCompaniesHouseClient({
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const record = await enrichCompanyFromNumber(client, '00000006');
    expect(record.source).toBe('companies_house');
    expect(record.company_number).toBe('00000006');
    expect(record.company_status).toBe('active');
    expect(record.sic).toEqual(['62012']);
    expect(record.registered_office).toContain('Broadcasting House');
    expect(record.officer_names).toEqual(['SMITH, Jane']);
    expect(record.psc_names).toEqual(['SMITH, Jane']);

    const compact = formatCompactCompanyProfile({
      company_name: 'EXAMPLE LTD',
      company_number: '00000006',
      company_status: 'active',
      registered_office_address: {
        address_line_1: 'Broadcasting House',
        locality: 'London',
      },
    });
    expect(compact.registered_office).toContain('Broadcasting House');
  });
});
