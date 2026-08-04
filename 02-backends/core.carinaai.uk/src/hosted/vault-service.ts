import { pool } from '../memory/db.js';
import {
  getTenantProvider,
  removeTenantProviderKey,
  setTenantProviderKey,
} from '../brain/tenant-provider-keys.js';
import { getOrgPlan } from './plan-gates.js';
import { PLAN_FEATURES, type PlanTier } from './plan-features.js';
import { queryForOrg } from './scoped-query.js';
import { writeProductAudit } from './product-audit.js';

export interface VaultEntrySummary {
  provider: string;
  enabled: boolean;
  hasCustomBaseUrl: boolean;
  hasCustomModel: boolean;
  lastRotatedAt: string | null;
}

export interface AddVaultInput {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export class VaultLimitError extends Error {
  readonly statusCode = 402;

  constructor(maxProviders: number) {
    super(`BYOK provider limit reached (${maxProviders})`);
    this.name = 'VaultLimitError';
  }
}

export class VaultNotFoundError extends Error {
  readonly statusCode = 404;

  constructor(provider: string) {
    super(`Vault entry not found: ${provider}`);
    this.name = 'VaultNotFoundError';
  }
}

async function countVaultProviders(orgId: string): Promise<number> {
  const result = await queryForOrg<{ count: string }>(
    orgId,
    'SELECT COUNT(*)::TEXT AS count FROM tenant_provider_keys WHERE org_id = $1',
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function listVaultEntries(orgId: string): Promise<VaultEntrySummary[]> {
  const result = await queryForOrg(
    orgId,
    `SELECT provider, enabled, custom_base_url, custom_model, updated_at
     FROM tenant_provider_keys
     WHERE org_id = $1
     ORDER BY provider`,
  );
  return result.rows.map((row) => ({
    provider: String(row.provider),
    enabled: Boolean(row.enabled),
    hasCustomBaseUrl: Boolean(row.custom_base_url),
    hasCustomModel: Boolean(row.custom_model),
    lastRotatedAt: row.updated_at ? new Date(row.updated_at as Date).toISOString() : null,
  }));
}

export async function addVaultEntry(
  orgId: string,
  tenantId: string,
  input: AddVaultInput,
  actorUserId: string,
): Promise<void> {
  const plan: PlanTier = await getOrgPlan(orgId);
  const maxProviders = PLAN_FEATURES[plan].maxByokProviders;
  const existing = await getTenantProvider(tenantId, input.provider);
  if (!existing) {
    const count = await countVaultProviders(orgId);
    if (count >= maxProviders) {
      throw new VaultLimitError(maxProviders);
    }
  }

  await setTenantProviderKey(
    tenantId,
    input.provider,
    input.apiKey,
    input.baseUrl,
    input.model,
  );

  await pool.query(
    'UPDATE tenant_provider_keys SET org_id = $1 WHERE tenant_id = $2 AND provider = $3',
    [orgId, tenantId, input.provider],
  );

  await writeProductAudit({
    orgId,
    actorUserId,
    action: 'vault.key_added',
    resourceType: 'vault',
    resourceId: input.provider,
    details: {
      provider: input.provider,
      hasCustomBaseUrl: Boolean(input.baseUrl),
      hasCustomModel: Boolean(input.model),
    },
  });
}

export async function removeVaultEntry(
  orgId: string,
  tenantId: string,
  provider: string,
  actorUserId: string,
): Promise<void> {
  const entries = await listVaultEntries(orgId);
  if (!entries.some((entry) => entry.provider === provider)) {
    throw new VaultNotFoundError(provider);
  }

  await removeTenantProviderKey(tenantId, provider, orgId);

  await writeProductAudit({
    orgId,
    actorUserId,
    action: 'vault.key_removed',
    resourceType: 'vault',
    resourceId: provider,
    details: { provider },
  });
}

export async function toggleVaultEntry(
  orgId: string,
  provider: string,
  enabled: boolean,
  actorUserId: string,
): Promise<void> {
  const result = await queryForOrg(
    orgId,
    `UPDATE tenant_provider_keys
     SET enabled = $2, updated_at = NOW()
     WHERE org_id = $1 AND provider = $3
     RETURNING provider`,
    [enabled, provider],
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new VaultNotFoundError(provider);
  }

  await writeProductAudit({
    orgId,
    actorUserId,
    action: 'vault.key_toggled',
    resourceType: 'vault',
    resourceId: provider,
    details: { provider, enabled },
  });
}

export async function orgHasByokKey(orgId: string): Promise<boolean> {
  const count = await countVaultProviders(orgId);
  return count > 0;
}
