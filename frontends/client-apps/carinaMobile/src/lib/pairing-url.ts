export function extractPairingTokenFromUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (!value.includes('://') && !value.includes('?') && !value.includes('/')) {
    return value.length >= 16 ? value : null;
  }

  try {
    const parsed = new URL(value.replace(/^carina:\/\//, 'https://carina.local/'));
    if (parsed.searchParams.has('token')) {
      return parsed.searchParams.get('token');
    }
    const pathMatch = parsed.pathname.match(/\/pair\/([^/?#]+)/);
    if (pathMatch?.[1]) {
      return decodeURIComponent(pathMatch[1]);
    }
    return null;
  } catch {
    return null;
  }
}
