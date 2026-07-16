/**
 * Pending client approval for external API tokens.
 * Unknown fingerprints get 403 pending-approval until the tenant allows them.
 */

import { pool } from '../memory/db.js';
import { appendSecurityAudit } from './security-audit.js';
import type { ClientFingerprintParts } from './client-fingerprint.js';

export type ClientApprovalStatus = 'pending' | 'approved' | 'denied' | 'revoked' | 'expired';

export interface ClientApprovalRecord {
  id: number;
  tenantId: string;
  tokenId: string;
  fingerprint: string;
  status: ClientApprovalStatus;
  requestedScopes: string[];
  ipHash: string | null;
  uaHash: string | null;
  uaSummary: string | null;
  clientHint: string | null;
  lastSeenAt: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientAccessDecision {
  allowed: boolean;
  status: ClientApprovalStatus | 'suspended';
  approval?: ClientApprovalRecord;
  code?: string;
  message?: string;
  retryAfterSeconds?: number;
}

const DEFAULT_APPROVAL_DAYS = 30;
let schemaReady: Promise<void> | null = null;

export function clientApprovalEnabled(): boolean {
  return process.env.AIVA_CLIENT_APPROVAL !== 'false';
}

export async function ensureClientApprovalSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aiva_client_approvals (
          id BIGSERIAL PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          token_id TEXT NOT NULL,
          fingerprint TEXT NOT NULL,
          status TEXT NOT NULL,
          requested_scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
          ip_hash TEXT,
          ua_hash TEXT,
          ua_summary TEXT,
          client_hint TEXT,
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (tenant_id, token_id, fingerprint)
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS aiva_client_approvals_tenant_status_idx
          ON aiva_client_approvals (tenant_id, status, updated_at DESC)
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aiva_token_baselines (
          token_id TEXT PRIMARY KEY,
          known_ua_hashes JSONB NOT NULL DEFAULT '[]'::jsonb,
          known_ip_hashes JSONB NOT NULL DEFAULT '[]'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aiva_token_suspensions (
          token_id TEXT PRIMARY KEY,
          reason TEXT NOT NULL,
          suspended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          suspended_until TIMESTAMPTZ,
          cleared_at TIMESTAMPTZ
        )
      `);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

function mapRow(row: Record<string, unknown>): ClientApprovalRecord {
  return {
    id: Number(row.id),
    tenantId: String(row.tenant_id),
    tokenId: String(row.token_id),
    fingerprint: String(row.fingerprint),
    status: String(row.status) as ClientApprovalStatus,
    requestedScopes: Array.isArray(row.requested_scopes)
      ? (row.requested_scopes as string[])
      : [],
    ipHash: row.ip_hash ? String(row.ip_hash) : null,
    uaHash: row.ua_hash ? String(row.ua_hash) : null,
    uaSummary: row.ua_summary ? String(row.ua_summary) : null,
    clientHint: row.client_hint ? String(row.client_hint) : null,
    lastSeenAt: new Date(String(row.last_seen_at)).toISOString(),
    expiresAt: row.expires_at ? new Date(String(row.expires_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function isTokenSuspended(tokenId: string): Promise<{ suspended: boolean; reason?: string }> {
  await ensureClientApprovalSchema();
  const result = await pool.query(
    `SELECT reason, suspended_until FROM aiva_token_suspensions
     WHERE token_id = $1 AND cleared_at IS NULL
     LIMIT 1`,
    [tokenId],
  );
  const row = result.rows[0];
  if (!row) return { suspended: false };
  if (row.suspended_until && new Date(String(row.suspended_until)).getTime() < Date.now()) {
    await pool.query(
      `UPDATE aiva_token_suspensions SET cleared_at = NOW() WHERE token_id = $1 AND cleared_at IS NULL`,
      [tokenId],
    );
    return { suspended: false };
  }
  return { suspended: true, reason: String(row.reason) };
}

export async function suspendToken(tokenId: string, reason: string, until?: Date): Promise<void> {
  await ensureClientApprovalSchema();
  await pool.query(
    `INSERT INTO aiva_token_suspensions (token_id, reason, suspended_until, cleared_at)
     VALUES ($1, $2, $3, NULL)
     ON CONFLICT (token_id) DO UPDATE SET
       reason = EXCLUDED.reason,
       suspended_at = NOW(),
       suspended_until = EXCLUDED.suspended_until,
       cleared_at = NULL`,
    [tokenId, reason, until?.toISOString() ?? null],
  );
  appendSecurityAudit({
    category: 'token_anomaly',
    action: 'token_suspended',
    detail: reason,
    metadata: { tokenId },
  });
}

export async function unsuspendToken(tokenId: string): Promise<boolean> {
  await ensureClientApprovalSchema();
  const result = await pool.query(
    `UPDATE aiva_token_suspensions SET cleared_at = NOW()
     WHERE token_id = $1 AND cleared_at IS NULL
     RETURNING token_id`,
    [tokenId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function learnTokenBaseline(
  tokenId: string,
  parts: Pick<ClientFingerprintParts, 'uaHash' | 'ipHash'>,
): Promise<void> {
  await ensureClientApprovalSchema();
  const existing = await pool.query(
    `SELECT known_ua_hashes, known_ip_hashes FROM aiva_token_baselines WHERE token_id = $1`,
    [tokenId],
  );
  const row = existing.rows[0];
  const uas = new Set<string>(Array.isArray(row?.known_ua_hashes) ? row.known_ua_hashes : []);
  const ips = new Set<string>(Array.isArray(row?.known_ip_hashes) ? row.known_ip_hashes : []);
  if (parts.uaHash) uas.add(parts.uaHash);
  if (parts.ipHash) ips.add(parts.ipHash);
  await pool.query(
    `INSERT INTO aiva_token_baselines (token_id, known_ua_hashes, known_ip_hashes, updated_at)
     VALUES ($1, $2::jsonb, $3::jsonb, NOW())
     ON CONFLICT (token_id) DO UPDATE SET
       known_ua_hashes = EXCLUDED.known_ua_hashes,
       known_ip_hashes = EXCLUDED.known_ip_hashes,
       updated_at = NOW()`,
    [tokenId, JSON.stringify([...uas]), JSON.stringify([...ips])],
  );
}

export async function getTokenBaseline(tokenId: string): Promise<{
  knownUaHashes: string[];
  knownIpHashes: string[];
}> {
  await ensureClientApprovalSchema();
  const result = await pool.query(
    `SELECT known_ua_hashes, known_ip_hashes FROM aiva_token_baselines WHERE token_id = $1`,
    [tokenId],
  );
  const row = result.rows[0];
  return {
    knownUaHashes: Array.isArray(row?.known_ua_hashes) ? row.known_ua_hashes.map(String) : [],
    knownIpHashes: Array.isArray(row?.known_ip_hashes) ? row.known_ip_hashes.map(String) : [],
  };
}

export async function ensureClientAccess(input: {
  tenantId: string;
  tokenId: string;
  fingerprint: ClientFingerprintParts;
  requestedScopes?: string[];
}): Promise<ClientAccessDecision> {
  await ensureClientApprovalSchema();

  const suspended = await isTokenSuspended(input.tokenId);
  if (suspended.suspended) {
    return {
      allowed: false,
      status: 'suspended',
      code: 'TOKEN_SUSPENDED',
      message: suspended.reason ?? 'This API token is suspended pending security review.',
    };
  }

  if (!clientApprovalEnabled()) {
    await learnTokenBaseline(input.tokenId, input.fingerprint);
    return { allowed: true, status: 'approved' };
  }

  const existing = await pool.query(
    `SELECT * FROM aiva_client_approvals
     WHERE tenant_id = $1 AND token_id = $2 AND fingerprint = $3
     LIMIT 1`,
    [input.tenantId, input.tokenId, input.fingerprint.fingerprint],
  );

  if (existing.rows[0]) {
    const record = mapRow(existing.rows[0] as Record<string, unknown>);
    await pool.query(
      `UPDATE aiva_client_approvals SET last_seen_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [record.id],
    );

    if (record.status === 'approved') {
      if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
        await pool.query(
          `UPDATE aiva_client_approvals SET status = 'expired', updated_at = NOW() WHERE id = $1`,
          [record.id],
        );
        return {
          allowed: false,
          status: 'expired',
          approval: { ...record, status: 'expired' },
          code: 'CLIENT_APPROVAL_EXPIRED',
          message: 'Client approval has expired. Request access again.',
        };
      }
      return { allowed: true, status: 'approved', approval: record };
    }

