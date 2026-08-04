import { Router, type IRouter, type Request, type Response } from 'express';
import {
  CompaniesHouseApiError,
  CompaniesHouseAuthError,
  CompaniesHouseNotFoundError,
  CompaniesHouseRateLimitError,
  companiesHouseConfigHint,
  createCompaniesHouseClient,
  extractOfficerId,
  formatCompactOfficerAppointment,
  formatRegisteredOffice,
  isCompaniesHouseConfigured,
} from '../integrations/companies-house/index.js';

export const companiesHouseRouter: IRouter = Router();

const PUBLIC_COMPANY_BASE = 'https://find-and-update.company-information.service.gov.uk/company';

function sendError(res: Response, err: unknown): void {
  if (err instanceof CompaniesHouseAuthError) {
    res.status(503).json({ error: err.message || companiesHouseConfigHint() });
    return;
  }
  if (err instanceof CompaniesHouseNotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }
  if (err instanceof CompaniesHouseRateLimitError) {
    res.status(429).json({
      error:
        `Companies House rate limit hit${err.retryAfterSeconds != null ? ` (retry after ${err.retryAfterSeconds}s)` : ''}. `
        + 'Pause batch enrich and retry shortly.',
      retry_after_seconds: err.retryAfterSeconds ?? null,
    });
    return;
  }
  if (err instanceof CompaniesHouseApiError) {
    res.status(err.statusCode && err.statusCode >= 400 ? err.statusCode : 502).json({
      error: err.message,
    });
    return;
  }
  res.status(500).json({
    error: err instanceof Error ? err.message : 'Companies House request failed',
  });
}

function clampItems(raw: unknown, fallback = 20): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(100, Math.floor(n));
}

function clampStart(raw: unknown): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function publicCompanyUrl(companyNumber: string): string {
  return `${PUBLIC_COMPANY_BASE}/${encodeURIComponent(companyNumber)}`;
}

companiesHouseRouter.get('/status', (_req: Request, res: Response) => {
  const configured = isCompaniesHouseConfigured();
  res.json({
    ok: true,
    enabled: configured,
    configured,
    api_key_set: configured,
    api_base:
      process.env.COMPANIES_HOUSE_BASE_URL?.trim()
      || 'https://api.company-information.service.gov.uk',
    docs: 'https://developer.company-information.service.gov.uk/',
    tools_path: '/aiva/tools?tool=companies-house',
  });
});

companiesHouseRouter.get('/search', async (req: Request, res: Response) => {
  if (!isCompaniesHouseConfigured()) {
    res.status(503).json({ error: companiesHouseConfigHint() });
    return;
  }
  const q = String(req.query.q ?? '').trim();
  if (!q) {
    res.status(400).json({ error: 'q is required' });
    return;
  }
  const modeRaw = String(req.query.mode ?? req.query.type ?? 'companies').trim().toLowerCase();
  const mode = modeRaw === 'officers' || modeRaw === 'people' || modeRaw === 'person'
    ? 'officers'
    : 'companies';
  try {
    const client = createCompaniesHouseClient();
    const itemsPerPage = clampItems(req.query.items_per_page ?? req.query.itemsPerPage, 20);
    const startIndex = clampStart(req.query.start_index ?? req.query.startIndex);

    if (mode === 'officers') {
      const result = await client.searchOfficers({ q, itemsPerPage, startIndex });
      const items = (result.items ?? []).map((item) => {
        const self = item.links?.self ?? null;
        let officerId: string | null = null;
        if (self) {
          try {
            officerId = extractOfficerId(self);
          } catch {
            officerId = null;
          }
        }
        return {
          officer_id: officerId,
          name: item.title ?? null,
          description: item.description ?? null,
          appointment_count: item.appointment_count ?? null,
          address_snippet: item.address_snippet ?? null,
          date_of_birth: item.date_of_birth ?? null,
          self,
        };
      }).filter((item) => item.officer_id || item.name);

      res.json({
        query: q,
        mode: 'officers',
        total_results: result.total_results ?? items.length,
        items_per_page: result.items_per_page ?? itemsPerPage,
        start_index: result.start_index ?? startIndex,
        items,
      });
      return;
    }

    const result = await client.searchCompanies({ q, itemsPerPage, startIndex });
    const items = (result.items ?? []).map((item) => {
      const companyNumber = (item.company_number ?? '').trim().toUpperCase();
      return {
        company_number: companyNumber,
        title: item.title ?? null,
        company_status: item.company_status ?? null,
        company_type: item.company_type ?? null,
        date_of_creation: item.date_of_creation ?? null,
        address_snippet: item.address_snippet ?? null,
        description: item.description ?? null,
        public_url: companyNumber ? publicCompanyUrl(companyNumber) : null,
      };
    }).filter((item) => item.company_number);

    res.json({
      query: q,
      mode: 'companies',
      total_results: result.total_results ?? items.length,
      items_per_page: result.items_per_page ?? itemsPerPage,
      start_index: result.start_index ?? startIndex,
      items,
    });
  } catch (err) {
    sendError(res, err);
  }
});

