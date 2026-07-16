export type ProductSurface = 'cloud' | 'aiva';

const DEFAULT_AIVA_HOST = 'admin.hireaiva.co.uk';

function normaliseHost(hostname: string): string {
  return hostname.split(':')[0].trim().toLowerCase().replace(/\.$/, '');
}

function parseHostList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(',').map(normaliseHost).filter(Boolean))];
}

/** Primary Aiva hostname (legacy env; first entry when AIVA_PRODUCT_HOSTS is set). */
export function aivaProductHost(): string {
  const hosts = aivaProductHosts();
  if (hosts.length > 0) return hosts[0];
  return DEFAULT_AIVA_HOST;
}

/** All hostnames that serve the Aiva product surface. */
export function aivaProductHosts(): string[] {
  const fromList = parseHostList(process.env.AIVA_PRODUCT_HOSTS);
  if (fromList.length > 0) return fromList;

  const fromPublic = parseHostList(process.env.NEXT_PUBLIC_AIVA_PRODUCT_HOSTS);
  if (fromPublic.length > 0) return fromPublic;

  const single =
    process.env.AIVA_PRODUCT_HOST
    ?? process.env.NEXT_PUBLIC_AIVA_PRODUCT_HOST;
  if (single?.trim()) return [normaliseHost(single)];

  return [DEFAULT_AIVA_HOST];
}

/** Public Aiva app base URL for emails and external links. */
export function aivaAppOrigin(): string {
  const fromUrl = process.env.AIVA_APP_URL ?? process.env.NEXT_PUBLIC_AIVA_APP_URL;
  if (fromUrl?.trim()) return fromUrl.replace(/\/$/, '');
  return `https://${aivaProductHost()}`;
}

export function isAivaProductHost(hostname: string): boolean {
  return aivaProductHosts().includes(normaliseHost(hostname));
}

export function cloudAppHost(): string {
  return normaliseHost(process.env.CARINA_HOSTED_APP_HOST ?? 'app.carinaai.uk');
}

export function isCloudCanonicalHost(hostname: string): boolean {
  return normaliseHost(hostname) === cloudAppHost();
}

export function getProductSurface(hostname: string): ProductSurface {
  return isAivaProductHost(hostname) ? 'aiva' : 'cloud';
}

/** Billing route for the active product surface (Carina workspace vs Aiva subscription). */
export function billingHrefForSurface(surface: ProductSurface): string {
  return surface === 'aiva' ? '/billing/aiva' : '/billing';
}

/** Nav groups shown on the Aiva product host (workspace/chat hidden). */
export const AIVA_SURFACE_GROUPS = new Set(['aiva', 'account']);

/** Cloud-only route prefixes redirected to /aiva on the Aiva host. */
export const CLOUD_ONLY_ROUTE_PREFIXES = [
  '/launcher',
  '/dashboard',
  '/chat',
  '/library',
  '/support',
  '/research',
  '/tasks',
  '/documents',
  '/email',
  '/calendar',
  '/files',
  '/cron',
  '/scheduled',
  '/terminal',
  '/mcp',
  '/webhooks',
  '/env',
  '/system',
  '/logs',
  '/profiles',
  '/packs',
] as const;

export function isCloudOnlyRoute(pathname: string): boolean {
  return CLOUD_ONLY_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function hasExternalAivaProductDomain(): boolean {
  return aivaProductHosts().some((host) => !host.endsWith('carinaai.uk'));
}
