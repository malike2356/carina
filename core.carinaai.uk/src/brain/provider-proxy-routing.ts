/** Opt-in provider traffic routing through the local debug proxy (off by default). */

export function maybeDebugProxyBaseUrl(provider: string, baseUrl?: string): string | undefined {
  if (!baseUrl || process.env.CARINA_DEBUG_PROXY_ROUTING !== 'true') return baseUrl;

  const filter = process.env.CARINA_DEBUG_PROXY_PROVIDERS?.trim();
  if (filter && filter !== '*') {
    const allowed = filter.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!allowed.includes(provider.toLowerCase())) return baseUrl;
  }

  const port = Number(process.env.CARINA_DEBUG_PROXY_PORT ?? 19229);
  const trimmed = baseUrl.replace(/\/$/, '');
  return `http://127.0.0.1:${port}/${trimmed}`;
}

export function debugProviderRoutingEnabled(): boolean {
  return process.env.CARINA_DEBUG_PROXY_ROUTING === 'true';
}
