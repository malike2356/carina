export function normalizeGatewayUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

export function isLocalhostGatewayUrl(raw: string): boolean {
  try {
    const host = new URL(normalizeGatewayUrl(raw)).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

export function isValidGatewayUrl(raw: string, options?: { allowLocalhost?: boolean }): boolean {
  const value = normalizeGatewayUrl(raw);
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (!options?.allowLocalhost && isLocalhostGatewayUrl(value)) return false;
    return true;
  } catch {
    return false;
  }
}

export function storageKeyForUrl(baseUrl: string): string {
  return normalizeGatewayUrl(baseUrl).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 80);
}
