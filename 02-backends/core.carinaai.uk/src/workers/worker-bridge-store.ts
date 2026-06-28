import { decryptCredentials, encryptCredentials } from '../channels/credential-store.js';
import { pool } from '../memory/db.js';
import type { PropreneurBridgeBinding } from '../bridges/propreneur-bridge.types.js';
import { getPortfolio } from '../bridges/propreneur-bridge.js';
import type { Worker, WorkerConfig } from '../types/index.js';
import { deleteEmailConnection, updateConnectionStatus } from '../ingestion/email/email-connection-store.js';
import { clearPortfolioContextCache } from './portfolio-context.js';
import { getWorkerById } from './worker-store.js';

function parseWorkerConfig(raw: unknown): WorkerConfig {
  if (!raw || typeof raw !== 'object') return {};
  return raw as WorkerConfig;
}

export async function setPropreneurBinding(
  workspaceId: string,
  workerId: string,
  tenantSlug: string,
  apiKey: string,
): Promise<void> {
  const encrypted = encryptCredentials({ apiKey });
  await pool.query(
    `UPDATE ai_workers
     SET propreneur_tenant_slug = $3,
         propreneur_bridge_key_ref = $4,
         updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2`,
    [workerId, workspaceId, tenantSlug.trim(), encrypted],
  );
  clearPortfolioContextCache(workerId);
}

/** Smoke-test portfolio read before persisting bridge credentials. */
export async function validateAndSetPropreneurBinding(
  workspaceId: string,
  workerId: string,
  tenantSlug: string,
  apiKey: string,
): Promise<{ tenantSlug: string; propertyCount: number }> {
  const slug = tenantSlug.trim();
  const binding: PropreneurBridgeBinding = { tenantSlug: slug, apiKey: apiKey.trim() };
  const portfolio = await getPortfolio(binding);
  await setPropreneurBinding(workspaceId, workerId, slug, apiKey);
  await deleteEmailConnection(workerId).catch(() => {});
  await updateConnectionStatus(workerId, 'disconnected').catch(() => {});
  return { tenantSlug: slug, propertyCount: portfolio.total };
}

export async function clearPropreneurBinding(workspaceId: string, workerId: string): Promise<void> {
  await pool.query(
    `UPDATE ai_workers
     SET propreneur_tenant_slug = NULL,
         propreneur_bridge_key_ref = NULL,
         updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2`,
    [workerId, workspaceId],
  );
  clearPortfolioContextCache(workerId);
}

export function resolvePropreneurBinding(worker: Worker): PropreneurBridgeBinding | null {
  if (!worker.propreneurTenantSlug || !worker.propreneurBridgeKeyRef) return null;
  try {
    const creds = decryptCredentials(worker.propreneurBridgeKeyRef);
    const apiKey = creds.apiKey ?? '';
    if (!apiKey) return null;
    return { tenantSlug: worker.propreneurTenantSlug, apiKey };
  } catch {
    return null;
  }
}

export async function updateWorkerConfig(
  workspaceId: string,
  workerId: string,
  patch: WorkerConfig,
): Promise<WorkerConfig> {
  const current = await pool.query(
    'SELECT worker_config FROM ai_workers WHERE id = $1 AND workspace_id = $2',
    [workerId, workspaceId],
  );
  if (current.rows.length === 0) {
    throw new Error('Worker not found');
  }
  const existing = parseWorkerConfig(current.rows[0].worker_config);
  const merged: WorkerConfig = {
    ...existing,
    ...patch,
    summary: {
      ...existing.summary,
      ...patch.summary,
    },
  };
  await pool.query(
    `UPDATE ai_workers SET worker_config = $3, updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2`,
    [workerId, workspaceId, JSON.stringify(merged)],
  );
  return merged;
}

export async function listWorkersWithSummaryEnabled(): Promise<Worker[]> {
  const result = await pool.query(
    `SELECT id FROM ai_workers
     WHERE status = 'active'
       AND (worker_config->'summary'->>'enabled') = 'true'`,
  );
  const workers: Worker[] = [];
  for (const row of result.rows) {
    const worker = await getWorkerById(String(row.id));
    if (worker) workers.push(worker);
  }
  return workers;
}
