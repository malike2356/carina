import type { DataTier, ResidencyConfig, ResidencyMode } from './types.js';

const EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

const REGION_STORAGE_MAP: Record<string, ResidencyConfig['storage']> = {
  'eu-west': {
    postgresRegion: 'eu-west-1',
    objectStoreRegion: 'eu-west-1',
    kmsRegion: 'eu-west-1',
  },
  'us-east': {
    postgresRegion: 'us-east-1',
    objectStoreRegion: 'us-east-1',
    kmsRegion: 'us-east-1',
  },
  'ap-southeast': {
    postgresRegion: 'ap-southeast-1',
    objectStoreRegion: 'ap-southeast-1',
    kmsRegion: 'ap-southeast-1',
  },
};

export function loadResidencyConfig(): ResidencyConfig {
  const region = process.env.DATA_RESIDENCY_REGION?.trim() || 'eu-west';
  const mode = (process.env.DATA_RESIDENCY_MODE?.trim() || 'strict') as ResidencyMode;
  const encryption = process.env.DATA_RESIDENCY_ENCRYPTION?.trim() || 'aws-kms';
  const storage = REGION_STORAGE_MAP[region];
  if (!storage) {
    throw new Error(`Unknown residency region: ${region}`);
  }
  return { region, mode, encryption, storage };
}

export function validateStorageLocation(actualRegion: string, tier: DataTier): boolean {
  const config = loadResidencyConfig();
  if (config.mode !== 'strict') return true;
  if (tier === 'P2' || tier === 'P3') return true;
  return actualRegion === config.storage.objectStoreRegion;
}

export function resolveGeoRegionFromCountry(countryCode: string | undefined): string {
  if (!countryCode) return 'unknown';
  if (EU_COUNTRY_CODES.has(countryCode.toUpperCase())) return 'eu';
  if (['US', 'CA', 'MX'].includes(countryCode.toUpperCase())) return 'us';
  if (['SG', 'AU', 'JP', 'IN'].includes(countryCode.toUpperCase())) return 'apac';
  return 'other';
}

export function shouldBlockDataAccess(clientCountry: string | undefined, path: string): boolean {
  const config = loadResidencyConfig();
  if (config.mode !== 'strict') return false;
  if (!path.startsWith('/api/v1/data/')) return false;
  const geo = resolveGeoRegionFromCountry(clientCountry);
  if (config.region.startsWith('eu') && geo !== 'eu') return true;
  if (config.region.startsWith('us') && geo !== 'us') return true;
  return false;
}

export type GeoFenceRequest = {
  path: string;
  ip?: string;
  countryCode?: string;
};

export type GeoFenceDecision = {
  allowed: boolean;
  statusCode?: number;
  error?: string;
};

export function evaluateGeoFence(req: GeoFenceRequest): GeoFenceDecision {
  if (shouldBlockDataAccess(req.countryCode, req.path)) {
    return {
      allowed: false,
      statusCode: 451,
      error: 'Data not available in your region',
    };
  }
  return { allowed: true };
}

export function buildResidencyStatus(): ResidencyConfig & {
  complianceChecks24h: {
    crossRegionWrites: number;
    unauthorizedAccess: number;
    policyViolations: number;
  };
} {
  const config = loadResidencyConfig();
  return {
    ...config,
    complianceChecks24h: {
      crossRegionWrites: 0,
      unauthorizedAccess: 0,
      policyViolations: 0,
    },
  };
}

export function residencyReportMarkdown(): string {
  const status = buildResidencyStatus();
  return [
    '# Data residency report',
    '',
    `- Region: ${status.region}`,
    `- Mode: ${status.mode}`,
    `- Encryption: ${status.encryption}`,
    `- PostgreSQL region: ${status.storage.postgresRegion}`,
    `- Object store region: ${status.storage.objectStoreRegion}`,
    `- KMS region: ${status.storage.kmsRegion}`,
  ].join('\n');
}
