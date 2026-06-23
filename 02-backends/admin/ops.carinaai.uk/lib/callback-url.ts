const BLOCKED_PREFIXES = ['/login', '/logout'];

export function safeCallbackUrl(raw: unknown, fallback = '/'): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  const pathOnly = value.split('?')[0] ?? value;
  if (BLOCKED_PREFIXES.some((prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`))) {
    return fallback;
  }
  return value;
}

export function loginRedirectTarget(callbackUrl: unknown, uiVersion: string): string {
  const target = safeCallbackUrl(callbackUrl);
  if (target === '/') return hrefWithUiVersion('/', uiVersion);
  return target;
}

export function hrefWithUiVersion(href: string, uiVersion: string): string {
  if (!uiVersion) return href;
  return href + (href.includes('?') ? '&' : '?') + `v=${encodeURIComponent(uiVersion)}`;
}
