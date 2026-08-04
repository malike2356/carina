import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStudioHandoffUrl } from './agent-studio-playbook-bridge.js';
import { isKeprixStudioConfigured, readKeprixConfig } from './keprix-config.js';
import { KeprixProxyError } from './keprix-proxy-client.js';

export type ConnectorAuthPattern = 'api_key' | 'oauth' | 'mcp' | 'sidecar' | 'none' | 'env';
export type ConnectorCategory =
  | 'productivity'
  | 'data'
  | 'messaging'
  | 'ai'
  | 'devtools'
  | 'automation';

export type ConnectorSummary = {
  id: string;
  label: string;
  category: ConnectorCategory | string;
  description: string;
  icon: string;
  auth_pattern: ConnectorAuthPattern | string;
  featured?: boolean;
  tags?: string[];
  install_hint?: string;
  docs_url?: string;
  install_status?: { installed: boolean; reason?: string };
  sample_playbook_node?: Record<string, unknown>;
};

export type CatalogQuery = {
  category?: string;
  featured?: boolean;
  q?: string;
};

type CatalogCacheEntry = {
  expiresAt: number;
  connectors: ConnectorSummary[];
  categories: Array<{ id: string; label: string; count: number }>;
};

const CACHE_TTL_MS = 60_000;
const catalogCache = new Map<string, CatalogCacheEntry>();

function fixturePath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../../fixtures/keprix-connector-catalog.json');
}

function loadFixtureCatalog(): CatalogCacheEntry {
  const raw = fs.readFileSync(fixturePath(), 'utf8');
  const payload = JSON.parse(raw) as {
    connectors: ConnectorSummary[];
    categories: Array<{ id: string; label: string; count: number }>;
  };
  return {
    expiresAt: Date.now() + CACHE_TTL_MS,
    connectors: payload.connectors,
    categories: payload.categories,
  };
}

function cacheKey(tenantId: string, query: CatalogQuery): string {
  return `${tenantId}:${query.category ?? ''}:${query.featured ? '1' : '0'}:${query.q ?? ''}`;
}

function applyCatalogQuery(connectors: ConnectorSummary[], query: CatalogQuery): ConnectorSummary[] {
  let rows = [...connectors];
  if (query.category) {
    rows = rows.filter((row) => row.category === query.category);
  }
  if (query.featured) {
    rows = rows.filter((row) => row.featured);
  }
  if (query.q?.trim()) {
    const needle = query.q.trim().toLowerCase();
    rows = rows.filter(
      (row) =>
        row.label.toLowerCase().includes(needle)
        || row.description.toLowerCase().includes(needle)
        || (row.tags ?? []).some((tag) => tag.toLowerCase().includes(needle)),
    );
  }
  return rows;
}

async function fetchLiveCatalog(tenantId: string): Promise<CatalogCacheEntry> {
  const config = readKeprixConfig();
  if (!config.apiBaseUrl || !config.serviceToken) {
    throw new KeprixProxyError('Keprix API is not configured', 503);
  }
  const response = await fetch(`${config.apiBaseUrl}/api/integrations/catalog`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${config.serviceToken}`,
      'X-Tenant-Id': tenantId,
    },
  });
  if (!response.ok) {
    throw new KeprixProxyError(`Keprix catalog returned ${response.status}`, response.status);
  }
  const payload = (await response.json()) as {
    connectors?: ConnectorSummary[];
    categories?: Array<{ id: string; label: string; count: number }>;
  };
  return {
    expiresAt: Date.now() + CACHE_TTL_MS,
    connectors: payload.connectors ?? [],
    categories: payload.categories ?? [],
  };
}

export async function fetchConnectorCatalog(
  tenantId: string,
  query: CatalogQuery = {},
): Promise<{ connectors: ConnectorSummary[]; categories: CatalogCacheEntry['categories']; stub: boolean }> {
  const key = cacheKey(tenantId, query);
  const cached = catalogCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      connectors: applyCatalogQuery(cached.connectors, query),
      categories: cached.categories,
      stub: process.env.INTEGRATIONS_CATALOG_STUB === '1',
    };
  }

  let source: CatalogCacheEntry;
  let stub = false;
  if (process.env.INTEGRATIONS_CATALOG_STUB === '1') {
    source = loadFixtureCatalog();
    stub = true;
  } else {
    try {
      source = await fetchLiveCatalog(tenantId);
    } catch (err) {
      if (process.env.INTEGRATIONS_CATALOG_STUB !== '0') {
        source = loadFixtureCatalog();
        stub = true;
      } else {
        throw err;
      }
    }
  }

  catalogCache.set(key, source);
  return {
    connectors: applyCatalogQuery(source.connectors, query),
    categories: source.categories,
    stub,
  };
}

export async function fetchConnectorDetail(
  tenantId: string,
  connectorId: string,
): Promise<{ connector: ConnectorSummary; install_status: { installed: boolean; reason?: string } }> {
  const catalog = await fetchConnectorCatalog(tenantId);
  const connector = catalog.connectors.find((row) => row.id === connectorId);
  if (!connector) {
    throw new KeprixProxyError(`Connector not found: ${connectorId}`, 404);
  }
  return {
    connector,
    install_status: connector.install_status ?? { installed: false },
  };
}

type HandoffActor = { subject: string; tenantId: string; carinaUserId: string };

export async function getInstallHandoffUrl(
  connectorId: string,
  actor: HandoffActor,
): Promise<string> {
  const detail = await fetchConnectorDetail(actor.tenantId, connectorId);
  const pattern = detail.connector.auth_pattern;
  if (pattern === 'sidecar' && connectorId === 'n8n_sidecar') {
    return getStudioHandoffUrl('/docs/integrations/n8n-sidecar', actor);
  }
  if (pattern === 'mcp' || pattern === 'oauth' || pattern === 'api_key') {
    return getStudioHandoffUrl(`/admin/mcp?connector=${encodeURIComponent(connectorId)}`, actor);
  }
  return getStudioHandoffUrl(`/hub?connector=${encodeURIComponent(connectorId)}`, actor);
}

export async function getStudioDeepLink(connectorId: string, actor: HandoffActor): Promise<string> {
  return getStudioHandoffUrl(
    `/playbooks/studio/new?connector=${encodeURIComponent(connectorId)}`,
    actor,
  );
}

export function integrationsConfigured(): boolean {
  return isKeprixStudioConfigured(readKeprixConfig()) || process.env.INTEGRATIONS_CATALOG_STUB === '1';
}
