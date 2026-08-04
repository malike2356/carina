import crypto from 'crypto';
import { pool } from '../memory/db.js';
import { orgOrTenantWhere, resolveOrgIdFromUser } from '../hosted/scoped-query.js';

const ENCRYPTION_KEY = process.env.TENANT_KEY_ENCRYPTION_KEY
  ?? process.env.CARINA_ENCRYPTION_KEY
  ?? 'carina-dev-key-change-in-production-32';

function encryptionKeyBuffer(): Buffer {
  return Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf-8');
}

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKeyBuffer(), iv);
  let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(ciphertext: string): string {
  const [ivHex, encrypted] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKeyBuffer(), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}

export interface TenantProviderOverride {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export async function getTenantProvider(
  tenantId: string,
  provider: string,
): Promise<TenantProviderOverride | null> {
  const result = await pool.query(
    `SELECT encrypted_api_key, custom_base_url, custom_model, enabled
     FROM tenant_provider_keys
     WHERE tenant_id = $1 AND provider = $2`,
    [tenantId, provider],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  if (!row.enabled) return null;
  return {
    provider,
    apiKey: decrypt(row.encrypted_api_key),
    baseUrl: row.custom_base_url || undefined,
    model: row.custom_model || undefined,
  };
}

export async function setTenantProviderKey(
  tenantId: string,
  provider: string,
  apiKey: string,
  baseUrl?: string,
  model?: string,
): Promise<void> {
  const encrypted = encrypt(apiKey);
  const orgId = await resolveOrgIdFromUser(tenantId);
  await pool.query(
    `INSERT INTO tenant_provider_keys (tenant_id, org_id, provider, encrypted_api_key, custom_base_url, custom_model)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (tenant_id, provider)
     DO UPDATE SET encrypted_api_key = $4, custom_base_url = $5, custom_model = $6,
                   org_id = COALESCE(tenant_provider_keys.org_id, EXCLUDED.org_id),
                   updated_at = NOW()`,
    [tenantId, orgId, provider, encrypted, baseUrl ?? null, model ?? null],
  );
}

export async function removeTenantProviderKey(
  tenantId: string,
  provider: string,
  orgId?: string,
): Promise<void> {
  if (orgId) {
    await pool.query(
      `DELETE FROM tenant_provider_keys
       WHERE provider = $3 AND (${orgOrTenantWhere()})`,
      [orgId, tenantId, provider],
    );
    return;
  }
  await pool.query(
    'DELETE FROM tenant_provider_keys WHERE tenant_id = $1 AND provider = $2',
    [tenantId, provider],
  );
}

export async function listTenantProviders(
  orgId: string,
  tenantId?: string,
): Promise<Array<{ provider: string; enabled: boolean; hasKey: boolean }>> {
  const result = tenantId
    ? await pool.query(
        `SELECT provider, enabled
         FROM tenant_provider_keys
         WHERE ${orgOrTenantWhere()}
         ORDER BY provider`,
        [orgId, tenantId],
      )
    : await pool.query(
        `SELECT provider, enabled
         FROM tenant_provider_keys
         WHERE org_id = $1
         ORDER BY provider`,
        [orgId],
      );
  return result.rows.map((r) => ({
    provider: r.provider,
    enabled: r.enabled,
    hasKey: true,
  }));
}

/** List BYOK rows for a tenant/workspace id (Aiva path: tenant_id = workspaceId). */
export async function listTenantProvidersForTenant(
  tenantId: string,
): Promise<Array<{
  provider: string;
  enabled: boolean;
  hasCustomBaseUrl: boolean;
  hasCustomModel: boolean;
}>> {
  const result = await pool.query(
    `SELECT provider, enabled, custom_base_url, custom_model
     FROM tenant_provider_keys
     WHERE tenant_id = $1
     ORDER BY provider`,
    [tenantId],
  );
  return result.rows.map((r) => ({
    provider: String(r.provider),
    enabled: Boolean(r.enabled),
    hasCustomBaseUrl: Boolean(r.custom_base_url),
    hasCustomModel: Boolean(r.custom_model),
  }));
}

// Test-only helpers
export function _encryptForTest(plaintext: string): string {
  return encrypt(plaintext);
}

export function _decryptForTest(ciphertext: string): string {
  return decrypt(ciphertext);
}
