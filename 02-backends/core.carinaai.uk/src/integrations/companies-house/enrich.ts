import type { CompaniesHouseClient } from './client.js';
import type {
  CompaniesHouseAddress,
  CompaniesHouseCompanyProfile,
  CompaniesHouseCompanySearchItem,
  CompaniesHouseEnrichRecord,
  CompaniesHouseOfficerItem,
  CompaniesHousePscItem,
} from './types.js';

export const COMPANIES_HOUSE_DEFAULT_ENRICH_BATCH_LIMIT = 20;

export function formatRegisteredOffice(address?: CompaniesHouseAddress): string | undefined {
  if (!address) return undefined;
  const parts = [
    address.care_of,
    address.premises,
    address.address_line_1,
    address.address_line_2,
    address.locality,
    address.region,
    address.postal_code,
    address.country,
  ]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

export function formatCompactCompanySearchItem(item: CompaniesHouseCompanySearchItem) {
  return {
    company_number: item.company_number ?? null,
    title: item.title ?? null,
    company_status: item.company_status ?? null,
    company_type: item.company_type ?? null,
    date_of_creation: item.date_of_creation ?? null,
    address_snippet: item.address_snippet ?? null,
    uri: item.company_number
      ? `https://find-and-update.company-information.service.gov.uk/company/${item.company_number}`
      : item.links?.self
        ? `https://find-and-update.company-information.service.gov.uk${item.links.self}`
        : null,
  };
}

export function formatCompactOfficerSearchItem(item: {
  title?: string;
  description?: string;
  appointment_count?: number;
  address_snippet?: string;
  links?: { self?: string };
}) {
  return {
    name: item.title ?? null,
    description: item.description ?? null,
    appointment_count: item.appointment_count ?? null,
    address_snippet: item.address_snippet ?? null,
    self: item.links?.self ?? null,
  };
}

export function formatCompactCompanyProfile(profile: CompaniesHouseCompanyProfile) {
  return {
    company_name: profile.company_name ?? null,
    company_number: profile.company_number ?? null,
    company_status: profile.company_status ?? null,
    company_type: profile.type ?? null,
    date_of_creation: profile.date_of_creation ?? null,
    sic_codes: profile.sic_codes ?? [],
    registered_office: formatRegisteredOffice(profile.registered_office_address) ?? null,
    has_been_liquidated: profile.has_been_liquidated ?? null,
    accounts_overdue: profile.accounts?.overdue ?? null,
  };
}

export function formatCompactOfficer(item: CompaniesHouseOfficerItem) {
  return {
    name: item.name ?? null,
    officer_role: item.officer_role ?? null,
    appointed_on: item.appointed_on ?? null,
    resigned_on: item.resigned_on ?? null,
    nationality: item.nationality ?? null,
    country_of_residence: item.country_of_residence ?? null,
  };
}

export function formatCompactPsc(item: CompaniesHousePscItem) {
  return {
    name: item.name ?? null,
    kind: item.kind ?? null,
    natures_of_control: item.natures_of_control ?? [],
    notified_on: item.notified_on ?? null,
    ceased_on: item.ceased_on ?? null,
    nationality: item.nationality ?? null,
    country_of_residence: item.country_of_residence ?? null,
  };
}

export function describePscAvailability(input: {
  items: CompaniesHousePscItem[];
  total_results?: number;
  httpNote?: string;
}): string {
  if (input.httpNote) return input.httpNote;
  if (input.items.length === 0) {
    return 'No persons with significant control listed (or statements / protected records apply).';
  }
  const total = input.total_results ?? input.items.length;
  return `${input.items.length} PSC record(s) returned${typeof total === 'number' ? ` of ${total}` : ''}.`;
}

/**
 * Normalised enrich record for outreach sheet columns (source=companies_house).
 * Does not invent emails; CH does not reliably provide prospect emails.
 */
export async function enrichCompanyFromNumber(
  client: CompaniesHouseClient,
  companyNumber: string,
  opts?: { maxOfficers?: number; includePsc?: boolean },
): Promise<CompaniesHouseEnrichRecord> {
  const profile = await client.getCompany(companyNumber);
  const officers = await client.listOfficersUpTo(companyNumber, opts?.maxOfficers ?? 50);
  const activeOfficers = officers.items.filter((o) => !o.resigned_on);
  const officerNames = (activeOfficers.length > 0 ? activeOfficers : officers.items)
    .map((o) => o.name?.trim())
    .filter((name): name is string => Boolean(name));

  let pscNames: string[] | undefined;
  if (opts?.includePsc !== false) {
    try {
      const psc = await client.listPscUpTo(companyNumber, 25);
      pscNames = psc.items
        .map((p) => p.name?.trim())
        .filter((name): name is string => Boolean(name));
    } catch {
      pscNames = undefined;
    }
  }

  return {
    company_number: profile.company_number ?? companyNumber.trim().toUpperCase(),
    company_name: profile.company_name,
    company_status: profile.company_status,
    company_type: profile.type,
    date_of_creation: profile.date_of_creation,
    sic: profile.sic_codes ?? [],
    registered_office: formatRegisteredOffice(profile.registered_office_address),
    officer_names: officerNames,
    psc_names: pscNames,
    source: 'companies_house',
  };
}

/**
 * Batch enrich with headroom under the 600 req / 5 min Companies House limit.
 * Default max 20 companies per owner instruction.
 */
export async function enrichCompaniesBatch(
  client: CompaniesHouseClient,
  companyNumbers: string[],
  opts?: {
    maxCompanies?: number;
    delayMsBetween?: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<{ records: CompaniesHouseEnrichRecord[]; skipped: number }> {
  const max = opts?.maxCompanies ?? COMPANIES_HOUSE_DEFAULT_ENRICH_BATCH_LIMIT;
  const delayMs = opts?.delayMsBetween ?? 250;
  const sleep = opts?.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const slice = companyNumbers.map((n) => n.trim()).filter(Boolean).slice(0, max);
  const skipped = Math.max(0, companyNumbers.length - slice.length);
  const records: CompaniesHouseEnrichRecord[] = [];

  for (let i = 0; i < slice.length; i += 1) {
    records.push(await enrichCompanyFromNumber(client, slice[i]!));
    if (i < slice.length - 1 && delayMs > 0) await sleep(delayMs);
  }

  return { records, skipped };
}