companiesHouseRouter.get('/officers/:officerId/appointments', async (req: Request, res: Response) => {
  if (!isCompaniesHouseConfigured()) {
    res.status(503).json({ error: companiesHouseConfigHint() });
    return;
  }
  const officerId = String(req.params.officerId ?? '').trim();
  if (!officerId) {
    res.status(400).json({ error: 'officerId is required' });
    return;
  }
  try {
    const client = createCompaniesHouseClient();
    const maxItems = clampItems(req.query.max_items ?? req.query.maxItems, 50);
    const result = await client.listOfficerAppointmentsUpTo(officerId, maxItems);
    const companies = result.items.map(formatCompactOfficerAppointment);
    res.json({
      officer_id: result.officer_id || extractOfficerId(officerId),
      name: result.name ?? null,
      total_results: result.total_results ?? companies.length,
      returned: companies.length,
      companies,
    });
  } catch (err) {
    sendError(res, err);
  }
});

companiesHouseRouter.get('/company/:companyNumber', async (req: Request, res: Response) => {
  if (!isCompaniesHouseConfigured()) {
    res.status(503).json({ error: companiesHouseConfigHint() });
    return;
  }
  const companyNumber = String(req.params.companyNumber ?? '').trim();
  if (!companyNumber) {
    res.status(400).json({ error: 'companyNumber is required' });
    return;
  }
  try {
    const client = createCompaniesHouseClient();
    const [profile, officers] = await Promise.all([
      client.getCompany(companyNumber),
      client.listOfficersUpTo(companyNumber, 20, 20),
    ]);
    const number = (profile.company_number ?? companyNumber).trim().toUpperCase();
    const office = profile.registered_office_address;
    res.json({
      company_number: number,
      company_name: profile.company_name ?? null,
      company_status: profile.company_status ?? null,
      company_status_detail: null,
      type: profile.type ?? null,
      date_of_creation: profile.date_of_creation ?? null,
      date_of_cessation: null,
      jurisdiction: null,
      sic_codes: profile.sic_codes ?? [],
      has_been_liquidated: profile.has_been_liquidated ?? null,
      has_insolvency_history: null,
      has_charges: null,
      registered_office_address: office
        ? {
            formatted: formatRegisteredOffice(office) ?? null,
            address_line_1: office.address_line_1 ?? null,
            locality: office.locality ?? null,
            postal_code: office.postal_code ?? null,
            country: office.country ?? null,
          }
        : null,
      officers: (officers.items ?? []).map((officer) => ({
        name: officer.name ?? null,
        officer_role: officer.officer_role ?? null,
        appointed_on: officer.appointed_on ?? null,
        resigned_on: officer.resigned_on ?? null,
        nationality: officer.nationality ?? null,
        occupation: officer.occupation ?? null,
        country_of_residence: officer.country_of_residence ?? null,
      })),
      public_url: number ? publicCompanyUrl(number) : null,
    });
  } catch (err) {
    sendError(res, err);
  }
});
