import fs from 'node:fs/promises';
import path from 'node:path';
import { githubBridgeIndexPath, resolveGithubBridgeScope, type GithubBridgeScope } from './config.js';
import type { GithubBridgeSearchHit } from './types.js';

export interface IndexedChunk {
  path: string;
  content: string;
  tokens: string[];
  product?: string;
  agent?: string;
  updatedAt: string;
}

interface IndexFile {
  version: number;
  updatedAt: string;
  chunks: IndexedChunk[];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

export async function loadIndex(scope?: GithubBridgeScope): Promise<IndexFile> {
  const resolved = resolveGithubBridgeScope(scope);
  try {
    const raw = JSON.parse(await fs.readFile(githubBridgeIndexPath(resolved.scopeKey), 'utf8')) as IndexFile;
    return { version: raw.version ?? 1, updatedAt: raw.updatedAt ?? '', chunks: raw.chunks ?? [] };
  } catch {
    return { version: 1, updatedAt: '', chunks: [] };
  }
}

export async function saveIndex(chunks: IndexedChunk[], scope?: GithubBridgeScope): Promise<IndexFile> {
  const resolved = resolveGithubBridgeScope(scope);
  const file: IndexFile = {
    version: 1,
    updatedAt: new Date().toISOString(),
    chunks,
  };
  const indexPath = githubBridgeIndexPath(resolved.scopeKey);
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, JSON.stringify(file), { mode: 0o600 });
  return file;
}

export function buildChunk(opts: {
  path: string;
  content: string;
  product?: string;
  agent?: string;
}): IndexedChunk {
  const clipped = opts.content.slice(0, 12_000);
  return {
    path: opts.path,
    content: clipped,
    tokens: tokenize(`${opts.path}\n${clipped}`),
    product: opts.product,
    agent: opts.agent,
    updatedAt: new Date().toISOString(),
  };
}

export function searchIndex(
  index: IndexFile,
  query: string,
  limit = 8,
  filters?: { product?: string; agent?: string; pathPrefix?: string },
): GithubBridgeSearchHit[] {
  const qTokens = tokenize(query);
  if (!qTokens.length) return [];

  const scored = index.chunks
    .filter((chunk) => {
      if (filters?.product && chunk.product && chunk.product !== filters.product) return false;
      if (filters?.agent && chunk.agent && chunk.agent !== filters.agent) return false;
      if (filters?.pathPrefix && !chunk.path.startsWith(filters.pathPrefix.replace(/^\.\//, ''))) return false;
      return true;
    })
    .map((chunk) => {
      let score = 0;
      for (const token of qTokens) {
        if (chunk.path.toLowerCase().includes(token)) score += 3;
        if (chunk.tokens.includes(token)) score += 1;
      }
      const snippetStart = Math.max(0, chunk.content.toLowerCase().indexOf(qTokens[0] ?? '') - 40);
      const snippet = chunk.content.slice(snippetStart, snippetStart + 220).replace(/\s+/g, ' ').trim();
      return {
        path: chunk.path,
        score,
        snippet: snippet || chunk.content.slice(0, 220),
        product: chunk.product,
        agent: chunk.agent,
      } satisfies GithubBridgeSearchHit;
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, Math.max(1, Math.min(limit, 50)));
}

/** Best-effort replace of github-agent-sync rows in rag_chunks when DB is available. */
export async function upsertRagChunks(chunks: IndexedChunk[], scope?: GithubBridgeScope): Promise<number> {
  try {
    const { deleteRagSource, insertRagChunk } = await import('../../memory/store.js');
    const resolved = resolveGithubBridgeScope(scope);
    const source = `github-agent-sync:${resolved.scopeKey}`;
    let embedFn: ((text: string) => Promise<number[]>) | null = null;
    try {
      const emb = await import('../../memory/embeddings.js');
      embedFn = (text: string) => emb.embed(text);
    } catch {
      embedFn = null;
    }
    await deleteRagSource(source, null);
    let count = 0;
    for (const chunk of chunks.slice(0, 120)) {
      const embedding = embedFn ? await embedFn(chunk.content.slice(0, 4000)).catch(() => []) : [];
      await insertRagChunk(source, 'agent-sync', chunk.content, embedding, {
        path: chunk.path,
        product: chunk.product,
        agent: chunk.agent,
        scopeKind: resolved.scopeKind,
        scopeId: resolved.scopeId,
        updatedAt: chunk.updatedAt,
      });
      count += 1;
    }
    return count;
  } catch {
    return 0;
  }
}
