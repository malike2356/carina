import {
  CompaniesHouseApiError,
  CompaniesHouseAuthError,
  CompaniesHouseNotFoundError,
  CompaniesHouseRateLimitError,
} from './errors.js';
import {
  COMPANIES_HOUSE_DEFAULT_BASE_URL,
  type CompaniesHouseCompanyProfile,
  type CompaniesHouseCompanySearchItem,
  type CompaniesHouseOfficerItem,
  type CompaniesHouseOfficerSearchItem,
  type CompaniesHouseOfficersList,
  type CompaniesHousePageParams,
  type CompaniesHousePscItem,
  type CompaniesHousePscList,
  type CompaniesHouseSearchParams,
  type CompaniesHouseSearchResponse,
} from './types.js';

const MAX_429_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 15_000;

export type CompaniesHouseClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isCompaniesHouseConfigured(apiKey = process.env.COMPANIES_HOUSE_API_KEY): boolean {
  return Boolean(apiKey?.trim());
}

export function companiesHouseConfigHint(): string {
  return [
    'Companies House is not configured.',
    'Ops: set COMPANIES_HOUSE_API_KEY from https://developer.company-information.service.gov.uk/ (API Key app),',
    'store under .access/, inject into Core env, then grant Companies House on /aiva/tools?tool=companies-house.',
    'Optional BYOK: configure integration:companies-house or paste a vault key on Tools.',
  ].join(' ');
}

export function resolveCompaniesHouseApiKey(explicit?: string): string {
  const key = (explicit ?? process.env.COMPANIES_HOUSE_API_KEY ?? '').trim();
  if (!key) {
    throw new CompaniesHouseAuthError(companiesHouseConfigHint());
  }
  return key;
}

export function buildCompaniesHouseAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`, 'utf8').toString('base64')}`;
}

function clampPageSize(itemsPerPage?: number): number {
  const n = Number(itemsPerPage ?? 20);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(100, Math.floor(n));
}

