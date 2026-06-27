# RAG-UPLOAD-002: Core Backend - RAG Upload API

**Repo:** `core.carinaai.uk`
**Depends on:** RAG-UPLOAD-001 (spec), existing `src/memory/store.ts`, `src/memory/embeddings.ts`, `src/skills/ingestion.ts`
**Packages already installed:** `pdf-parse`, `mammoth` (both confirmed in package.json)

---

## Context

The RAG system is fully built and working. `rag_chunks` in PostgreSQL with pgvector, `insertRagChunk()`, `isSourceIngested()`, `searchRag()`, and `embed()` all exist. The only gap is an HTTP API that accepts file/text/URL input and runs the ingest pipeline without the CLI.

The ingestion logic already lives in `src/skills/ingestion.ts`. The `chunkMarkdown()` function is not exported. It needs to be extracted into a shared utility and a plain-text chunker needs to be added alongside it.

The new routes sit under the existing `carina-ops-routes.ts` pattern using `requireOpsAuth`, so `app.carinaai.uk` can call them via the ops-token + `x-core-org-id` header pattern that is already established.

---

## Step 1: Extract shared chunking utility

**New file:** `src/memory/chunk-text.ts`

Extract `chunkMarkdown()` from `src/skills/ingestion.ts` (do not remove it there, just re-export from the shared location). Add a plain-text fallback chunker for non-markdown content. Export both.

```typescript
export const CHARS_PER_CHUNK = 2000;

export function chunkMarkdown(content: string): string[] {
  // exact copy of the existing function from ingestion.ts
}

export function chunkPlainText(content: string): string[] {
  // split on double newlines (paragraphs), accumulate into CHARS_PER_CHUNK buckets
  // same accumulation logic as chunkMarkdown's fallback path
}

export function chunkAuto(content: string, mimeHint?: string): string[] {
  // if mimeHint includes 'markdown' or content has markdown headings: chunkMarkdown
  // otherwise: chunkPlainText
}
```

Update `src/skills/ingestion.ts` to import `chunkMarkdown` from `../memory/chunk-text.js` instead of defining it locally.

---

## Step 2: Database migration

**New file:** `src/infrastructure/migrations/013-rag-workspace.sql`

```sql
ALTER TABLE rag_chunks
  ADD COLUMN IF NOT EXISTS workspace_id uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS rag_chunks_workspace_idx ON rag_chunks(workspace_id);
CREATE INDEX IF NOT EXISTS rag_chunks_source_idx ON rag_chunks(source);
```

Register it in `src/infrastructure/migrations/index.ts` (or wherever migrations are applied) in order after `012`.

---

## Step 3: Extend store.ts

Add these four functions to `src/memory/store.ts`:

```typescript
export interface RagSource {
  source: string;
  pack: string;
  ingestedAt: string;
  chunkCount: number;
}

export async function listRagSources(
  workspaceId: string | null,
  pack: string | null,
  limit: number,
  offset: number,
): Promise<{ sources: RagSource[]; total: number }> {
  // SELECT DISTINCT source, pack, MIN(created_at) AS ingested_at, COUNT(*) AS chunk_count
  // FROM rag_chunks
  // WHERE ($1::uuid IS NULL OR workspace_id = $1)
  //   AND ($2::text IS NULL OR pack = $2)
  // GROUP BY source, pack
  // ORDER BY MIN(created_at) DESC
  // LIMIT $3 OFFSET $4
  // Run a separate COUNT(*) query for total (count of distinct source+pack groups)
}

export async function deleteRagSource(
  source: string,
  workspaceId: string | null,
): Promise<number> {
  // DELETE FROM rag_chunks WHERE source = $1 AND (workspace_id = $2 OR $2 IS NULL)
  // Return rowCount
}

export async function insertRagChunkWithWorkspace(
  source: string,
  pack: string,
  content: string,
  embedding: number[],
  workspaceId: string | null,
  metadata: Record<string, unknown>,
): Promise<void> {
  // INSERT INTO rag_chunks (source, pack, content, embedding, workspace_id, metadata)
  // VALUES ($1, $2, $3, $4, $5, $6)
  // Use pgvector.toSql(embedding) same as existing insertRagChunk
}

export async function getRagStatus(): Promise<{ totalChunks: number }> {
  const r = await pool.query('SELECT COUNT(*)::int AS total FROM rag_chunks');
  return { totalChunks: (r.rows[0] as { total: number }).total };
}
```

