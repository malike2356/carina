export function normalizeGatewayUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

export function isValidGatewayUrl(raw: string): boolean {
  const value = normalizeGatewayUrl(raw);
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function storageKeyForUrl(baseUrl: string): string {
  return normalizeGatewayUrl(baseUrl).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 80);
}
