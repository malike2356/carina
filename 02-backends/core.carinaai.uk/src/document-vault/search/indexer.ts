/**
 * Sync content indexer for Document Vault (prompt 714).
 * Version-aware chunk table; strips prompt-injection control lines.
 */

import { sha256Hex } from '../model.js';
import { makeSourceId } from './citations.js';
import type { VaultSearchHost } from './host.js';
import { shouldIndexItem } from './policy.js';

export function chunkText(text: string, chunkWords = 200, overlap = 40): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(words.length, start + chunkWords);
    const chunk = words.slice(start, end).join(' ').trim();
    if (chunk) chunks.push(chunk);
    if (end >= words.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

export function extractIndexableText(
  data: Buffer,
  opts: { kind?: string; filename?: string } = {},
): string {
  const name = (opts.filename || '').toLowerCase();
  const kind = opts.kind || '';
  if (kind === 'html' || name.endsWith('.html') || name.endsWith('.htm')) {
    let text = data.toString('utf8');
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
    text = text.replace(/<[^>]+>/g, ' ');
    return text.split(/\s+/).filter(Boolean).join(' ');
  }
  try {
    return data.toString('utf8');
  } catch {
    const raw = data.toString('latin1');
    const literals = [...raw.matchAll(/\(([^()\\]{3,})\)/g)].map((m) => m[1]);
    return literals.length ? literals.join(' ') : '';
  }
}

function sanitizeIndexedText(text: string): string {
  const lines: string[] = [];
  for (const line of (text || '').split(/\r?\n/)) {
    const lower = line.trim().toLowerCase();
    if (lower.startsWith('ignore previous instructions') || lower.startsWith('system:')) {
      continue;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

export class VaultContentIndexer {
  constructor(private readonly host: VaultSearchHost) {}

  async indexItem(
    workspaceId: string,
    itemId: string,
  ): Promise<Record<string, unknown>> {
    const item = this.host.getItemOrNull(workspaceId, itemId, { includeTrashed: true });
    if (!item) return { ok: false, error_code: 'not_found' };

    if (!shouldIndexItem(this.host, workspaceId, item)) {
      this.deindexItem(workspaceId, itemId);
      this.host.upsertIndexEntry({
        workspaceId,
        itemId,
        revision: item.currentRevision,
        sourceId: makeSourceId(workspaceId, itemId, item.currentRevision),
        status: 'skipped',
        chunkCount: 0,
      });
      return { ok: true, status: 'skipped', item_id: itemId };
    }

    const revision = item.currentRevision;
    const sourceId = makeSourceId(workspaceId, itemId, revision);
    let text = '';
    let checksum: string | null = null;
    try {
      const data = await this.host.readContent(workspaceId, itemId);
      text = extractIndexableText(data, { kind: item.kind, filename: item.name });
      checksum = text ? sha256Hex(text) : null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.host.upsertIndexEntry({
        workspaceId,
        itemId,
        revision,
        sourceId,
        status: 'error',
        chunkCount: 0,
        error: message.slice(0, 500),
      });
      return { ok: false, error_code: 'extract_failed', error: message };
    }

    text = sanitizeIndexedText(text);
    const chunks = chunkText(text);
    this.host.replaceIndexChunks(workspaceId, itemId, revision, chunks);
    this.host.upsertIndexEntry({
      workspaceId,
      itemId,
      revision,
      sourceId,
      status: 'indexed',
      chunkCount: chunks.length,
      contentChecksum: checksum,
    });
    return {
      ok: true,
      status: 'indexed',
      item_id: itemId,
      revision,
      chunk_count: chunks.length,
      source_id: sourceId,
    };
  }

  deindexItem(workspaceId: string, itemId: string): Record<string, unknown> {
    const removed = this.host.deleteIndexForItem(workspaceId, itemId);
    return { ok: true, removed, item_id: itemId };
  }
}
