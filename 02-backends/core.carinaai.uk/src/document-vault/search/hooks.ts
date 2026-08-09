/** Lifecycle hooks that enqueue index/deindex jobs (prompt 714). */

import type { VaultItem } from '../model.js';
import type { VaultSearchHost } from './host.js';
import { shouldIndexItem } from './policy.js';

export function onItemWritten(
  host: VaultSearchHost,
  workspaceId: string,
  item: VaultItem | null,
): { id: string; idempotent?: boolean } | null {
  if (!item) return null;
  const rev = item.currentRevision;
  if (shouldIndexItem(host, workspaceId, item)) {
    return host.enqueueJobIdempotent({
      workspaceId,
      kind: 'index_item',
      itemId: item.id,
      idempotencyKey: `index:${item.id}:r${rev}`,
      payload: { item_id: item.id, revision: rev },
    });
  }
  return host.enqueueJobIdempotent({
    workspaceId,
    kind: 'deindex_item',
    itemId: item.id,
    idempotencyKey: `deindex:${item.id}:write`,
    payload: { item_id: item.id, reason: 'policy_skip' },
  });
}

export function onItemTrashedOrDeleted(
  host: VaultSearchHost,
  workspaceId: string,
  itemId: string,
  reason: string,
): { id: string; idempotent?: boolean } {
  return host.enqueueJobIdempotent({
    workspaceId,
    kind: 'deindex_item',
    itemId,
    idempotencyKey: `deindex:${itemId}:${reason}`,
    payload: { item_id: itemId, reason },
  });
}

export function onItemRestored(
  host: VaultSearchHost,
  workspaceId: string,
  item: VaultItem | null,
): { id: string; idempotent?: boolean } | null {
  return onItemWritten(host, workspaceId, item);
}
