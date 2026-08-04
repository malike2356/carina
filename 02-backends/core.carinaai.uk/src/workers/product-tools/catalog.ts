import { readFileSync, existsSync } from 'node:fs';
import { resolveAivaConfigFile } from './config-path.js';

export type CatalogToolStatus = 'live' | 'probe_only' | 'coming_soon';
export type CatalogAuth = 'oauth' | 'vault' | 'none';
export type CatalogDriver = 'google' | 'http' | 'slack' | 'browser' | 'noop';

export type CatalogAction = {
  id: string;
  scope?: string;
  method?: string;
  url?: string;
  authHeader?: string;
  headers?: Record<string, string>;
  json?: unknown;
};

export type CatalogProbe = {
  action?: string;
  method?: string;
  url?: string;
  authHeader?: string;
  headers?: Record<string, string>;
  json?: unknown;
};

export type CatalogTool = {
  slug: string;
  label: string;
  category: string;
  status: CatalogToolStatus;
  auth: CatalogAuth;
  driver: CatalogDriver;
  scopes: string[];
  vaultLabel?: string;
  oauthProvider?: string;
  probe?: CatalogProbe;
  actions?: CatalogAction[];
  configFields?: string[];
  allowUrlOverride?: boolean;
};

export type ProductToolsCatalog = {
  version: number;
  tools: CatalogTool[];
};

let cached: ProductToolsCatalog | null = null;
let cachedPath: string | null = null;

export function resolveProductToolsCatalogPath(): string {
  return resolveAivaConfigFile(
    process.env.AIVA_PRODUCT_TOOLS_CATALOG_PATH,
    'product-tools.catalog.json',
    import.meta.url,
  );
}

export function loadProductToolsCatalog(force = false): ProductToolsCatalog {
  const catalogPath = resolveProductToolsCatalogPath();
  if (!force && cached && cachedPath === catalogPath) return cached;
  if (!existsSync(catalogPath)) {
    throw new Error(`Aiva product tools catalog not found at ${catalogPath}`);
  }
  const raw = JSON.parse(readFileSync(catalogPath, 'utf8')) as ProductToolsCatalog;
  if (!Array.isArray(raw.tools) || raw.tools.length === 0) {
    throw new Error(`Aiva product tools catalog is empty: ${catalogPath}`);
  }
  cached = raw;
  cachedPath = catalogPath;
  return raw;
}

export function listCatalogTools(opts?: { includeComingSoon?: boolean }): CatalogTool[] {
  const tools = loadProductToolsCatalog().tools;
  if (opts?.includeComingSoon) return tools;
  return tools.filter((tool) => tool.status !== 'coming_soon' || process.env.AIVA_SHOW_COMING_SOON_TOOLS === 'true');
}

export function getCatalogTool(slug: string): CatalogTool | null {
  return loadProductToolsCatalog().tools.find((tool) => tool.slug === slug) ?? null;
}

/** Public shape for UI / prompts (no probe internals required). */
export function listPublicProductTools() {
  return loadProductToolsCatalog().tools.map((tool) => ({
    slug: tool.slug,
    label: tool.label,
    category: tool.category,
    status: tool.status,
    auth: tool.auth,
    scopes: tool.scopes,
    oauthProvider: tool.oauthProvider,
    configFields: tool.configFields ?? [],
  }));
}

export function reloadProductToolsCatalog(): ProductToolsCatalog {
  return loadProductToolsCatalog(true);
}
