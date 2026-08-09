// Metadata-only repository secret scan ingest (account-scoped, live Carina Scout).
import { pool } from '../event-server/db.js';
import { MAX_INGEST_BYTES } from './constants.js';
import type { SecretScanIngestPayload } from './schema.js';
import { validateSecretScanIngest } from './schema.js';
import { verifyIngestSignature } from './signature.js';

export interface IngestContext {
  accountId: string;
  apiKey: string;
  correlationId: string;
  requestByteLength: number;
}

export type IngestResult =
  | {
      ok: true;
      status: 201 | 200;
      duplicate: boolean;
      scanRunId: string;
      connectorId: string;
      findingsAccepted: number;
      findingsDeduped: number;
      correlationId: string;
    }
  | {
      ok: false;
      status: number;
      code: string;
      correlationId: string;
    };

async function writeReceipt(params: {
  accountId: string;
  connectorId?: string | null;
  idempotencyKey?: string | null;
  clientScanId?: string | null;
  outcome: string;
  httpStatus: number;
  errorCode?: string | null;
  correlationId: string;
  findingsAccepted?: number;
  findingsDeduped?: number;
  requestByteLength?: number;
  schemaVersion?: string | null;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO repo_secret_ingestion_receipts (
         account_id, connector_id, idempotency_key, client_scan_id, outcome, http_status,
         error_code, correlation_id, findings_accepted, findings_deduped, request_byte_length, schema_version
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        params.accountId,
        params.connectorId ?? null,
        params.idempotencyKey ?? null,
        params.clientScanId ?? null,
        params.outcome,
        params.httpStatus,
        params.errorCode ?? null,
        params.correlationId,
        params.findingsAccepted ?? 0,
        params.findingsDeduped ?? 0,
        params.requestByteLength ?? null,
        params.schemaVersion ?? null,
      ],
    );
  } catch {
    // Never fail the caller because the audit insert failed.
  }
}

async function upsertConnector(
  accountId: string,
  payload: SecretScanIngestPayload,
): Promise<{ id: string }> {
  const existing = await pool.query<{ id: string; status: string; product: string | null }>(
    `SELECT id, status, product FROM repo_connectors
     WHERE account_id = $1 AND connector_key = $2 LIMIT 1`,
    [accountId, payload.connector_key],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].status !== 'active') {
      throw Object.assign(new Error('connector_revoked'), { code: 'connector_revoked' });
    }
    const updated = await pool.query<{ id: string }>(
      `UPDATE repo_connectors
       SET repository_alias = $2, product = COALESCE($3, product),
           last_ingest_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [existing.rows[0].id, payload.repository_alias, payload.product ?? null],
    );
    return updated.rows[0];
  }

  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO repo_connectors (account_id, connector_key, repository_alias, product, status, last_ingest_at)
     VALUES ($1,$2,$3,$4,'active', NOW())
     RETURNING id`,
    [accountId, payload.connector_key, payload.repository_alias, payload.product ?? null],
  );
  return inserted.rows[0];
}