    if (record.status === 'denied' || record.status === 'revoked') {
      return {
        allowed: false,
        status: record.status,
        approval: record,
        code: 'CLIENT_APPROVAL_DENIED',
        message: 'This client was denied access to the API.',
      };
    }

    return {
      allowed: false,
      status: 'pending',
      approval: record,
      code: 'CLIENT_PENDING_APPROVAL',
      message: 'Access pending approval. An admin must approve this client.',
      retryAfterSeconds: 300,
    };
  }

  const insert = await pool.query(
    `INSERT INTO aiva_client_approvals
       (tenant_id, token_id, fingerprint, status, requested_scopes, ip_hash, ua_hash, ua_summary, client_hint)
     VALUES ($1, $2, $3, 'pending', $4::jsonb, $5, $6, $7, $8)
     ON CONFLICT (tenant_id, token_id, fingerprint)
     DO UPDATE SET last_seen_at = NOW(), updated_at = NOW()
     RETURNING *`,
    [
      input.tenantId,
      input.tokenId,
      input.fingerprint.fingerprint,
      JSON.stringify(input.requestedScopes ?? []),
      input.fingerprint.ipHash,
      input.fingerprint.uaHash,
      input.fingerprint.uaSummary,
      input.fingerprint.clientHint,
    ],
  );
  const approval = mapRow(insert.rows[0] as Record<string, unknown>);
  appendSecurityAudit({
    category: 'client_approval',
    action: 'pending',
    detail: `New client pending approval for token ${input.tokenId}`,
    metadata: {
      tenantId: input.tenantId,
      tokenId: input.tokenId,
      fingerprint: input.fingerprint.fingerprint,
      uaSummary: input.fingerprint.uaSummary,
    },
  });
  notifyOwnerPendingClient(approval);

  return {
    allowed: false,
    status: 'pending',
    approval,
    code: 'CLIENT_PENDING_APPROVAL',
    message: 'Access pending approval. Check the security dashboard to allow this client.',
    retryAfterSeconds: 300,
  };
}

