export function coreProxyEnabled(): boolean {
  if (process.env.CARINA_USE_CORE_PROXY !== 'true') return false;
  return Boolean(resolveCoreProxyToken());
}

export function resolveCoreProxyToken(): string {
  return (
    process.env.CARINA_OPS_TOKEN?.trim() ||
    process.env.CARINA_INTERNAL_KEY?.trim() ||
    ''
  );
}

export function resolveCoreUrl(): string {
  return process.env.CARINA_CORE_URL?.trim()
    || (process.env.NODE_ENV === 'production' ? 'http://carina-web:3000' : 'http://localhost:3000');
}
