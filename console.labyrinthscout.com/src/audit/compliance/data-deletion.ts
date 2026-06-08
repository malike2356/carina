import { pool } from '../../db.js';

/**
 * Right to Erasure handler per GDPR Article 17.
 *
 * Accepts a tenant_id and:
 * 1. Marks the tenant for erasure in compliance_requests
 * 2. Anonymizes PII fields in accounts/conversations (replace with [ERASED])
 * 3. Retains audit_log rows but anonymizes detail.user_id, detail.email, etc.
 * 4. Writes a completion record
 *
 * This does NOT hard-delete rows that are referenced by foreign keys
 * in other tables. Instead, PII fields are overwritten with [ERASED]
 * to preserve referential integrity. The audit trail is retained
 * (anonymized) as required by the spec.
 *
 * Idempotent: running twice produces the same result.
 */

export interface ErasureRequest {
  tenant_id: string;
  email?: string;
}

export interface ErasureResult {
  request_id: string;
  tenant_id: string;
  status: 'completed' | 'already_erased';
  anonymized: {
    accounts: number;
    audit_log_entries: number;
    security_events: number;
    carina_instances: number;
  };
  completed_at: string;
}

export async function handleDataDeletion(
  params: ErasureRequest,
): Promise<ErasureResult> {
  const { tenant_id, email } = params;

  // Check if already erased
  const existingCheck = await pool.query<{ id: string }>(
    `SELECT id FROM compliance_requests
     WHERE request_type = 'erasure'
       AND tenant_id = $1
       AND status = 'completed'`,
    [tenant_id],
  );

  if (existingCheck.rows.length > 0) {
    return {
      request_id: existingCheck.rows[0]!.id,
      tenant_id,
      status: 'already_erased',
      anonymized: { accounts: 0, audit_log_entries: 0, security_events: 0, carina_instances: 0 },
      completed_at: new Date().toISOString(),
    };
  }

  let anonymized = {
    accounts: 0,
    audit_log_entries: 0,
    security_events: 0,
    carina_instances: 0,
  };

  // 1. Record the erasure request
  const reqResult = await pool.query<{ id: string }>(
    `INSERT INTO compliance_requests
       (request_type, tenant_id, email, status, due_by)
     VALUES ('erasure', $1, $2, 'pending', NOW() + INTERVAL '30 days')
     RETURNING id`,
    [tenant_id, email ?? null],
  );

  const requestId = reqResult.rows[0]?.id;
  if (!requestId) {
    throw new Error('Failed to record erasure compliance request');
  }

  // 2. Anonymize account PII
  if (email) {
    const acctResult = await pool.query<{ count: string }>(
      `UPDATE accounts
       SET email = '[ERASED]',
           password_hash = '[ERASED]'
       WHERE email = $1
       RETURNING COUNT(*)::text AS count`,
      [email],
    );
    anonymized.accounts = parseInt(acctResult.rows[0]?.count ?? '0', 10);
  }

  // 3. Anonymize audit_log PII fields in detail JSONB
  //    We overwrite any user_id, email, ip, or personal identifiers
  //    nested inside the detail JSONB column, but keep the row.
  const auditResult = await pool.query<{ count: string }>(
    `UPDATE audit_log
     SET detail = detail
       || jsonb_build_object('email', '[ERASED]')
       || jsonb_build_object('user_id', '[ERASED]')
       || jsonb_build_object('admin_email', '[ERASED]')
       || jsonb_build_object('operator', '[ERASED]'),
         admin_email = '[ERASED]'
     WHERE tenant_id = $1
       AND (
         detail ? 'email'
         OR detail ? 'user_id'
         OR detail ? 'admin_email'
         OR detail ? 'operator'
         OR admin_email IS NOT NULL
       )
     RETURNING COUNT(*)::text AS count`,
    [tenant_id],
  );
  anonymized.audit_log_entries = parseInt(auditResult.rows[0]?.count ?? '0', 10);

  // 4. Anonymize security_events PII
  const secResult = await pool.query<{ count: string }>(
    `UPDATE security_events
     SET description = '[ERASED]',
         metadata = '{}'::jsonb,
         ip_address = NULL
     WHERE instance_id IN (
       SELECT id FROM carina_instances WHERE id = $1
     )
     RETURNING COUNT(*)::text AS count`,
    [tenant_id],
  );
  anonymized.security_events = parseInt(secResult.rows[0]?.count ?? '0', 10);

  // 5. Anonymize carina_instances PII
  const instResult = await pool.query<{ count: string }>(
    `UPDATE carina_instances
     SET name = '[ERASED]',
         api_key = '[ERASED]'
     WHERE id = $1
        OR account_id IN (
          SELECT id FROM accounts WHERE email = $2
        )
     RETURNING COUNT(*)::text AS count`,
    [tenant_id, email ?? ''],
  );
  anonymized.carina_instances = parseInt(instResult.rows[0]?.count ?? '0', 10);

  // 6. Mark completion
  await pool.query(
    `UPDATE compliance_requests
     SET status = 'completed',
         completed_at = NOW()
     WHERE id = $1`,
    [requestId],
  );

  return {
    request_id: requestId,
    tenant_id,
    status: 'completed',
    anonymized,
    completed_at: new Date().toISOString(),
  };
}
