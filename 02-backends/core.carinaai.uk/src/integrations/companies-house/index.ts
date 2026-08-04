export {
  CompaniesHouseClient,
  buildCompaniesHouseAuthHeader,
  companiesHouseConfigHint,
  createCompaniesHouseClient,
  isCompaniesHouseConfigured,
  resolveCompaniesHouseApiKey,
} from './client.js';
export {
  CompaniesHouseApiError,
  CompaniesHouseAuthError,
  CompaniesHouseNotFoundError,
  CompaniesHouseRateLimitError,
} from './errors.js';
export {
  COMPANIES_HOUSE_DEFAULT_ENRICH_BATCH_LIMIT,
  describePscAvailability,
  enrichCompaniesBatch,
  enrichCompanyFromNumber,
  formatCompactCompanyProfile,
  formatCompactCompanySearchItem,
  formatCompactOfficer,
  formatCompactOfficerSearchItem,
  formatCompactPsc,
  formatRegisteredOffice,
} from './enrich.js';
export type {
  CompaniesHouseCompanyProfile,
  CompaniesHouseCompanySearchItem,
  CompaniesHouseEnrichRecord,
  CompaniesHouseOfficerItem,
  CompaniesHouseOfficerSearchItem,
  CompaniesHousePageParams,
  CompaniesHousePscItem,
  CompaniesHouseSearchParams,
} from './types.js';
export { COMPANIES_HOUSE_DEFAULT_BASE_URL } from './types.js';
