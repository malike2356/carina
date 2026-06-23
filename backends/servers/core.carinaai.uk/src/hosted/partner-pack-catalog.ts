import { pool } from '../memory/db.js';
import {
  mergePackCatalog,
  normalizePackCatalogRecord,
  type PackCatalogRecord,
} from '../skills/hub/pack-ownership.js';

function parsePackCatalog(raw: unknown): PackCatalogRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => normalizePackCatalogRecord(entry))
    .filter((entry): entry is PackCatalogRecord => entry !== null);
}

export async function getPartnerPackCatalog(partnerId: string): Promise<PackCatalogRecord[]> {
  const result = await pool.query(
    'SELECT pack_catalog FROM partner_accounts WHERE id = $1 LIMIT 1',
    [partnerId],
  );
  if ((result.rowCount ?? 0) === 0) return [];
  return parsePackCatalog(result.rows[0]?.pack_catalog);
}

export async function savePartnerPackCatalog(
  partnerId: string,
  catalog: PackCatalogRecord[],
): Promise<PackCatalogRecord[]> {
  const normalized = mergePackCatalog([], catalog);
  await pool.query(
    `UPDATE partner_accounts
     SET pack_catalog = $2::jsonb, updated_at = NOW()
     WHERE id = $1`,
    [partnerId, JSON.stringify(normalized)],
  );
  return normalized;
}

export function parseWorkspacePackCatalog(raw: unknown): PackCatalogRecord[] {
  return parsePackCatalog(raw);
}
