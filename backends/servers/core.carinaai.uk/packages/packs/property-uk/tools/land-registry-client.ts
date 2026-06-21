import { config } from '#core/config/index.js';

function propertyDataBaseUrl(): string {
  return String(config.landRegistry.baseUrl || 'https://api.propertydata.co.uk').replace(/\/$/, '');
}

export type LandRegistryProvider = 'propertydata';

export function landRegistryProvider(): LandRegistryProvider {
  return 'propertydata';
}

export function resolveLandRegistryApiKey(): string {
  return config.landRegistry.apiKey.trim() || config.propertyData.apiKey.trim();
}

export function isLandRegistryConfigured(): boolean {
  return resolveLandRegistryApiKey().length > 0;
}

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

export function normaliseUkPostcode(input: string): string {
  const match = input.trim().toUpperCase().match(UK_POSTCODE_RE);
  if (!match?.[1]) return input.trim().toUpperCase();
  const compact = match[1].replace(/\s+/g, '');
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function extractUkPostcode(input: string): string | null {
  const match = input.trim().match(UK_POSTCODE_RE);
  return match?.[1] ? normaliseUkPostcode(match[1]) : null;
}

export function isUkPostcode(input: string): boolean {
  const compact = input.trim().replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact);
}

async function propertyDataGet(
  endpoint: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const apiKey = resolveLandRegistryApiKey();
  if (!apiKey) {
    return {
      status: 'error',
      message: 'LAND_REGISTRY_API_KEY or PROPERTY_DATA_API_KEY is not configured.',
    };
  }

  const url = new URL(`${propertyDataBaseUrl()}/${endpoint.replace(/^\//, '')}`);
  url.searchParams.set('key', apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value.trim()) url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  let body: Record<string, unknown>;
  try {
    body = await response.json() as Record<string, unknown>;
  } catch {
    return {
      status: 'error',
      message: `PropertyData API returned non-JSON (${response.status}).`,
    };
  }

  if (!response.ok) {
    return {
      status: 'error',
      message: typeof body.message === 'string'
        ? body.message
        : `PropertyData API error: ${response.status} ${response.statusText}`,
      httpStatus: response.status,
      data: body,
    };
  }

  return body;
}

export async function lookupTitle(titleNumber: string): Promise<Record<string, unknown>> {
  const title = titleNumber.trim().toUpperCase();
  if (!title) {
    return { status: 'error', message: 'Title number is required.' };
  }
  const data = await propertyDataGet('title', { title });
  return { searchType: 'title', query: title, provider: landRegistryProvider(), ...data };
}

export async function lookupFreeholdsByPostcode(postcode: string): Promise<Record<string, unknown>> {
  const pc = normaliseUkPostcode(postcode);
  if (!isUkPostcode(pc)) {
    return { status: 'error', message: 'A valid UK postcode is required for freehold title search.' };
  }
  const data = await propertyDataGet('freeholds', { postcode: pc });
  return { searchType: 'postcode', query: pc, provider: landRegistryProvider(), ...data };
}

export async function lookupUprnTitle(uprn: string): Promise<Record<string, unknown>> {
  const digits = uprn.replace(/\D/g, '');
  if (!digits) {
    return { status: 'error', message: 'UPRN is required.' };
  }
  const data = await propertyDataGet('uprn-title', { uprn: digits });
  return { uprn: digits, provider: landRegistryProvider(), ...data };
}

export async function lookupByAddress(address: string): Promise<Record<string, unknown>> {
  const trimmed = address.trim();
  if (trimmed.length < 8) {
    return { status: 'error', message: 'Provide a full UK address including postcode.' };
  }

  const postcodeOnly = extractUkPostcode(trimmed);
  if (postcodeOnly && trimmed.replace(/\s+/g, '').toUpperCase() === postcodeOnly.replace(/\s+/g, '')) {
    return lookupFreeholdsByPostcode(postcodeOnly);
  }

  const match = await propertyDataGet('address-match-uprn', { address: trimmed });
  if (match.status === 'error') {
    return { searchType: 'address', query: trimmed, provider: landRegistryProvider(), ...match };
  }

  const uprn = String(
    (match.data as Record<string, unknown> | undefined)?.uprn
    ?? (match as Record<string, unknown>).uprn
    ?? '',
  ).replace(/\D/g, '');

  if (!uprn) {
    return {
      searchType: 'address',
      query: trimmed,
      provider: landRegistryProvider(),
      status: match.status ?? 'success',
      addressMatch: match,
      message: 'Address matched but no UPRN was returned. Try refining the address or search by postcode.',
    };
  }

  const titleLookup = await lookupUprnTitle(uprn);
  return {
    searchType: 'address',
    query: trimmed,
    provider: landRegistryProvider(),
    addressMatch: match,
    titleLookup,
  };
}

export async function runLandRegistrySearch(
  query: string,
  searchType: 'address' | 'title' | 'postcode',
): Promise<Record<string, unknown>> {
  const q = query.trim();
  if (!q) {
    return { status: 'error', message: 'Query is required.' };
  }

  if (searchType === 'title') {
    return lookupTitle(q);
  }

  if (searchType === 'postcode' || isUkPostcode(q)) {
    return lookupFreeholdsByPostcode(q);
  }

  return lookupByAddress(q);
}
