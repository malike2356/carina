export const COMPANIES_HOUSE_DEFAULT_BASE_URL =
  'https://api.company-information.service.gov.uk';

export type CompaniesHouseAddress = {
  address_line_1?: string;
  address_line_2?: string;
  care_of?: string;
  country?: string;
  locality?: string;
  po_box?: string;
  postal_code?: string;
  premises?: string;
  region?: string;
};

export type CompaniesHouseSearchLinks = {
  self?: string;
};

export type CompaniesHouseCompanySearchItem = {
  company_number?: string;
  title?: string;
  company_status?: string;
  company_type?: string;
  date_of_creation?: string;
  address_snippet?: string;
  description?: string;
  links?: CompaniesHouseSearchLinks;
};

export type CompaniesHouseOfficerSearchItem = {
  title?: string;
  description?: string;
  appointment_count?: number;
  date_of_birth?: { month?: number; year?: number };
  address_snippet?: string;
  links?: {
    self?: string;
  };
};

export type CompaniesHouseSearchResponse<T> = {
  items?: T[];
  items_per_page?: number;
  kind?: string;
  start_index?: number;
  total_results?: number;
};

export type CompaniesHouseCompanyProfile = {
  company_name?: string;
  company_number?: string;
  company_status?: string;
  type?: string;
  date_of_creation?: string;
  sic_codes?: string[];
  registered_office_address?: CompaniesHouseAddress;
  has_been_liquidated?: boolean;
  accounts?: {
    overdue?: boolean;
    next_due?: string;
    last_accounts?: { made_up_to?: string; type?: string };
  };
  links?: {
    self?: string;
    officers?: string;
    persons_with_significant_control?: string;
  };
};

export type CompaniesHouseOfficerItem = {
  name?: string;
  officer_role?: string;
  appointed_on?: string;
  resigned_on?: string;
  nationality?: string;
  country_of_residence?: string;
  occupation?: string;
  links?: {
    officer?: { appointments?: string };
  };
};

export type CompaniesHouseOfficersList = {
  items?: CompaniesHouseOfficerItem[];
  items_per_page?: number;
  start_index?: number;
  total_results?: number;
  active_count?: number;
  resigned_count?: number;
};

export type CompaniesHousePscItem = {
  name?: string;
  kind?: string;
  natures_of_control?: string[];
  notified_on?: string;
  ceased_on?: string;
  nationality?: string;
  country_of_residence?: string;
  identification?: {
    legal_authority?: string;
    legal_form?: string;
    place_registered?: string;
    registration_number?: string;
  };
};

export type CompaniesHousePscList = {
  items?: CompaniesHousePscItem[];
  items_per_page?: number;
  start_index?: number;
  total_results?: number;
  /** Present when the company is exempt or statements apply */
  active_count?: number;
  ceased_count?: number;
};

export type CompaniesHousePageParams = {
  itemsPerPage?: number;
  startIndex?: number;
};

export type CompaniesHouseSearchParams = CompaniesHousePageParams & {
  q: string;
};

export type CompaniesHouseEnrichRecord = {
  company_number: string;
  company_name?: string;
  company_status?: string;
  company_type?: string;
  date_of_creation?: string;
  sic?: string[];
  registered_office?: string;
  officer_names?: string[];
  psc_names?: string[];
  source: 'companies_house';
};
