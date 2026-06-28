export interface EmailDigest {
  from: string;
  role: string;
  propertyRef: string | null;
  amounts: string[];
  dates: string[];
  summary: string;
  actionRequired: boolean;
  rawText: string;
}

export interface PropreneurPortfolioProperty {
  id: number;
  label: string;
  address_line1: string;
  postcode: string;
  status: string | null;
  monthly_rent: string | number | null;
  epc_expiry: string | null;
}

export interface PropreneurPortfolioResponse {
  total: number;
  properties: PropreneurPortfolioProperty[];
}

export interface PropreneurComplianceItem {
  id: number;
  type: string;
  title: string;
  status: string | null;
  expires_at: string | null;
}

export interface PropreneurBridgeBinding {
  tenantSlug: string;
  apiKey: string;
}

export interface PropreneurProposalResponse {
  proposal_id: number;
  status: string;
  proposal_type?: string;
}
