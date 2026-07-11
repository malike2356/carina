export function extractLoginTokenFromUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (!value.includes('://') && !value.includes('?') && !value.includes('/')) {
    return value.length >= 16 ? value : null;
  }

  try {
    const normalized = value
      .replace(/^carina:\/\//, 'https://carina.local/')
      .replace(/^uk\.carinaai\.mobile:\/\//, 'https://carina.local/');
    const parsed = new URL(normalized);
    if (parsed.searchParams.has('token')) {
      return parsed.searchParams.get('token');
    }
    const pathMatch = parsed.pathname.match(/\/(?:login|mobile-login)\/([^/?#]+)/);
    if (pathMatch?.[1]) {
      return decodeURIComponent(pathMatch[1]);
    }
    return null;
  } catch {
    return null;
  }
}

export function isLoginQrPayload(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  return value.includes('login') || value.startsWith('carina://login');
}
