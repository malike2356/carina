export type CompaniesHouseStatus = {
  ok?: boolean;
  enabled: boolean;
  configured: boolean;
  api_key_set: boolean;
  api_base: string;
  docs: string;
  tools_path?: string;
};

export type CompanySearchHit = {
  company_number: string;
  title?: string | null;
  company_status?: string | null;
  company_type?: string | null;
  date_of_creation?: string | null;
  address_snippet?: string | null;
  description?: string | null;
  public_url?: string | null;
};

export type OfficerSearchHit = {
  officer_id?: string | null;
  name?: string | null;
  description?: string | null;
  appointment_count?: number | null;
  address_snippet?: string | null;
  date_of_birth?: { month?: number; year?: number } | null;
  self?: string | null;
};

export type CompanySearchResult = {
  query: string;
  mode?: 'companies' | 'officers';
  total_results?: number | null;
  items_per_page?: number;
  start_index?: number;
  items: CompanySearchHit[];
};

export type OfficerSearchResult = {
  query: string;
  mode?: 'companies' | 'officers';
  total_results?: number | null;
  items_per_page?: number;
  start_index?: number;
  items: OfficerSearchHit[];
};

export type OfficerAppointmentCompany = {
  company_number?: string | null;
  company_name?: string | null;
  company_status?: string | null;
  officer_role?: string | null;
  appointed_on?: string | null;
  resigned_on?: string | null;
  nationality?: string | null;
  country_of_residence?: string | null;
  occupation?: string | null;
  uri?: string | null;
};

export type OfficerAppointmentsResult = {
  officer_id: string;
  name?: string | null;
  total_results?: number | null;
  returned?: number;
  companies: OfficerAppointmentCompany[];
};

export type CompanyOfficer = {
  name?: string | null;
  officer_role?: string | null;
  appointed_on?: string | null;
  resigned_on?: string | null;
  nationality?: string | null;
  occupation?: string | null;
  country_of_residence?: string | null;
};

export type CompanyProfile = {
  company_number: string;
  company_name?: string | null;
  company_status?: string | null;
  company_status_detail?: string | null;
  type?: string | null;
  date_of_creation?: string | null;
  date_of_cessation?: string | null;
  jurisdiction?: string | null;
  sic_codes?: string[];
  has_been_liquidated?: boolean | null;
  has_insolvency_history?: boolean | null;
  has_charges?: boolean | null;
  registered_office_address?: {
    formatted?: string | null;
    address_line_1?: string | null;
    locality?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
  officers?: CompanyOfficer[];
  public_url?: string | null;
};

async function parseJson<T>(res: Response, fallback: string): Promise<T> {
  const text = await res.text();
  let payload: { error?: string; message?: string } | null = null;
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as { error?: string; message?: string };
    } catch {
      const preview = text.slice(0, 160).replace(/\s+/g, ' ');
      throw new Error(`${fallback} (HTTP ${res.status}, non-JSON): ${preview}`);
    }
  }
  if (!res.ok) {
    throw new Error(payload?.error || payload?.message || `${fallback} (HTTP ${res.status})`);
  }
  if (!payload) {
    throw new Error(`${fallback} returned an empty response`);
  }
  return payload as T;
}

export async function fetchCompaniesHouseStatus(): Promise<CompaniesHouseStatus> {
  return parseJson(await fetch('/api/companies-house/status'), 'Could not load Companies House status');
}

export async function searchCompaniesHouse(
  query: string,
  opts?: { items_per_page?: number; start_index?: number; mode?: 'companies' },
): Promise<CompanySearchResult>;
export async function searchCompaniesHouse(
  query: string,
  opts: { items_per_page?: number; start_index?: number; mode: 'officers' },
): Promise<OfficerSearchResult>;
export async function searchCompaniesHouse(
  query: string,
  opts: { items_per_page?: number; start_index?: number; mode: 'companies' | 'officers' },
): Promise<CompanySearchResult | OfficerSearchResult>;
export async function searchCompaniesHouse(
  query: string,
  opts?: { items_per_page?: number; start_index?: number; mode?: 'companies' | 'officers' },
): Promise<CompanySearchResult | OfficerSearchResult> {
  const params = new URLSearchParams({
    q: query,
    mode: opts?.mode ?? 'companies',
    items_per_page: String(opts?.items_per_page ?? 20),
    start_index: String(opts?.start_index ?? 0),
  });
  return parseJson(
    await fetch(`/api/companies-house/search?${params}`),
    'Companies House search failed',
  );
}

export async function fetchOfficerAppointments(
  officerId: string,
  opts?: { max_items?: number },
): Promise<OfficerAppointmentsResult> {
  const encoded = encodeURIComponent(officerId);
  const params = new URLSearchParams({
    max_items: String(opts?.max_items ?? 50),
  });
  return parseJson(
    await fetch(`/api/companies-house/officers/${encoded}/appointments?${params}`),
    'Could not load officer appointments',
  );
}

export async function fetchCompanyProfile(companyNumber: string): Promise<CompanyProfile> {
  const encoded = encodeURIComponent(companyNumber);
  return parseJson(
    await fetch(`/api/companies-house/company/${encoded}`),
    'Could not load company profile',
  );
}
