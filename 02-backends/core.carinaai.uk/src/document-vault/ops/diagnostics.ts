/** Operator diagnostics for Document Vault async stages (prompt 714). */

import type { VaultSearchHost } from '../search/host.js';

export function buildDiagnostics(
  host: VaultSearchHost,
  workspaceId: string,
  extras: {
    google?: Record<string, unknown> | null;
    quota?: { maxBytes?: number; usedBytes?: number } | null;
  } = {},
): Record<string, unknown> {
  const jobs = host.listJobs(workspaceId);
  const byStatus: Record<string, number> = {};
  for (const job of jobs) {
    const status = String(job.status || 'unknown');
    byStatus[status] = (byStatus[status] || 0) + 1;
  }

  const indexRows = host.listIndexEntries(workspaceId);
  const indexByStatus: Record<string, number> = {};
  for (const row of indexRows) {
    const status = String(row.status || 'unknown');
    indexByStatus[status] = (indexByStatus[status] || 0) + 1;
  }

  const drive = extras.google || {};
  const watchExpires = drive.channel_expires_at ?? drive.channelExpiresAt ?? null;
  let watchExpired = false;
  if (watchExpires) {
    try {
      watchExpired = new Date(String(watchExpires)).getTime() <= Date.now();
    } catch {
      watchExpired = false;
    }
  }

  const orphans = host.scanOrphanIndexEntries(workspaceId);
  return {
    ok: true,
    workspace_id: workspaceId,
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    jobs: {
      total: jobs.length,
      by_status: byStatus,
      dead_letters: byStatus.dead_letter || 0,
      queued: byStatus.queued || 0,
      running: byStatus.running || 0,
    },
    index: {
      total: indexRows.length,
      by_status: indexByStatus,
      lag_pending: (indexByStatus.pending || 0) + (byStatus.queued || 0),
      errors: indexByStatus.error || 0,
    },
    google: {
      connected: Boolean(drive.connected),
      last_error: drive.last_error ?? drive.lastError ?? null,
      last_sync_at: drive.last_sync_at ?? drive.lastSyncAt ?? null,
      watch_expires_at: watchExpires,
      watch_expired: watchExpired,
      oauth_failure: Boolean(drive.last_error ?? drive.lastError),
    },
    quota: extras.quota ?? null,
    orphans: {
      index_entries_without_item: orphans.length,
      sample: orphans.slice(0, 10),
    },
    malware_hook: { engine: process.env.DOCUMENT_VAULT_MALWARE_ENGINE || 'noop', note: 'operator replaceable' },
    alerts: buildAlerts(byStatus, indexByStatus, orphans.length, watchExpired, drive),
  };
}

function buildAlerts(
  byStatus: Record<string, number>,
  indexByStatus: Record<string, number>,
  orphanCount: number,
  watchExpired: boolean,
  drive: Record<string, unknown>,
): Array<{ code: string; severity: string; message: string }> {
  const alerts: Array<{ code: string; severity: string; message: string }> = [];
  if ((byStatus.dead_letter || 0) > 0) {
    alerts.push({
      code: 'job_dead_letter',
      severity: 'high',
      message: `${byStatus.dead_letter} jobs in dead_letter`,
    });
  }
  if ((indexByStatus.error || 0) > 0) {
    alerts.push({
      code: 'index_error',
      severity: 'medium',
      message: `${indexByStatus.error} index entries in error`,
    });
  }
  if ((byStatus.queued || 0) > 50) {
    alerts.push({
      code: 'index_lag',
      severity: 'medium',
      message: `${byStatus.queued} queued jobs (conversion/index lag)`,
    });
  }
  if (orphanCount > 0) {
    alerts.push({
      code: 'orphan_index',
      severity: 'low',
      message: `${orphanCount} orphan index entries`,
    });
  }
  if (watchExpired) {
    alerts.push({
      code: 'watch_expired',
      severity: 'high',
      message: 'Google Drive watch channel expired',
    });
  }
  if (drive.last_error || drive.lastError) {
    alerts.push({
      code: 'oauth_or_sync_failure',
      severity: 'high',
      message: String(drive.last_error ?? drive.lastError),
    });
  }
  return alerts;
}
