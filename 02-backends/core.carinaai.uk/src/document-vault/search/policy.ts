/**
 * Index policy resolution for Document Vault (prompt 714).
 * Root inherit defaults to no_index (opt-in; never auto-index every private file).
 * Carina `no_index` matches Keprix `skip`.
 */

import type { IndexPolicy } from '../kinds.js';
import type { VaultItem } from '../model.js';
import type { VaultSearchHost } from './host.js';

export const ROOT_INHERIT_DEFAULT: 'no_index' = 'no_index';

export type EffectiveIndexPolicy = 'index' | 'no_index';

export function resolveEffectiveIndexPolicy(
  host: VaultSearchHost,
  workspaceId: string,
  item: VaultItem | null,
): EffectiveIndexPolicy {
  let current: VaultItem | null = item;
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    const policy = String(current.indexPolicy || 'inherit').trim().toLowerCase() as IndexPolicy | 'skip';
    if (policy === 'index') return 'index';
    if (policy === 'no_index' || policy === 'skip') return 'no_index';
    if (!current.parentId) break;
    current = host.getItemOrNull(workspaceId, current.parentId, { includeTrashed: true });
  }
  return ROOT_INHERIT_DEFAULT;
}

export function shouldIndexItem(
  host: VaultSearchHost,
  workspaceId: string,
  item: VaultItem | null,
): boolean {
  if (!item) return false;
  if (item.trashedAt) return false;
  if (item.kind === 'folder') return false;
  return resolveEffectiveIndexPolicy(host, workspaceId, item) === 'index';
}
