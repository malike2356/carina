const PRODUCTION_ORIGINS = [
  'https://app.carinaai.uk',
  'https://admin.hireaiva.co.uk',
  'https://hireaiva.co.uk',
  'https://www.hireaiva.co.uk',
  'https://core.carinaai.uk',
  'https://carinaai.uk',
  'https://www.carinaai.uk',
  'https://ops.carinaai.uk',
  'https://hub.carinaai.uk',
  'https://admin.carinaai.uk',
  'https://staging.app.carinaai.uk',
  'https://staging.core.carinaai.uk',
  'https://staging.admin.carinaai.uk',
];

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:4100',
  'http://127.0.0.1:3000',
];

export function resolveAllowedCorsOrigins(): string[] {
  const explicit = process.env.CORS_ORIGIN?.trim();
  if (explicit && explicit !== '*') {
    return explicit.split(',').map((o) => o.trim()).filter(Boolean);
  }
  if (process.env.NODE_ENV === 'production' || process.env.HOSTED_MODE === 'true') {
    return [...PRODUCTION_ORIGINS];
  }
  return [...PRODUCTION_ORIGINS, ...DEV_ORIGINS];
}

export function isCorsOriginAllowed(origin: string | undefined, allowed: string[]): boolean {
  if (!origin) return true;
  return allowed.includes(origin);
}
