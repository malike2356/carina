import fs from 'fs/promises';
import path from 'path';
import { resolveCarinaHome } from '../../config/paths.js';
import type { MarketplaceEntryKind, MarketplaceInstallStatus } from './marketplace-types.js';
import { parseMarketplaceEntryId } from './marketplace-types.js';

export type MarketplaceInstallRecord = {
  id: string;
  kind: MarketplaceEntryKind;
  slug: string;
  status: MarketplaceInstallStatus;
  version: string;
  installedAt: string;
  enabledAt?: string;
  disabledAt?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

type MarketplaceStoreFile = {
  version: number;
  entries: MarketplaceInstallRecord[];
};

const STORE_VERSION = 1;

function storePath(): string {
  return path.join(resolveCarinaHome(), 'marketplace.json');
}

export async function readMarketplaceStore(): Promise<MarketplaceInstallRecord[]> {
  try {
    const raw = await fs.readFile(storePath(), 'utf-8');
    const parsed = JSON.parse(raw) as MarketplaceStoreFile;
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

export async function writeMarketplaceStore(entries: MarketplaceInstallRecord[]): Promise<void> {
  const home = resolveCarinaHome();
  await fs.mkdir(home, { recursive: true });
  const payload: MarketplaceStoreFile = { version: STORE_VERSION, entries };
  await fs.writeFile(storePath(), JSON.stringify(payload, null, 2), { mode: 0o600 });
}

export async function getMarketplaceInstallRecord(id: string): Promise<MarketplaceInstallRecord | undefined> {
  const rows = await readMarketplaceStore();
  return rows.find((row) => row.id === id);
}

export async function upsertMarketplaceInstallRecord(
  id: string,
  patch: Partial<MarketplaceInstallRecord> & { status: MarketplaceInstallStatus; version: string },
): Promise<MarketplaceInstallRecord> {
  const { kind, slug } = parseMarketplaceEntryId(id);
  const rows = await readMarketplaceStore();
  const now = new Date().toISOString();
  const existing = rows.find((row) => row.id === id);
  const record: MarketplaceInstallRecord = {
    id,
    kind,
    slug,
    status: patch.status,
    version: patch.version,
    installedAt: existing?.installedAt ?? now,
    enabledAt: patch.enabledAt ?? existing?.enabledAt,
    disabledAt: patch.disabledAt ?? existing?.disabledAt,
    source: patch.source ?? existing?.source,
    metadata: patch.metadata ?? existing?.metadata,
  };
  const next = existing
    ? rows.map((row) => (row.id === id ? record : row))
    : [...rows, record];
  await writeMarketplaceStore(next);
  return record;
}

export async function removeMarketplaceInstallRecord(id: string): Promise<boolean> {
  const rows = await readMarketplaceStore();
  const next = rows.filter((row) => row.id !== id);
  if (next.length === rows.length) return false;
  await writeMarketplaceStore(next);
  return true;
}

export function marketplaceAssetsDir(): string {
  return path.join(resolveCarinaHome(), 'marketplace');
}

export async function ensureMarketplaceLayout(): Promise<void> {
  const base = marketplaceAssetsDir();
  await fs.mkdir(path.join(base, 'workflows'), { recursive: true });
  await fs.mkdir(path.join(base, 'themes'), { recursive: true });
  await fs.mkdir(path.join(base, 'channels'), { recursive: true });
  await fs.mkdir(path.join(base, 'mcp'), { recursive: true });
}
