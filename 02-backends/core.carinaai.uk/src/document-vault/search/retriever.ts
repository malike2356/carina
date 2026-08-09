/** Content retrieval with policy, trash, grants, and revision citations. */

import { citationAsDict, makeSourceId, type VaultCitation } from './citations.js';
import type { VaultSearchHost } from './host.js';
import { shouldIndexItem } from './policy.js';
import { requireGrant } from '../security/grants.js';

export function contentSearch(
  host: VaultSearchHost,
  workspaceId: string,
  query: string,
  opts: { limit?: number; grants?: string[] | null } = {},
): { ok: true; query: string; hits: Record<string, unknown>[]; count: number } {
  requireGrant(opts.grants, 'vault.search');
  const q = String(query || '').trim();
  if (!q) return { ok: true, query: q, hits: [], count: 0 };

  const limit = Math.max(1, Math.min(opts.limit ?? 20, 100));
  const rows = host.searchIndexChunks(workspaceId, q, Math.min(limit * 5, 500));
  const hits: Record<string, unknown>[] = [];

  for (const row of rows) {
    const itemId = String(row.item_id || '');
    const item = host.getItemOrNull(workspaceId, itemId, { includeTrashed: false });
    if (!item) continue;
    if (!shouldIndexItem(host, workspaceId, item)) continue;
    const currentRev = item.currentRevision;
    const chunkRev = Number(row.revision || 0);
    if (chunkRev !== currentRev) continue;

    const citation: VaultCitation = {
      itemId: item.id,
      revision: currentRev,
      name: item.name,
      snippet: String(row.text || '').slice(0, 280),
      score: Number(row.score || 1),
      sourceId: makeSourceId(workspaceId, item.id, currentRev),
      workspaceId,
    };
    hits.push(citationAsDict(citation));
    if (hits.length >= limit) break;
  }

  return { ok: true, query: q, hits, count: hits.length };
}
