function parseAllowedOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function resolveScoutCorsOrigin(
  configuredOrigins: string,
  requestOrigin?: string,
): string | null {
  const allowedOrigins = parseAllowedOrigins(configuredOrigins);
  if (allowedOrigins.length === 0) return null;
  if (allowedOrigins.includes('*')) return '*';
  if (!requestOrigin) return null;
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : null;
}

