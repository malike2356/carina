import { pool } from '../../memory/db.js';
import { encryptCredentials, decryptCredentials } from '../../channels/credential-store.js';

export type ToolSessionRecord = {
  id: string;
  toolSlug: string;
  provider: string;
  credentials: Record<string, string>;
  meta: Record<string, unknown>;
  expiresAt: string | null;
  lastProbeAt: string | null;
  lastProbeOk: boolean | null;
};

export async function upsertToolSession(input: {
  workspaceId: string;
  workerId: string;
  toolSlug: string;
  provider?: string;
  credentials: Record<string, string>;
  meta?: Record<string, unknown>;
  expiresAt?: Date | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO aiva_product_tool_sessions
      (workspace_id, worker_id, tool_slug, provider, credentials_enc, meta, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW())
     ON CONFLICT (worker_id, tool_slug) DO UPDATE SET
       provider = EXCLUDED.provider,
       credentials_enc = EXCLUDED.credentials_enc,
       meta = EXCLUDED.meta,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()`,
    [
      input.workspaceId,
      input.workerId,
      input.toolSlug,
      input.provider ?? '',
      encryptCredentials(input.credentials),
      JSON.stringify(input.meta ?? {}),
      input.expiresAt?.toISOString() ?? null,
    ],
  );
}

export async function getToolSession(
  workspaceId: string,
  workerId: string,
  toolSlug: string,
): Promise<ToolSessionRecord | null> {
  const result = await pool.query(
    `SELECT * FROM aiva_product_tool_sessions
     WHERE workspace_id = $1 AND worker_id = $2 AND tool_slug = $3`,
    [workspaceId, workerId, toolSlug],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: String(row.id),
    toolSlug: String(row.tool_slug),
    provider: String(row.provider ?? ''),
    credentials: decryptCredentials(String(row.credentials_enc)),
    meta: (row.meta && typeof row.meta === 'object') ? row.meta as Record<string, unknown> : {},
    expiresAt: row.expires_at ? new Date(String(row.expires_at)).toISOString() : null,
    lastProbeAt: row.last_probe_at ? new Date(String(row.last_probe_at)).toISOString() : null,
    lastProbeOk: row.last_probe_ok == null ? null : Boolean(row.last_probe_ok),
  };
}

export async function markSessionProbe(
  workspaceId: string,
  workerId: string,
  toolSlug: string,
  ok: boolean,
  error?: string,
): Promise<void> {
  await pool.query(
    `UPDATE aiva_product_tool_sessions
     SET last_probe_at = NOW(), last_probe_ok = $4, updated_at = NOW(),
         meta = meta || jsonb_build_object('lastProbeError', $5::text)
     WHERE workspace_id = $1 AND worker_id = $2 AND tool_slug = $3`,
    [workspaceId, workerId, toolSlug, ok, error ?? ''],
  );
  await pool.query(
    `UPDATE aiva_worker_tool_grants
     SET last_probe_at = NOW(), last_probe_ok = $4, last_probe_error = $5,
         status = CASE WHEN $4 THEN 'connected' ELSE 'needs_reauth' END,
         updated_at = NOW()
     WHERE workspace_id = $1 AND worker_id = $2 AND tool_slug = $3`,
    [workspaceId, workerId, toolSlug, ok, ok ? null : (error ?? 'probe_failed')],
  );
}

export async function deleteToolSession(
  workspaceId: string,
  workerId: string,
  toolSlug: string,
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM aiva_product_tool_sessions
     WHERE workspace_id = $1 AND worker_id = $2 AND tool_slug = $3`,
    [workspaceId, workerId, toolSlug],
  );
  await pool.query(
    `UPDATE aiva_worker_tool_grants
     SET status = 'disconnected', last_probe_ok = false, updated_at = NOW()
     WHERE workspace_id = $1 AND worker_id = $2 AND tool_slug = $3`,
    [workspaceId, workerId, toolSlug],
  ).catch(() => undefined);
  return (result.rowCount ?? 0) > 0;
}
