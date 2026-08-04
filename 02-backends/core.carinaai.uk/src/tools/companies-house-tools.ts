import type { Tool } from '../types/index.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { workerHasToolGrant } from '../workers/spinnable-parity-store.js';
import {
  CompaniesHouseAuthError,
  CompaniesHouseNotFoundError,
  CompaniesHouseRateLimitError,
  companiesHouseConfigHint,
  createCompaniesHouseClient,
  describePscAvailability,
  formatCompactCompanyProfile,
  formatCompactCompanySearchItem,
  formatCompactOfficer,
  formatCompactOfficerSearchItem,
  formatCompactPsc,
  isCompaniesHouseConfigured,
  type CompaniesHouseClient,
} from '../integrations/companies-house/index.js';

const EMAIL_DISCLAIMER =
  'Companies House does not return marketing emails. Enrich identity here, then use allowed outreach email paths.';

type ClientFactory = () => CompaniesHouseClient;

async function withGrant(
  sessionId: string,
  run: () => Promise<unknown>,
): Promise<unknown> {
  const ctx = getWorkerSessionContext(sessionId);
  if (!ctx) {
    return {
      ok: false,
      error: 'No worker session context; product tools are only available in Aiva worker chat.',
    };
  }
  const allowed = await workerHasToolGrant(
    ctx.worker.workspaceId,
    ctx.worker.id,
    'companies-house',
    'read',
  );
  if (!allowed) {
    return {
      ok: false,
      error:
        'Denied: missing Companies House grant. Open /aiva/tools?tool=companies-house and Grant this Aiva.',
    };
  }
  try {
    const data = await run();
    return { ok: true, data };
  } catch (err) {
    if (err instanceof CompaniesHouseAuthError) {
      return { ok: false, error: err.message || companiesHouseConfigHint() };
    }
    if (err instanceof CompaniesHouseNotFoundError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof CompaniesHouseRateLimitError) {
      return {
        ok: false,
        error:
          `Companies House rate limit hit${err.retryAfterSeconds != null ? ` (retry after ${err.retryAfterSeconds}s)` : ''}. `
          + 'Pause batch enrich and retry shortly.',
      };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function clampItems(value: unknown, fallback = 20): number {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(100, Math.floor(n));
}

function clampStart(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * Chat-callable Companies House tools for a granted worker session.
 * Uses the Core HTTP client (Basic auth, 429 backoff); not http-driver.
 */
export function createCompaniesHouseTools(
  sessionId: string,
  clientFactory: ClientFactory = () => createCompaniesHouseClient(),
): Tool[] {
  return [
    {
      name: 'companies-house-search-companies',
      description:
        'Search the UK Companies House register for companies by name or query. '
        + 'Returns company_number, status, type, address snippet. '
        + EMAIL_DISCLAIMER
        + ' Use for "find UK company", "Companies House search", or similar.',
      parameters: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Search query (company name or keywords)' },
          itemsPerPage: { type: 'number', description: 'Results per page (1-100, default 20)' },
          startIndex: { type: 'number', description: 'Pagination start index (default 0)' },
        },
        required: ['q'],
      },
      execute: async (params) => {
        const q = String(params.q ?? '').trim();
        if (!q) return { ok: false, error: 'q is required' };
        return withGrant(sessionId, async () => {
          const client = clientFactory();
          const result = await client.searchCompanies({
            q,
            itemsPerPage: clampItems(params.itemsPerPage),
            startIndex: clampStart(params.startIndex),
          });
          const items = (result.items ?? []).slice(0, 25).map(formatCompactCompanySearchItem);
          return {
            total_results: result.total_results ?? items.length,
            start_index: result.start_index ?? 0,
            items,
            note: EMAIL_DISCLAIMER,
          };
        });
      },
    },
    {
      name: 'companies-house-search-officers',
      description:
        'Search Companies House for officers (people) by name. '
        + 'Does not invent appointments or emails. '
        + EMAIL_DISCLAIMER,
      parameters: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Officer name query' },
          itemsPerPage: { type: 'number', description: 'Results per page (1-100, default 20)' },
          startIndex: { type: 'number', description: 'Pagination start index (default 0)' },
        },
        required: ['q'],
      },
      execute: async (params) => {
        const q = String(params.q ?? '').trim();
        if (!q) return { ok: false, error: 'q is required' };
        return withGrant(sessionId, async () => {
          const client = clientFactory();
          const result = await client.searchOfficers({
            q,
            itemsPerPage: clampItems(params.itemsPerPage),
            startIndex: clampStart(params.startIndex),
          });
          const items = (result.items ?? []).slice(0, 25).map(formatCompactOfficerSearchItem);
          return {
            total_results: result.total_results ?? items.length,
            start_index: result.start_index ?? 0,
            items,
            note: EMAIL_DISCLAIMER,
          };
        });
      },
    },
    {
      name: 'companies-house-get-company',
      description:
        'Get a Companies House company profile by company number (status, SIC, registered office). '
        + EMAIL_DISCLAIMER,
      parameters: {
        type: 'object',
        properties: {
          companyNumber: { type: 'string', description: 'UK company number (e.g. 00000006)' },
        },
        required: ['companyNumber'],
      },
      execute: async (params) => {
        const companyNumber = String(params.companyNumber ?? '').trim();
        if (!companyNumber) return { ok: false, error: 'companyNumber is required' };
        return withGrant(sessionId, async () => {
          const profile = await clientFactory().getCompany(companyNumber);
          return formatCompactCompanyProfile(profile);
        });
      },
    },
    {
      name: 'companies-house-list-officers',
      description:
        'List officers for a company number (name, role, appointed/resigned dates). '
        + 'Paginates up to a safe max (default 50). Never invents missing fields.',
      parameters: {
        type: 'object',
        properties: {
          companyNumber: { type: 'string', description: 'UK company number' },
          maxItems: { type: 'number', description: 'Max officers to return (default 50, max 100)' },
        },
        required: ['companyNumber'],
      },
      execute: async (params) => {
        const companyNumber = String(params.companyNumber ?? '').trim();
        if (!companyNumber) return { ok: false, error: 'companyNumber is required' };
        const maxItems = Math.min(100, Math.max(1, Number(params.maxItems ?? 50) || 50));
        return withGrant(sessionId, async () => {
          const { items, total_results } = await clientFactory().listOfficersUpTo(
            companyNumber,
            maxItems,
          );
          return {
            company_number: companyNumber.toUpperCase(),
            total_results: total_results ?? items.length,
            returned: items.length,
            items: items.map(formatCompactOfficer),
          };
        });
      },
    },
    {
      name: 'companies-house-list-psc',
      description:
        'List persons with significant control (PSC) for a company number. '
        + 'Returns a clear none/protected message when the list is empty.',
      parameters: {
        type: 'object',
        properties: {
          companyNumber: { type: 'string', description: 'UK company number' },
          maxItems: { type: 'number', description: 'Max PSC records (default 50)' },
        },
        required: ['companyNumber'],
      },
      execute: async (params) => {
        const companyNumber = String(params.companyNumber ?? '').trim();
        if (!companyNumber) return { ok: false, error: 'companyNumber is required' };
        const maxItems = Math.min(100, Math.max(1, Number(params.maxItems ?? 50) || 50));
        return withGrant(sessionId, async () => {
          try {
            const { items, total_results } = await clientFactory().listPscUpTo(
              companyNumber,
              maxItems,
            );
            return {
              company_number: companyNumber.toUpperCase(),
              availability: describePscAvailability({ items, total_results }),
              total_results: total_results ?? items.length,
              items: items.map(formatCompactPsc),
            };
          } catch (err) {
            if (err instanceof CompaniesHouseNotFoundError) {
              return {
                company_number: companyNumber.toUpperCase(),
                availability: 'PSC list not available (none published, exempt, or protected).',
                total_results: 0,
                items: [],
              };
            }
            throw err;
          }
        });
      },
    },
  ];
}

export function companiesHouseToolsReadyHint(): string {
  if (!isCompaniesHouseConfigured()) return companiesHouseConfigHint();
  return 'Companies House platform key is set. Grant the tool on /aiva/tools?tool=companies-house.';
}
