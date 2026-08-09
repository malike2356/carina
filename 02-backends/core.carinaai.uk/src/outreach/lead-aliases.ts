/**
 * Column alias map for the SEO lead workbook (17 columns) and common lead sheets.
 * Unknown columns are preserved in customFields by the ingest service.
 */

export const REFERENCE_WORKBOOK_COLUMNS = [
  'company',
  'niche',
  'townCity',
  'website',
  'contactName',
  'email',
  'phone',
  'googleReviews',
  'googleRating',
  'googleMapsUrl',
  'websiteScore',
  'ranksTop3',
  'weakness',
  'priority',
  'status',
  'dateAdded',
  'notes',
] as const;

export type ReferenceWorkbookColumn = (typeof REFERENCE_WORKBOOK_COLUMNS)[number];

/** Map normalized header keys → canonical field names. */
export const LEAD_COLUMN_ALIASES: Record<string, string> = {
  company: 'company',
  business: 'company',
  business_name: 'company',
  businessname: 'company',
  organisation: 'company',
  organization: 'company',
  org: 'company',
  firm: 'company',

  niche: 'niche',
  sector: 'niche',
  industry: 'niche',
  category: 'niche',
  vertical: 'niche',

  towncity: 'townCity',
  town_city: 'townCity',
  'town/city': 'townCity',
  town: 'townCity',
  city: 'townCity',
  location: 'townCity',
  locality: 'townCity',
  area: 'townCity',

  website: 'website',
  url: 'website',
  web: 'website',
  site: 'website',
  homepage: 'website',
  domain: 'website',

  contactname: 'contactName',
  contact_name: 'contactName',
  contact: 'contactName',
  name: 'contactName',
  full_name: 'contactName',
  fullname: 'contactName',
  person: 'contactName',

  email: 'email',
  e_mail: 'email',
  email_address: 'email',
  mail: 'email',

  phone: 'phone',
  telephone: 'phone',
  mobile: 'phone',
  tel: 'phone',
  phone_number: 'phone',

  googlereviews: 'googleReviews',
  google_reviews: 'googleReviews',
  reviews: 'googleReviews',
  review_count: 'googleReviews',

  googlerating: 'googleRating',
  google_rating: 'googleRating',
  rating: 'googleRating',
  stars: 'googleRating',

  googlemapsurl: 'googleMapsUrl',
  google_maps_url: 'googleMapsUrl',
  maps_url: 'googleMapsUrl',
  google_maps: 'googleMapsUrl',
  maps: 'googleMapsUrl',

  websitescore: 'websiteScore',
  website_score: 'websiteScore',
  website_score_110: 'websiteScore',
  website_score_1_10: 'websiteScore',
  score: 'websiteScore',
  seo_score: 'websiteScore',

  rankstop3: 'ranksTop3',
  ranks_top3: 'ranksTop3',
  'ranks_top3?': 'ranksTop3',
  ranks_top_3: 'ranksTop3',
  top3: 'ranksTop3',

  weakness: 'weakness',
  weaknesses: 'weakness',
  gap: 'weakness',
  opportunity: 'weakness',

  priority: 'priority',
  prio: 'priority',
  urgency: 'priority',

  status: 'status',
  stage: 'status',
  pipeline_stage: 'pipelineStage',
  pipelinestage: 'pipelineStage',

  dateadded: 'dateAdded',
  date_added: 'dateAdded',
  added: 'dateAdded',
  created: 'dateAdded',
  created_at: 'dateAdded',

  notes: 'notes',
  note: 'notes',
  comment: 'notes',
  comments: 'notes',

  source: 'sourceType',
  source_type: 'sourceType',
  sourcetype: 'sourceType',
  source_name: 'sourceName',
  sourcename: 'sourceName',
  source_url: 'sourceUrl',
  sourceurl: 'sourceUrl',
  company_number: 'companyNumber',
  companynumber: 'companyNumber',
};

export function normalizeHeaderKey(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[\s\-]+/g, '_')
    .replace(/[^\w/?]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function resolveCanonicalField(header: string): string | null {
  const key = normalizeHeaderKey(header);
  if (!key) return null;
  if (LEAD_COLUMN_ALIASES[key]) return LEAD_COLUMN_ALIASES[key];
  // Try without underscores for "Town/City" style
  const compact = key.replace(/_/g, '');
  if (LEAD_COLUMN_ALIASES[compact]) return LEAD_COLUMN_ALIASES[compact];
  return null;
}

export function mapRowAliases(
  row: Record<string, unknown>,
): { canonical: Record<string, unknown>; customFields: Record<string, unknown> } {
  const canonical: Record<string, unknown> = {};
  const customFields: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(row)) {
    if (value === undefined || value === null) continue;
    const text = typeof value === 'string' ? value.trim() : value;
    if (text === '') continue;
    const field = resolveCanonicalField(rawKey);
    if (field) {
      if (canonical[field] === undefined || canonical[field] === '') {
        canonical[field] = text;
      }
    } else {
      customFields[rawKey] = text;
    }
  }
  return { canonical, customFields };
}
