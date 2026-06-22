import type { BrandConfig } from '../product/brand.js';

export type PartnerAccountStatus = 'active' | 'suspended' | 'archived';

export interface PartnerAccount {
  id: string;
  name: string;
  slug: string;
  brand: BrandConfig;
  status: PartnerAccountStatus;
  createdAt: string;
  updatedAt: string;
}

export type CustomDomainTlsStatus = 'pending' | 'active' | 'failed';

export interface CustomDomain {
  id: string;
  hostname: string;
  partnerId: string | null;
  orgId: string | null;
  verifiedAt: string | null;
  tlsStatus: CustomDomainTlsStatus;
  createdAt: string;
}

export interface OrganizationBrandContext {
  orgId: string;
  orgName: string;
  partnerId: string | null;
  orgBrand: BrandConfig;
  partnerBrand?: BrandConfig | null;
}