---

## Step 4: Content extractors

**New file:** `src/memory/rag-extractors.ts`

Four extractors, each returns `string` (plain text content):

```typescript
export async function extractFromBuffer(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(buffer);
    return result.text;
  }
  if (ext === '.docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  // .md, .txt, or unknown: UTF-8 text
  return buffer.toString('utf-8');
}

export async function extractFromUrl(url: string): Promise<{ text: string; title: string }> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'CarinaBot/1.0' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    const html = await res.text();
    // strip HTML tags, collapse whitespace
    const text = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    // extract <title> tag value for the title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;
    return { text, title };
  }
  // PDF or other binary at URL
  const buffer = Buffer.from(await res.arrayBuffer());
  const filename = new URL(url).pathname.split('/').pop() ?? 'file';
  const text = await extractFromBuffer(buffer, filename);
  return { text, title: filename };
}
```

---

## Step 5: RAG upload route module

**New file:** `src/api/rag-upload-api.ts`

Auth: every route uses `requireOpsAuth` inline (same pattern as `carina-ops-routes.ts`).
WorkspaceId comes from `x-core-org-id` header (UUID validation, same as `resolveOrgIdFromHeader`).
Max file size: Express body-parser is already configured; for raw buffers use `express.raw()` on the upload route.

```typescript
import { Router, type Request, type Response } from 'express';
import { requireOpsAuth } from '../ops/ops-auth.js';
import { embed } from '../memory/embeddings.js';
import { isSourceIngested, searchRag, insertRagChunkWithWorkspace, listRagSources, deleteRagSource, getRagStatus } from '../memory/store.js';
import { chunkAuto } from '../memory/chunk-text.js';
import { extractFromBuffer, extractFromUrl } from '../memory/rag-extractors.js';
import { embeddingProviderStatus } from '../memory/embeddings.js';

export const ragUploadRouter = Router();

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_CHARS = 100_000;
const MAX_CHUNKS_PER_UPLOAD = 200;
const ALLOWED_EXTENSIONS = new Set(['.md', '.txt', '.pdf', '.docx']);

function resolveWorkspaceId(req: Request): string | null {
  const raw = req.headers['x-core-org-id'];
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return id;
}

async function ingestChunks(
  chunks: string[],
  source: string,
  pack: string,
  workspaceId: string | null,
  meta: Record<string, unknown>,
): Promise<number> {
  const limited = chunks.slice(0, MAX_CHUNKS_PER_UPLOAD);
  let inserted = 0;
  for (const chunk of limited) {
    if (!chunk.trim()) continue;
    const embedding = await embed(chunk);
    await insertRagChunkWithWorkspace(source, pack, chunk, embedding, workspaceId, meta);
    inserted++;
  }
  return inserted;
}
```

### Routes

**`POST /api/carina-ops/rag/upload/file`**
- `requireOpsAuth`
- Reads raw body as `Buffer` (use `express.raw({ type: '*/*', limit: '10mb' })` on this route)
- `filename` from `x-filename` header (required)
- `pack` from `x-pack` header (default `'custom'`)
- Validate extension is in `ALLOWED_EXTENSIONS`
- Call `extractFromBuffer(buffer, filename)` to get text
- `source = 'file:' + filename`
- If `isSourceIngested(source)`: return `{ chunksInserted: 0, source, alreadyIngested: true }`
- `chunkAuto(text)` then `ingestChunks(...)`
- Return `{ chunksInserted, source }`

**`POST /api/carina-ops/rag/upload/text`**
- `requireOpsAuth`
- JSON body: `{ text: string, title: string, pack?: string }`
- Validate `text` is non-empty string, max `MAX_TEXT_CHARS`
- Validate `title` is non-empty string, max 200 chars
- `source = 'paste:' + title.slice(0, 120)`
- If `isSourceIngested(source)`: return already-ingested response
- `chunkAuto(text)` then `ingestChunks(...)`
- Return `{ chunksInserted, source }`

