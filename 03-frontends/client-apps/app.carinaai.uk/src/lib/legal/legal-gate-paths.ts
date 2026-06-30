const LEGAL_EXEMPT_API_PREFIXES = [
  '/api/legal/current',
  '/api/legal/status',
  '/api/legal/accept',
  '/api/auth/',
  '/api/health',
  '/api/webhooks/',
];

export function isLegalExemptApiPath(pathname: string): boolean {
  if (!pathname.startsWith('/api/')) return true;
  return LEGAL_EXEMPT_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