function clampStartIndex(startIndex?: number): number {
  const n = Number(startIndex ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function parseRetryAfterSeconds(header: string | null): number | undefined {
  if (!header) return undefined;
  const asInt = Number.parseInt(header, 10);
  if (Number.isFinite(asInt) && asInt >= 0) return asInt;
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) {
    const seconds = Math.ceil((asDate - Date.now()) / 1000);
    return seconds > 0 ? seconds : 0;
  }
  return undefined;
}

function normalizeCompanyNumber(companyNumber: string): string {
  return companyNumber.trim().toUpperCase().replace(/\s+/g, '');
}

export class CompaniesHouseClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: CompaniesHouseClientOptions = {}) {
    this.apiKey = resolveCompaniesHouseApiKey(options.apiKey);
    const rawBase = (options.baseUrl ?? process.env.COMPANIES_HOUSE_BASE_URL ?? COMPANIES_HOUSE_DEFAULT_BASE_URL)
      .trim()
      .replace(/\/+$/, '');
    if (!rawBase.startsWith('https://')) {
      throw new CompaniesHouseApiError('Companies House base URL must use https://');
    }
    this.baseUrl = rawBase;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
  }

  private async request<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === '') continue;
        url.searchParams.set(key, String(value));
      }
    }

    const logPath = `${url.pathname}${url.search}`;
    let attempt = 0;
    while (true) {
      const response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: buildCompaniesHouseAuthHeader(this.apiKey),
        },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      console.info(`[companies-house] GET ${logPath} -> ${response.status}`);

      if (response.status === 429) {
        const retryAfter = parseRetryAfterSeconds(response.headers.get('Retry-After'));
        if (attempt < MAX_429_RETRIES) {
          const waitSeconds = retryAfter ?? 2;
          await this.sleep(Math.max(0, waitSeconds) * 1000);
          attempt += 1;
          continue;
        }
        throw new CompaniesHouseRateLimitError(
          `Companies House rate limit exceeded for ${logPath}`,
          retryAfter,
        );
      }

      if (response.status === 401 || response.status === 403) {
        throw new CompaniesHouseAuthError(
          'Companies House rejected the API key. Open /aiva/tools?tool=companies-house '
          + 'or ask ops to rotate COMPANIES_HOUSE_API_KEY (do not paste keys into chat).',
        );
      }

      if (response.status === 404) {
        throw new CompaniesHouseNotFoundError(`Companies House not found: ${logPath}`);
      }

      if (!response.ok) {
        let detail = response.statusText;
        try {
          const body = (await response.json()) as { error?: string; message?: string };
          detail = body.message ?? body.error ?? detail;
        } catch {
          /* ignore body parse */
        }
        throw new CompaniesHouseApiError(`Companies House HTTP ${response.status}: ${detail}`, response.status);
      }

      return (await response.json()) as T;
    }
  }

  searchCompanies(params: CompaniesHouseSearchParams): Promise<CompaniesHouseSearchResponse<CompaniesHouseCompanySearchItem>> {
    const q = params.q.trim();
    if (!q) throw new CompaniesHouseApiError('q is required for company search');
    return this.request('/search/companies', {
      q,
      items_per_page: clampPageSize(params.itemsPerPage),
      start_index: clampStartIndex(params.startIndex),
    });
  }

  searchOfficers(params: CompaniesHouseSearchParams): Promise<CompaniesHouseSearchResponse<CompaniesHouseOfficerSearchItem>> {
    const q = params.q.trim();
    if (!q) throw new CompaniesHouseApiError('q is required for officer search');
    return this.request('/search/officers', {
      q,
      items_per_page: clampPageSize(params.itemsPerPage),
      start_index: clampStartIndex(params.startIndex),
    });
  }

  getCompany(companyNumber: string): Promise<CompaniesHouseCompanyProfile> {
    const number = normalizeCompanyNumber(companyNumber);
    if (!number) throw new CompaniesHouseApiError('companyNumber is required');
    return this.request(`/company/${encodeURIComponent(number)}`);
  }

  listOfficers(
    companyNumber: string,
    params: CompaniesHousePageParams = {},
  ): Promise<CompaniesHouseOfficersList> {
    const number = normalizeCompanyNumber(companyNumber);
    if (!number) throw new CompaniesHouseApiError('companyNumber is required');
    return this.request(`/company/${encodeURIComponent(number)}/officers`, {
      items_per_page: clampPageSize(params.itemsPerPage),
      start_index: clampStartIndex(params.startIndex),
    });
  }

  listPsc(
    companyNumber: string,
    params: CompaniesHousePageParams = {},
  ): Promise<CompaniesHousePscList> {
    const number = normalizeCompanyNumber(companyNumber);
    if (!number) throw new CompaniesHouseApiError('companyNumber is required');
    return this.request(
      `/company/${encodeURIComponent(number)}/persons-with-significant-control`,
      {
        items_per_page: clampPageSize(params.itemsPerPage),
        start_index: clampStartIndex(params.startIndex),
      },
    );
  }

  /**
   * Paginate officers until maxItems or total_results. Default max 50.
   */
  async listOfficersUpTo(
    companyNumber: string,
    maxItems = 50,
    pageSize = 35,
  ): Promise<{ items: CompaniesHouseOfficerItem[]; total_results?: number }> {
    const items: CompaniesHouseOfficerItem[] = [];
    let startIndex = 0;
    let total: number | undefined;
    const cap = Math.max(1, Math.min(200, Math.floor(maxItems)));
    const size = clampPageSize(pageSize);

    while (items.length < cap) {
      const page = await this.listOfficers(companyNumber, {
        itemsPerPage: size,
        startIndex,
      });
      total = page.total_results;
      const batch = page.items ?? [];
      if (batch.length === 0) break;
      items.push(...batch);
      startIndex += batch.length;
      if (typeof total === 'number' && startIndex >= total) break;
      if (batch.length < size && typeof total !== 'number') break;
    }

    return { items: items.slice(0, cap), total_results: total };
  }

  async listPscUpTo(
    companyNumber: string,
    maxItems = 50,
    pageSize = 35,
  ): Promise<{ items: CompaniesHousePscItem[]; total_results?: number }> {
    const items: CompaniesHousePscItem[] = [];
    let startIndex = 0;
    let total: number | undefined;
    const cap = Math.max(1, Math.min(200, Math.floor(maxItems)));
    const size = clampPageSize(pageSize);

    while (items.length < cap) {
      const page = await this.listPsc(companyNumber, {
        itemsPerPage: size,
        startIndex,
      });
      total = page.total_results;
      const batch = page.items ?? [];
      if (batch.length === 0) break;
      items.push(...batch);
      startIndex += batch.length;
      if (typeof total === 'number' && startIndex >= total) break;
      if (batch.length < size && typeof total !== 'number') break;
    }

    return { items: items.slice(0, cap), total_results: total };
  }
}

export function createCompaniesHouseClient(options?: CompaniesHouseClientOptions): CompaniesHouseClient {
  return new CompaniesHouseClient(options);
}