**`POST /api/carina-ops/rag/upload/url`**
- `requireOpsAuth`
- JSON body: `{ url: string, pack?: string }`
- Validate `url` starts with `https://` (no `http://` for security)
- `source = 'url:' + url`
- If `isSourceIngested(source)`: return already-ingested response
- `const { text, title } = await extractFromUrl(url)`
- `chunkAuto(text)` then `ingestChunks(...)` with `metadata: { url, title, ... }`
- Return `{ chunksInserted, source, title }`

**`GET /api/carina-ops/rag/sources`**
- `requireOpsAuth`
- Query params: `workspaceId?`, `pack?`, `page=1`, `limit=20` (max 50)
- Call `listRagSources(workspaceId, pack, limit, offset)`
- Return `{ sources, total, page, limit }`

**`DELETE /api/carina-ops/rag/sources`**
- `requireOpsAuth`
- JSON body: `{ source: string, workspaceId?: string }`
- Validate `source` non-empty
- Call `deleteRagSource(source, workspaceId ?? null)`
- Return `{ deleted }`

**`GET /api/carina-ops/rag/search`**
- `requireOpsAuth`
- Query params: `q` (required), `limit=5` (max 10)
- Validate `q` non-empty
- Call `searchRag(q, limit)`
- Return `{ results: [{ id, source, pack, content }] }`

**`GET /api/carina-ops/rag/status`**
- `requireOpsAuth` (or unauthenticated for internal use - use ops auth to be consistent)
- Call `embeddingProviderStatus()` and `getRagStatus()`
- Return `{ embeddingProvider, dimensions, configured, totalChunks }`

---

## Step 6: Register routes in server.ts

In `src/server.ts`, import `ragUploadRouter` and add inside `mountServerRoutes`:

```typescript
import { ragUploadRouter } from './api/rag-upload-api.js';
// ...
app.use('/api/carina-ops/rag', ragUploadRouter);
```

Add it unconditionally (not gated behind `isAiWorkersEnabled()`) - RAG upload is an operator capability.

---

## Step 7: Wire the `express.raw()` middleware to the file upload route only

The file upload route needs to receive raw binary. In the route handler, apply middleware inline:

```typescript
ragUploadRouter.post(
  '/upload/file',
  express.raw({ type: '*/*', limit: '10mb' }),
  (req, res, next) => { requireOpsAuth(req, res, next); },
  async (req, res) => {
    // req.body is now a Buffer
  }
);
```

The text and URL routes use `express.json()` which is already mounted globally.

---

## Embedding guard

In all three upload routes, before calling `embed()`, check:

```typescript
const status = embeddingProviderStatus();
if (!status.active) {
  res.status(503).json({
    error: 'Embedding provider not configured. Set GOOGLE_API_KEY, VOYAGE_API_KEY, or OPENAI_API_KEY.',
  });
  return;
}
```

---

## Tests

**New file:** `src/memory/chunk-text.test.ts`

Test `chunkMarkdown`:
- Empty string returns `[]`
- Single section under 2000 chars returns one chunk
- Two heading sections exceeding 2000 chars returns two chunks
- Content with no headings falls back to paragraph splitting

Test `chunkPlainText`:
- Long paragraph splits into multiple chunks
- Short content returns one chunk

**New file:** `src/api/rag-upload-api.test.ts`

Mock `embed` (return `[0.1, 0.2, 0.3]`), `insertRagChunkWithWorkspace` (no-op), `isSourceIngested` (return false).

Test POST /upload/text:
- Valid body: returns 200 with `chunksInserted > 0`
- Missing title: returns 400
- Text exceeding MAX_TEXT_CHARS: returns 400
- `isSourceIngested` returns true: returns `alreadyIngested: true`
- No embedding provider: returns 503

Test POST /upload/url:
- `http://` URL: returns 400
- Valid `https://` URL with mocked `extractFromUrl`: returns 200

---

## TypeScript

`npx tsc --noEmit` must pass with zero new errors. No `any` except where the existing codebase already uses it in store.ts.