async function mirrorFinding(params: {
  accountId: string;
  connectorId: string;
  finding: SecretScanIngestPayload['findings'][number];
  scannerName: string;
  existingScoutFindingId?: string | null;
}): Promise<string | null> {
  const title = `Exposed secret (${params.finding.rule_id})`;
  const raw = {
    source: 'repository_secret_scan',
    rule_id: params.finding.rule_id,
    relative_path: params.finding.relative_path ?? null,
    line: params.finding.line ?? null,
    commit_id: params.finding.commit_id ?? null,
    connector_id: params.connectorId,
    fingerprint: params.finding.fingerprint,
  };

  try {
    if (params.existingScoutFindingId) {
      await pool.query(
        `UPDATE findings
         SET severity = $2, title = $3, description = $4, raw_data = $5::jsonb,
             last_seen = NOW(), status = 'open'
         WHERE id = $1 AND account_id = $6`,
        [
          params.existingScoutFindingId,
          params.finding.severity,
          title,
          `Repository secret finding for rule ${params.finding.rule_id}`,
          JSON.stringify(raw),
          params.accountId,
        ],
      );
      return params.existingScoutFindingId;
    }

    const byFp = await pool.query<{ id: string }>(
      `SELECT id FROM findings
       WHERE account_id = $1
         AND finding_type = 'exposed_secret'
         AND raw_data->>'fingerprint' = $2
         AND status NOT IN ('false_positive', 'resolved')
       LIMIT 1`,
      [params.accountId, params.finding.fingerprint],
    );
    if (byFp.rows[0]) {
      await pool.query(
        `UPDATE findings
         SET severity = $2, title = $3, description = $4, raw_data = $5::jsonb,
             last_seen = NOW(), status = 'open'
         WHERE id = $1`,
        [
          byFp.rows[0].id,
          params.finding.severity,
          title,
          `Repository secret finding for rule ${params.finding.rule_id}`,
          JSON.stringify(raw),
        ],
      );
      return byFp.rows[0].id;
    }

    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO findings (
         account_id, scan_run_id, target_id, tool, finding_type, severity,
         title, description, raw_data, status
       ) VALUES ($1, NULL, NULL, $2, 'exposed_secret', $3, $4, $5, $6::jsonb, 'open')
       RETURNING id`,
      [
        params.accountId,
        params.scannerName,
        params.finding.severity,
        title,
        `Repository secret finding for rule ${params.finding.rule_id}`,
        JSON.stringify(raw),
      ],
    );
    return inserted.rows[0].id;
  } catch {
    // Mirror is best-effort; repo_secret_findings remains source of truth.
    return null;
  }
}

async function upsertSecretFinding(params: {
  accountId: string;
  connectorId: string;
  scanRunId: string;
  scannerName: string;
  finding: SecretScanIngestPayload['findings'][number];
}): Promise<'accepted' | 'deduped'> {
  const active = await pool.query<{ id: string; scout_finding_id: string | null }>(
    `SELECT id, scout_finding_id FROM repo_secret_findings
     WHERE account_id = $1 AND connector_id = $2 AND fingerprint = $3
       AND remediation_status NOT IN ('resolved', 'accepted-risk', 'false-positive')
     LIMIT 1`,
    [params.accountId, params.connectorId, params.finding.fingerprint],
  );

  if (active.rows[0]) {
    const scoutFindingId = await mirrorFinding({
      accountId: params.accountId,
      connectorId: params.connectorId,
      finding: params.finding,
      scannerName: params.scannerName,
      existingScoutFindingId: active.rows[0].scout_finding_id,
    });
    await pool.query(
      `UPDATE repo_secret_findings
       SET severity = $2, relative_path = COALESCE($3, relative_path),
           line_number = COALESCE($4, line_number), commit_id = COALESCE($5, commit_id),
           last_seen_at = NOW(), last_scan_run_id = $6, seen_count = seen_count + 1,
           scout_finding_id = COALESCE($7, scout_finding_id), updated_at = NOW()
       WHERE id = $1`,
      [
        active.rows[0].id,
        params.finding.severity,
        params.finding.relative_path ?? null,
        params.finding.line ?? null,
        params.finding.commit_id ?? null,
        params.scanRunId,
        scoutFindingId,
      ],
    );
    return 'deduped';
  }

  const closed = await pool.query<{ id: string; remediation_status: string; scout_finding_id: string | null }>(
    `SELECT id, remediation_status, scout_finding_id FROM repo_secret_findings
     WHERE account_id = $1 AND connector_id = $2 AND fingerprint = $3
       AND remediation_status IN ('resolved', 'accepted-risk', 'false-positive')
     ORDER BY updated_at DESC LIMIT 1`,
    [params.accountId, params.connectorId, params.finding.fingerprint],
  );

  if (closed.rows[0]) {
    const scoutFindingId = await mirrorFinding({
      accountId: params.accountId,
      connectorId: params.connectorId,
      finding: params.finding,
      scannerName: params.scannerName,
      existingScoutFindingId: closed.rows[0].scout_finding_id,
    });
    await pool.query(
      `UPDATE repo_secret_findings
       SET severity = $2, relative_path = COALESCE($3, relative_path),
           line_number = COALESCE($4, line_number), commit_id = COALESCE($5, commit_id),
           remediation_status = 'open', last_seen_at = NOW(), last_scan_run_id = $6,
           seen_count = seen_count + 1, scout_finding_id = COALESCE($7, scout_finding_id),
           resolution_evidence = NULL, accepted_risk_expires_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [
        closed.rows[0].id,
        params.finding.severity,
        params.finding.relative_path ?? null,
        params.finding.line ?? null,
        params.finding.commit_id ?? null,
        params.scanRunId,
        scoutFindingId,
      ],
    );
    await pool.query(
      `INSERT INTO repo_secret_remediation_events
         (account_id, finding_id, from_status, to_status, actor, reason)
       VALUES ($1,$2,$3,'open','system:ingest','finding reopened by subsequent scan')`,
      [params.accountId, closed.rows[0].id, closed.rows[0].remediation_status],
    );
    return 'accepted';
  }

  const scoutFindingId = await mirrorFinding({
    accountId: params.accountId,
    connectorId: params.connectorId,
    finding: params.finding,
    scannerName: params.scannerName,
  });

  await pool.query(
    `INSERT INTO repo_secret_findings (
       account_id, connector_id, scout_finding_id, fingerprint, rule_id, severity,
       relative_path, line_number, commit_id, remediation_status, last_scan_run_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open',$10)`,
    [
      params.accountId,
      params.connectorId,
      scoutFindingId,
      params.finding.fingerprint,
      params.finding.rule_id,
      params.finding.severity,
      params.finding.relative_path ?? null,
      params.finding.line ?? null,
      params.finding.commit_id ?? null,
      params.scanRunId,
    ],
  );
  return 'accepted';
}

