import { carinaGet, carinaJson, carinaOpsTokenSet } from './carina.js';
import { query } from './db.js';
import { logAudit } from './tenant-audit.js';

export interface PackManifest {
  name: string;
  version: string;
  description: string;
  category?: string;
}

const FALLBACK_PACKS: PackManifest[] = [
  { name: 'property-uk', version: '1.0.0', description: 'UK property knowledge and workflows' },
  { name: 'legal-uk', version: '1.0.0', description: 'UK legal research helpers' },
  { name: 'sales-crm', version: '1.0.0', description: 'Sales CRM workflows' },
];

export async function fetchAvailablePacks(): Promise<{
  packs: PackManifest[];
  source: 'carina' | 'fallback';
}> {
  if (!carinaOpsTokenSet()) {
    return { packs: FALLBACK_PACKS, source: 'fallback' };
  }
  const response = await carinaGet('/api/ops/skill-packs');
  const parsed = await carinaJson<{ available?: PackManifest[] }>(response);
  if (!parsed.ok || !parsed.data?.available?.length) {
    return { packs: FALLBACK_PACKS, source: 'fallback' };
  }
  return { packs: parsed.data.available, source: 'carina' };
}

export async function fetchTenantPacks(tenantId: string): Promise<string[]> {
  const result = await query<{ pack_name: string }>(
    `SELECT pack_name FROM installed_packs
     WHERE tenant_id = $1 AND status = 'installed'
     ORDER BY pack_name`,
    [tenantId],
  );
  return result.rows.map((row) => row.pack_name);
}

export async function setTenantPacks(tenantId: string, packNames: string[]): Promise<void> {
  const normalized = [...new Set(packNames.map((p) => p.trim()).filter(Boolean))];
  const before = await fetchTenantPacks(tenantId);

  await query('DELETE FROM installed_packs WHERE tenant_id = $1', [tenantId]);
  for (const packName of normalized) {
    await query(
      `INSERT INTO installed_packs (tenant_id, pack_name, status, installed_at)
       VALUES ($1, $2, 'installed', NOW())`,
      [tenantId, packName],
    );
  }

  await logAudit('skill_pack_changed', {
    packsBefore: before,
    packsAfter: normalized,
  }, tenantId);
}
