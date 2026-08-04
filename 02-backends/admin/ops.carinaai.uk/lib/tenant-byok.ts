import crypto from 'crypto';
import { pool, query } from './db.js';

export interface ProviderKeyRow {
  provider: string;
  enabled: boolean;
  hasCustomBaseUrl: boolean;
  hasCustomModel: boolean;
}

function encryptionKey(): Buffer {
  const k = process.env.TENANT_KEY_ENCRYPTION_KEY
    ?? process.env.CARINA_ENCRYPTION_KEY
    ?? 'carina-dev-key-change-in-production-32';
  return Buffer.from(k.slice(0, 32), 'utf-8');
}

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey(), iv);
  let enc = cipher.update(plaintext, 'utf-8', 'hex');
  enc += cipher.final('hex');
  return `${iv.toString('hex')}:${enc}`;
}

export async function listProviderKeys(tenantId: string): Promise<ProviderKeyRow[]> {
  const res = await query<{
    provider: string; enabled: boolean;
    custom_base_url: string | null; custom_model: string | null;
  }>(
    `SELECT k.provider, k.enabled, k.custom_base_url, k.custom_model
     FROM tenant_provider_keys k
     LEFT JOIN organizations o ON o.id = k.org_id
     LEFT JOIN org_memberships om ON om.org_id = k.org_id AND om.user_id = $1
     WHERE k.tenant_id = $1
        OR o.owner_user_id = $1
        OR om.user_id = $1
     ORDER BY k.provider`,
    [tenantId],
  );
  return res.rows.map((r) => ({
    provider: r.provider,
    enabled: r.enabled,
    hasCustomBaseUrl: !!r.custom_base_url,
    hasCustomModel: !!r.custom_model,
  }));
}

export async function addProviderKey(
  tenantId: string,
  provider: string,
  apiKey: string,
  baseUrl?: string,
  model?: string,
): Promise<void> {
  const encrypted = encrypt(apiKey);
  await pool.query(
    `INSERT INTO tenant_provider_keys (tenant_id, provider, encrypted_api_key, custom_base_url, custom_model)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id, provider)
     DO UPDATE SET encrypted_api_key = $3, custom_base_url = $4, custom_model = $5, updated_at = NOW()`,
    [tenantId, provider, encrypted, baseUrl || null, model || null],
  );
}

export async function removeProviderKey(tenantId: string, provider: string): Promise<void> {
  await pool.query(
    'DELETE FROM tenant_provider_keys WHERE tenant_id = $1 AND provider = $2',
    [tenantId, provider],
  );
}

export async function toggleProviderKey(
  tenantId: string,
  provider: string,
  enabled: boolean,
): Promise<void> {
  await pool.query(
    `UPDATE tenant_provider_keys SET enabled = $3, updated_at = NOW()
     WHERE tenant_id = $1 AND provider = $2`,
    [tenantId, provider, enabled],
  );
}
