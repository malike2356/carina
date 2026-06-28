import crypto from 'crypto';
import { pool } from '../memory/db.js';

export type PartnerApiKeyScope = 'session' | 'memory' | 'skills' | 'analytics' | 'admin';

export interface PartnerApiKey {
  id: string;
  partnerId: string;
  label: string;
  keyPrefix: string;
  scopes: PartnerApiKeyScope[];
  rateLimitRpm: number;
  monthlyCapEvents: number;
  revenueShareBps: number;
  status: 'active' | 'revoked';
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreateKeyResult extends PartnerApiKey {
  rawKey: string;
}

function generateKey(): { raw: string; prefix: string; hash: string } {
  const env = process.env.NODE_ENV === 'production' ? 'live' : 'test';
  const rand = crypto.randomBytes(24).toString('base64url');
  const raw = `cpk_${env}_${rand}`;
  const prefix = raw.slice(0, 16);
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, prefix, hash };
}

export async function createPartnerApiKey(input: {
  partnerId: string;
  label: string;
  scopes?: PartnerApiKeyScope[];
  rateLimitRpm?: number;
  monthlyCapEvents?: number;
  revenueShareBps?: number;
}): Promise<CreateKeyResult> {
  const { raw, prefix, hash } = generateKey();
  const result = await pool.query(
    `INSERT INTO partner_api_keys
       (partner_id, label, key_prefix, key_hash, scopes,
        rate_limit_rpm, monthly_cap_events, revenue_share_bps)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      input.partnerId,
      input.label,
      prefix,
      hash,
      input.scopes ?? ['session', 'memory', 'skills'],
      input.rateLimitRpm ?? 60,
      input.monthlyCapEvents ?? 100000,
      input.revenueShareBps ?? 50,
    ],
  );
  return { ...mapKeyRow(result.rows[0] as Record<string, unknown>), rawKey: raw };
}

export async function resolvePartnerApiKey(rawKey: string): Promise<PartnerApiKey | null> {
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const result = await pool.query(
    `SELECT * FROM partner_api_keys WHERE key_hash = $1 AND status = 'active' LIMIT 1`,
    [hash],
  );
  if ((result.rowCount ?? 0) === 0) return null;
  void pool.query(
    `UPDATE partner_api_keys SET last_used_at = NOW() WHERE id = $1`,
    [(result.rows[0] as Record<string, unknown>).id],
  );
  return mapKeyRow(result.rows[0] as Record<string, unknown>);
}

export async function revokePartnerApiKey(keyId: string, partnerId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE partner_api_keys
     SET status = 'revoked', revoked_at = NOW()
     WHERE id = $1 AND partner_id = $2 AND status = 'active'`,
    [keyId, partnerId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listPartnerApiKeys(partnerId: string): Promise<PartnerApiKey[]> {
  const result = await pool.query(
    `SELECT * FROM partner_api_keys WHERE partner_id = $1 ORDER BY created_at DESC`,
    [partnerId],
  );
  return (result.rows as Record<string, unknown>[]).map(mapKeyRow);
}

function mapKeyRow(row: Record<string, unknown>): PartnerApiKey {
  return {
    id: String(row.id),
    partnerId: String(row.partner_id),
    label: String(row.label),
    keyPrefix: String(row.key_prefix),
    scopes: Array.isArray(row.scopes) ? (row.scopes as PartnerApiKeyScope[]) : [],
    rateLimitRpm: Number(row.rate_limit_rpm),
    monthlyCapEvents: Number(row.monthly_cap_events),
    revenueShareBps: Number(row.revenue_share_bps),
    status: String(row.status) as 'active' | 'revoked',
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    createdAt: String(row.created_at),
  };
}
