/** Repair helpers for orphan index entries and reindex (prompt 714). */

import { VaultContentIndexer } from '../search/indexer.js';
import type { VaultSearchHost } from '../search/host.js';
import { drainJobs } from './jobs.js';

export function repairOrphanIndexEntries(
  host: VaultSearchHost,
  workspaceId: string,
  opts: { dryRun?: boolean } = {},
): Record<string, unknown> {
  const dryRun = opts.dryRun !== false;
  const orphans = host.scanOrphanIndexEntries(workspaceId);
  const removed: string[] = [];
  if (!dryRun) {
    for (const row of orphans) {
      const itemId = String(row.item_id || '');
      if (itemId) {
        host.deleteIndexForItem(workspaceId, itemId);
        removed.push(itemId);
      }
    }
  }
  return {
    ok: true,
    dry_run: dryRun,
    orphan_count: orphans.length,
    removed,
    sample: orphans.slice(0, 20),
  };
}

export async function reindexItem(
  host: VaultSearchHost,
  workspaceId: string,
  itemId: string,
  opts: { drain?: boolean } = {},
): Promise<Record<string, unknown>> {
  const item = host.getItemOrNull(workspaceId, itemId, { includeTrashed: false });
  if (!item) return { ok: false, error_code: 'not_found' };
  const rev = item.currentRevision;
  const job = host.enqueueJobIdempotent({
    workspaceId,
    kind: 'index_item',
    itemId,
    idempotencyKey: `reindex:${itemId}:r${rev}:${Date.now()}`,
    payload: { item_id: itemId, revision: rev, force: true },
  });
  const drained = opts.drain === false
    ? []
    : await drainJobs(host, workspaceId, { limit: 5 });
  const result = await new VaultContentIndexer(host).indexItem(workspaceId, itemId);
  return { ok: true, job, result, drained };
}