function notifyOwnerPendingClient(approval: ClientApprovalRecord): void {
  console.warn(
    `[client-approval] Pending client for tenant=${approval.tenantId} token=${approval.tokenId}`
      + ` fingerprint=${approval.fingerprint} ua=${approval.uaSummary ?? 'unknown'}`,
  );
}

export async function listClientApprovals(
  tenantId: string,
  status?: ClientApprovalStatus,
): Promise<ClientApprovalRecord[]> {
  await ensureClientApprovalSchema();
  const params: unknown[] = [tenantId];
  let sql = `SELECT * FROM aiva_client_approvals WHERE tenant_id = $1`;
  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }
  sql += ' ORDER BY updated_at DESC LIMIT 200';
  const result = await pool.query(sql, params);
  return result.rows.map((row) => mapRow(row as Record<string, unknown>));
}

export async function listTokenSuspensions(tenantId: string): Promise<Array<{
  tokenId: string;
  reason: string;
  suspendedAt: string;
  suspendedUntil: string | null;
}>> {
  await ensureClientApprovalSchema();
  const result = await pool.query(
    `SELECT s.token_id, s.reason, s.suspended_at, s.suspended_until
     FROM aiva_token_suspensions s
     WHERE s.cleared_at IS NULL
       AND s.token_id IN (
         SELECT DISTINCT token_id FROM aiva_client_approvals WHERE tenant_id = $1
         UNION
         SELECT id::text FROM partner_api_keys WHERE partner_id = $1
       )
     ORDER BY s.suspended_at DESC
     LIMIT 100`,
    [tenantId],
  );
  return result.rows.map((row) => ({
    tokenId: String(row.token_id),
    reason: String(row.reason),
    suspendedAt: new Date(String(row.suspended_at)).toISOString(),
    suspendedUntil: row.suspended_until
      ? new Date(String(row.suspended_until)).toISOString()
      : null,
  }));
}

export async function decideClientApproval(input: {
  tenantId: string;
  approvalId: number;
  decision: 'approved' | 'denied' | 'revoked';
  expiresInDays?: number;
}): Promise<ClientApprovalRecord | null> {
  await ensureClientApprovalSchema();
  const expiresAt = input.decision === 'approved'
    ? new Date(Date.now() + (input.expiresInDays ?? DEFAULT_APPROVAL_DAYS) * 86_400_000)
    : null;
  const result = await pool.query(
    `UPDATE aiva_client_approvals
     SET status = $3,
         expires_at = $4,
         updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2
     RETURNING *`,
    [input.tenantId, input.approvalId, input.decision, expiresAt?.toISOString() ?? null],
  );
  if (!result.rows[0]) return null;
  const record = mapRow(result.rows[0] as Record<string, unknown>);
  if (input.decision === 'approved' && record.uaHash && record.ipHash) {
    await learnTokenBaseline(record.tokenId, {
      uaHash: record.uaHash,
      ipHash: record.ipHash,
    });
  }
  appendSecurityAudit({
    category: 'client_approval',
    action: input.decision,
    detail: `Client approval ${input.decision}`,
    metadata: { tenantId: input.tenantId, approvalId: input.approvalId, tokenId: record.tokenId },
  });
  return record;
}