export async function ingestSecretScan(ctx: IngestContext, body: unknown): Promise<IngestResult> {
  if (ctx.requestByteLength > MAX_INGEST_BYTES) {
    await writeReceipt({
      accountId: ctx.accountId,
      outcome: 'rejected',
      httpStatus: 413,
      errorCode: 'payload_too_large',
      correlationId: ctx.correlationId,
      requestByteLength: ctx.requestByteLength,
    });
    return { ok: false, status: 413, code: 'payload_too_large', correlationId: ctx.correlationId };
  }

  const validated = validateSecretScanIngest(body);
  if (!validated.ok) {
    await writeReceipt({
      accountId: ctx.accountId,
      outcome: 'rejected',
      httpStatus: 400,
      errorCode: validated.code,
      correlationId: ctx.correlationId,
      requestByteLength: ctx.requestByteLength,
    });
    return { ok: false, status: 400, code: validated.code, correlationId: ctx.correlationId };
  }

  const payload = validated.data;
  const sig = verifyIngestSignature({ apiKey: ctx.apiKey, payload });
  if (!sig.ok) {
    await writeReceipt({
      accountId: ctx.accountId,
      idempotencyKey: payload.idempotency_key,
      clientScanId: payload.scan_id,
      outcome: 'rejected',
      httpStatus: 401,
      errorCode: sig.code,
      correlationId: ctx.correlationId,
      requestByteLength: ctx.requestByteLength,
      schemaVersion: payload.schema_version,
    });
    return { ok: false, status: 401, code: sig.code, correlationId: ctx.correlationId };
  }

  const existingRun = await pool.query<{
    id: string;
    connector_id: string;
    findings_accepted: number;
    findings_deduped: number;
  }>(
    `SELECT id, connector_id, findings_accepted, findings_deduped
     FROM repo_secret_scan_runs
     WHERE account_id = $1 AND idempotency_key = $2 LIMIT 1`,
    [ctx.accountId, payload.idempotency_key],
  );
  if (existingRun.rows[0]) {
    const row = existingRun.rows[0];
    await writeReceipt({
      accountId: ctx.accountId,
      connectorId: row.connector_id,
      idempotencyKey: payload.idempotency_key,
      clientScanId: payload.scan_id,
      outcome: 'duplicate',
      httpStatus: 200,
      correlationId: ctx.correlationId,
      findingsAccepted: row.findings_accepted,
      findingsDeduped: row.findings_deduped,
      requestByteLength: ctx.requestByteLength,
      schemaVersion: payload.schema_version,
    });
    return {
      ok: true,
      status: 200,
      duplicate: true,
      scanRunId: row.id,
      connectorId: row.connector_id,
      findingsAccepted: row.findings_accepted,
      findingsDeduped: row.findings_deduped,
      correlationId: ctx.correlationId,
    };
  }

  let connector: { id: string };
  try {
    connector = await upsertConnector(ctx.accountId, payload);
  } catch (err) {
    const code = (err as { code?: string }).code === 'connector_revoked' ? 'connector_revoked' : 'error';
    await writeReceipt({
      accountId: ctx.accountId,
      idempotencyKey: payload.idempotency_key,
      clientScanId: payload.scan_id,
      outcome: code === 'connector_revoked' ? 'rejected' : 'error',
      httpStatus: code === 'connector_revoked' ? 403 : 500,
      errorCode: code,
      correlationId: ctx.correlationId,
      requestByteLength: ctx.requestByteLength,
      schemaVersion: payload.schema_version,
    });
    return {
      ok: false,
      status: code === 'connector_revoked' ? 403 : 500,
      code,
      correlationId: ctx.correlationId,
    };
  }

  const run = await pool.query<{ id: string }>(
    `INSERT INTO repo_secret_scan_runs (
       account_id, connector_id, client_scan_id, mode, scanner_name, scanner_version, status,
       started_at, completed_at, observed_at, count_critical, count_high, count_medium, count_low, count_info,
       hook_installed, hook_last_check_at, environment_policy_ok, environment_policy_detail,
       idempotency_key, signature_algorithm, signature_nonce, correlation_id
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
     ) RETURNING id`,
    [
      ctx.accountId,
      connector.id,
      payload.scan_id,
      payload.mode,
      payload.scanner_name,
      payload.scanner_version,
      payload.status,
      payload.started_at,
      payload.completed_at,
      payload.observed_at,
      payload.counts.critical,
      payload.counts.high,
      payload.counts.medium,
      payload.counts.low,
      payload.counts.info,
      payload.hook?.installed ?? null,
      payload.hook?.last_check_at ?? null,
      payload.environment_policy?.ok ?? null,
      payload.environment_policy?.detail ?? null,
      payload.idempotency_key,
      payload.signature.algorithm,
      payload.signature.nonce,
      ctx.correlationId,
    ],
  );

  let accepted = 0;
  let deduped = 0;
  if (payload.status !== 'failed') {
    for (const finding of payload.findings) {
      const outcome = await upsertSecretFinding({
        accountId: ctx.accountId,
        connectorId: connector.id,
        scanRunId: run.rows[0].id,
        scannerName: payload.scanner_name,
        finding,
      });
      if (outcome === 'accepted') accepted += 1;
      else deduped += 1;
    }
  }

  await pool.query(
    `UPDATE repo_secret_scan_runs
     SET findings_accepted = $2, findings_deduped = $3 WHERE id = $1`,
    [run.rows[0].id, accepted, deduped],
  );

  await writeReceipt({
    accountId: ctx.accountId,
    connectorId: connector.id,
    idempotencyKey: payload.idempotency_key,
    clientScanId: payload.scan_id,
    outcome: 'accepted',
    httpStatus: 201,
    correlationId: ctx.correlationId,
    findingsAccepted: accepted,
    findingsDeduped: deduped,
    requestByteLength: ctx.requestByteLength,
    schemaVersion: payload.schema_version,
  });

  return {
    ok: true,
    status: 201,
    duplicate: false,
    scanRunId: run.rows[0].id,
    connectorId: connector.id,
    findingsAccepted: accepted,
    findingsDeduped: deduped,
    correlationId: ctx.correlationId,
  };
}
