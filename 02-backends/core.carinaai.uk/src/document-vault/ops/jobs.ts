/** Durable Document Vault job lifecycle (prompt 714). */

import { VaultError } from '../errors.js';
import { VaultContentIndexer } from '../search/indexer.js';
import type { VaultSearchHost } from '../search/host.js';

export function claimNextJob(
  host: VaultSearchHost,
  workspaceId: string,
  workerId = 'worker',
): Record<string, unknown> | null {
  return host.claimJob(workspaceId, workerId);
}

export function completeJob(
  host: VaultSearchHost,
  workspaceId: string,
  jobId: string,
  result: Record<string, unknown> = {},
): Record<string, unknown> | null {
  return host.completeJob(workspaceId, jobId, result);
}

export function failJob(
  host: VaultSearchHost,
  workspaceId: string,
  jobId: string,
  reason: string,
): Record<string, unknown> | null {
  return host.failJob(workspaceId, jobId, reason);
}

export function retryJob(
  host: VaultSearchHost,
  workspaceId: string,
  jobId: string,
): Record<string, unknown> {
  const row = host.retryJob(workspaceId, jobId);
  if (!row) throw new VaultError('job not found or not retryable', 'not_found');
  return row;
}

export async function processJob(
  host: VaultSearchHost,
  job: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const indexer = new VaultContentIndexer(host);
  const kind = String(job.kind || '');
  const workspaceId = String(job.workspace_id || '');
  const payload = (job.payload as Record<string, unknown> | undefined)
    ?? (typeof job.payload_json === 'string'
      ? (JSON.parse(String(job.payload_json)) as Record<string, unknown>)
      : {});
  const itemId = String(job.item_id || payload.item_id || '');
  if (kind === 'index_item') return indexer.indexItem(workspaceId, itemId);
  if (kind === 'deindex_item') return indexer.deindexItem(workspaceId, itemId);
  if (kind.startsWith('import_') || kind.startsWith('channel:')) {
    return { ok: true, status: 'noop', kind };
  }
  return { ok: true, status: 'ignored', kind };
}

export async function drainJobs(
  host: VaultSearchHost,
  workspaceId: string,
  opts: { limit?: number; workerId?: string } = {},
): Promise<Array<Record<string, unknown>>> {
  const limit = Math.max(1, opts.limit ?? 20);
  const workerId = opts.workerId ?? 'local-drain';
  const results: Array<Record<string, unknown>> = [];
  for (let i = 0; i < limit; i += 1) {
    const job = claimNextJob(host, workspaceId, workerId);
    if (!job) break;
    const jobId = String(job.id);
    try {
      const result = await processJob(host, job);
      completeJob(host, workspaceId, jobId, result);
      results.push({ job_id: jobId, ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failJob(host, workspaceId, jobId, message.slice(0, 500));
      results.push({ job_id: jobId, ok: false, error: message });
    }
  }
  return results;
}
