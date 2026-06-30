import { encryptCredentials, decryptCredentials, credentialsConfigured } from '../channels/credential-store.js';
import { pool } from '../memory/db.js';

export type AivaScoutStatus = 'pending' | 'connected' | 'disconnected';

export interface AivaScoutWorkspace {
  workspaceId: string;
  scoutWorkspaceId: string | null;
  scoutStatus: AivaScoutStatus;
  scoutDashboardUrl: string | null;
  scoutProvisionedAt: Date | null;
  scoutLastHeartbeatAt: Date | null;
  scoutProvisionAttempts: number;
  scoutNextRetryAt: Date | null;
}

function rowToScout(row: Record<string, unknown>): AivaScoutWorkspace {
  return {
    workspaceId: String(row.workspace_id),
    scoutWorkspaceId: row.scout_workspace_id ? String(row.scout_workspace_id) : null,
    scoutStatus: String(row.scout_status ?? 'pending') as AivaScoutStatus,
    scoutDashboardUrl: row.scout_dashboard_url ? String(row.scout_dashboard_url) : null,
    scoutProvisionedAt: row.scout_provisioned_at ? new Date(String(row.scout_provisioned_at)) : null,
    scoutLastHeartbeatAt: row.scout_last_heartbeat_at
      ? new Date(String(row.scout_last_heartbeat_at))
      : null,
    scoutProvisionAttempts: Number(row.scout_provision_attempts ?? 0),
    scoutNextRetryAt: row.scout_next_retry_at ? new Date(String(row.scout_next_retry_at)) : null,
  };
}

export async function getAivaScoutWorkspace(workspaceId: string): Promise<AivaScoutWorkspace | null> {
  const result = await pool.query(
    `SELECT workspace_id, scout_workspace_id, scout_status, scout_dashboard_url,
            scout_provisioned_at, scout_last_heartbeat_at, scout_provision_attempts, scout_next_retry_at
     FROM aiva_subscriptions WHERE workspace_id = $1`,
    [workspaceId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return rowToScout(row as Record<string, unknown>);
}

export async function storeAivaScoutCredentials(input: {
  workspaceId: string;
  scoutWorkspaceId: string;
  scoutApiKey: string;
  scoutDashboardUrl: string;
}): Promise<void> {
  const encrypted = credentialsConfigured()
    ? encryptCredentials({ scout_api_key: input.scoutApiKey })
    : input.scoutApiKey;

  await pool.query(
    `UPDATE aiva_subscriptions SET
       scout_workspace_id = $2,
       scout_api_key_encrypted = $3,
       scout_status = 'connected',
       scout_dashboard_url = $4,
       scout_provisioned_at = NOW(),
       scout_provision_attempts = scout_provision_attempts + 1,
       scout_next_retry_at = NULL,
       updated_at = NOW()
     WHERE workspace_id = $1`,
    [input.workspaceId, input.scoutWorkspaceId, encrypted, input.scoutDashboardUrl],
  );
}

export async function markAivaScoutPending(input: {
  workspaceId: string;
  nextRetryAt: Date;
}): Promise<void> {
  await pool.query(
    `UPDATE aiva_subscriptions SET
       scout_status = 'pending',
       scout_provision_attempts = scout_provision_attempts + 1,
       scout_next_retry_at = $2,
       updated_at = NOW()
     WHERE workspace_id = $1`,
    [input.workspaceId, input.nextRetryAt.toISOString()],
  );
}

export async function markAivaScoutDisconnected(workspaceId: string): Promise<void> {
  await pool.query(
    `UPDATE aiva_subscriptions SET scout_status = 'disconnected', updated_at = NOW()
     WHERE workspace_id = $1`,
    [workspaceId],
  );
}

export async function touchAivaScoutHeartbeat(workspaceId: string): Promise<void> {
  await pool.query(
    `UPDATE aiva_subscriptions SET
       scout_last_heartbeat_at = NOW(),
       scout_status = CASE WHEN scout_status = 'disconnected' THEN 'connected' ELSE scout_status END,
       updated_at = NOW()
     WHERE workspace_id = $1`,
    [workspaceId],
  );
}

export async function getAivaScoutApiKey(workspaceId: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT scout_api_key_encrypted FROM aiva_subscriptions WHERE workspace_id = $1',
    [workspaceId],
  );
  const blob = result.rows[0]?.scout_api_key_encrypted as string | undefined;
  if (!blob) return null;
  if (!credentialsConfigured()) return blob;
  try {
    const creds = decryptCredentials(blob);
    return creds.scout_api_key ?? null;
  } catch {
    return null;
  }
}

export async function listScoutRetryCandidates(): Promise<AivaScoutWorkspace[]> {
  const result = await pool.query(
    `SELECT workspace_id, scout_workspace_id, scout_status, scout_dashboard_url,
            scout_provisioned_at, scout_last_heartbeat_at, scout_provision_attempts, scout_next_retry_at
     FROM aiva_subscriptions
     WHERE scout_status = 'pending'
       AND status IN ('active', 'trialing')
       AND (scout_next_retry_at IS NULL OR scout_next_retry_at <= NOW())
       AND scout_provision_attempts < 48
     ORDER BY scout_next_retry_at ASC NULLS FIRST
     LIMIT 20`,
  );
  return result.rows.map((row) => rowToScout(row as Record<string, unknown>));
}

export async function listConnectedScoutWorkspaces(): Promise<string[]> {
  const result = await pool.query(
    `SELECT workspace_id FROM aiva_subscriptions
     WHERE scout_status = 'connected' AND scout_workspace_id IS NOT NULL`,
  );
  return result.rows.map((row) => String(row.workspace_id));
}
