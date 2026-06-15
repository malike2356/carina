import { hubPool } from './migrations.js';
import type { MarketplaceEntryInput } from './marketplace-validate.js';
import { validateMarketplaceEntryInput } from './marketplace-validate.js';

export type HubMarketplaceRow = {
  id: string;
  kind: string;
  slug: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: string | null;
  publisher: string;
  featured: boolean;
  verified: boolean;
  validation_status: string;
  risk: string;
  install_source: string;
  install_ref: string | null;
  install_json: Record<string, unknown>;
  metadata_json: Record<string, unknown>;
  archive_path: string | null;
  download_count: number;
  created_at: string;
  updated_at: string;
};

export async function listHubMarketplaceEntries(filters: {
  kind?: string;
  q?: string;
  featured?: boolean;
  verified?: boolean;
  publisher?: string;
} = {}): Promise<HubMarketplaceRow[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.kind) {
    clauses.push(`kind = $${idx++}`);
    params.push(filters.kind);
  }
  if (filters.featured) clauses.push('featured = true');
  if (filters.verified) clauses.push('verified = true');
  if (filters.publisher) {
    clauses.push(`publisher = $${idx++}`);
    params.push(filters.publisher);
  }
  if (filters.q?.trim()) {
    clauses.push(`(name ILIKE $${idx} OR description ILIKE $${idx} OR slug ILIKE $${idx})`);
    params.push(`%${filters.q.trim()}%`);
    idx++;
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await hubPool.query<HubMarketplaceRow>(
    `SELECT id, kind, slug, name, version, description, author, category,
            publisher, featured, verified, validation_status, risk,
            install_source, install_ref, install_json, metadata_json,
            archive_path, download_count, created_at, updated_at
     FROM hub_marketplace_entries
     ${where}
     ORDER BY featured DESC, verified DESC, download_count DESC, name ASC`,
    params,
  );
  return result.rows;
}

export async function getHubMarketplaceEntry(id: string): Promise<HubMarketplaceRow | null> {
  const result = await hubPool.query<HubMarketplaceRow>(
    `SELECT id, kind, slug, name, version, description, author, category,
            publisher, featured, verified, validation_status, risk,
            install_source, install_ref, install_json, metadata_json,
            archive_path, download_count, created_at, updated_at
     FROM hub_marketplace_entries WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function upsertHubMarketplaceEntry(input: MarketplaceEntryInput): Promise<void> {
  const entry = validateMarketplaceEntryInput(input, 'publish');
  const id = entry.id ?? `${entry.kind}:${entry.slug}`;
  await hubPool.query(
    `INSERT INTO hub_marketplace_entries (
      id, kind, slug, name, version, description, author, category,
      publisher, featured, verified, validation_status, risk,
      install_source, install_ref, install_json, metadata_json, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,
      $9,$10,$11,$12,$13,
      $14,$15,$16,$17,NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      version = EXCLUDED.version,
      description = EXCLUDED.description,
      author = EXCLUDED.author,
      category = EXCLUDED.category,
      publisher = EXCLUDED.publisher,
      featured = EXCLUDED.featured,
      verified = EXCLUDED.verified,
      validation_status = EXCLUDED.validation_status,
      risk = EXCLUDED.risk,
      install_source = EXCLUDED.install_source,
      install_ref = EXCLUDED.install_ref,
      install_json = EXCLUDED.install_json,
      metadata_json = EXCLUDED.metadata_json,
      updated_at = NOW()`,
    [
      id,
      entry.kind,
      entry.slug,
      entry.name,
      entry.version,
      entry.description,
      entry.author,
      entry.category ?? null,
      entry.trust.publisher,
      entry.trust.featured,
      entry.trust.verified,
      entry.trust.validation,
      entry.trust.risk,
      entry.install.source,
      entry.install.ref ?? null,
      JSON.stringify(entry.install),
      JSON.stringify({ tags: entry.tags ?? [], stats: entry.stats ?? {} }),
    ],
  );
}

export async function recordMarketplaceDownload(id: string): Promise<void> {
  await hubPool.query(
    'UPDATE hub_marketplace_entries SET download_count = download_count + 1, updated_at = NOW() WHERE id = $1',
    [id],
  );
}

export function hubRowToMarketplaceInput(row: HubMarketplaceRow): MarketplaceEntryInput {
  const installJson = row.install_json ?? {};
  return {
    id: row.id,
    kind: row.kind as MarketplaceEntryInput['kind'],
    slug: row.slug,
    name: row.name,
    version: row.version,
    description: row.description,
    author: row.author,
    category: row.category ?? undefined,
    trust: {
      publisher: row.publisher as MarketplaceEntryInput['trust']['publisher'],
      featured: row.featured,
      verified: row.verified,
      validation: row.validation_status as MarketplaceEntryInput['trust']['validation'],
      risk: row.risk as MarketplaceEntryInput['trust']['risk'],
    },
    install: {
      source: row.install_source as MarketplaceEntryInput['install']['source'],
      ref: row.install_ref ?? undefined,
      envKeys: Array.isArray(installJson.envKeys) ? installJson.envKeys.map(String) : undefined,
      webhook: installJson.webhook ? String(installJson.webhook) : undefined,
      npmPackage: installJson.npmPackage ? String(installJson.npmPackage) : undefined,
    },
    stats: row.metadata_json?.stats as MarketplaceEntryInput['stats'],
    status: 'available',
  };
}
