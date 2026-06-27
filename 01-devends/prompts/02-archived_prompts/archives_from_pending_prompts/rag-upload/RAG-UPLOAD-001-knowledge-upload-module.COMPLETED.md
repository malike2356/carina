# RAG-UPLOAD-001: Knowledge Upload Module

**Repos:** `core.carinaai.uk`, `app.carinaai.uk`
**Phase:** Knowledge Growth
**Depends on:** RAG system (built: `src/memory/store.ts`, `src/memory/embeddings.ts`, `src/skills/ingestion.ts`)
**Goal:** Let operators and workspace owners upload files, paste text, or provide URLs to grow Carina's RAG knowledge base through a UI, without touching the CLI.

---

## Context

The RAG system is fully built. `rag_chunks` table exists with pgvector. `insertRagChunk()` and `searchRag()` are working. The CLI command `carina ingest --pack <name>` walks markdown files and ingests them.

What is missing: a UI and API surface that lets non-technical operators upload knowledge without the CLI. This prompt builds that surface end to end.

---

## What to Build

### Part 1: Core Backend API (`core.carinaai.uk`)

**New file:** `src/api/rag-upload-api.ts`

Register it in `src/server.ts` under `requireHostedSession` middleware (workspace-scoped, auth required).

#### Endpoints

**`POST /api/rag/upload`**

Accepts multipart/form-data. Fields:
- `file` (optional): binary file upload. Accepted types: `.md`, `.txt`, `.pdf`, `.docx`
- `text` (optional): raw text paste (JSON body: `{ text: string, title: string }`)
- `url` (optional): URL to fetch and ingest (JSON body: `{ url: string }`)
- `pack` (optional): which pack to tag chunks under. Defaults to `'custom'`
- `workspaceId` (required): scopes the chunks to a workspace

Exactly one of `file`, `text`, or `url` must be present. Return 400 if none or more than one.

Processing steps (same for all three input types):
1. Extract raw text content (see parsers below)
2. Chunk text using `chunkMarkdown()` logic from `src/skills/ingestion.ts` (2,000 chars at heading boundaries, falling back to character count chunking for non-markdown)
3. For each chunk: call `embed(content)` from `src/memory/embeddings.ts`
4. Call `insertRagChunk(source, pack, content, embedding, metadata)` where:
   - `source`: file name, or URL, or `'paste:<title>'`
   - `pack`: the `pack` field from the request, defaulting to `'custom'`
   - `metadata`: `{ workspaceId, title, uploadedAt: Date.toISOString(), type: 'file'|'text'|'url' }`
5. Return `{ chunksInserted: number, source: string }`

**Parsers:**
- `.md` / `.txt`: UTF-8 string directly
- `.pdf`: use `pdf-parse` (already in project as the `pdf` tool uses it) to extract text
- `.docx`: use `mammoth` package to extract plain text from Word documents (install if not present)
- URL: `fetch(url)`, extract text content. For HTML pages, strip tags using a simple regex or the `node-html-markdown` package. For direct document URLs (.pdf etc), download and parse as above.

Do not ingest the same source twice. Before inserting, call `isSourceIngested(source)`. If already ingested, return `{ chunksInserted: 0, source, alreadyIngested: true }` with status 200. To force re-ingestion, the caller must first delete the existing chunks (see delete endpoint).

**`GET /api/rag/sources?workspaceId=&pack=&page=&limit=`**

Returns a paginated list of distinct sources that have been ingested for this workspace.

```sql
SELECT DISTINCT source, pack,
       MIN(created_at) AS ingested_at,
       COUNT(*) AS chunk_count
FROM rag_chunks
WHERE (metadata->>'workspaceId' = $workspaceId OR workspaceId IS NULL)
  AND ($pack::text IS NULL OR pack = $pack)
GROUP BY source, pack
ORDER BY MIN(created_at) DESC
LIMIT $limit OFFSET $offset
```

Response: `{ sources: [{ source, pack, ingestedAt, chunkCount }], total, page, limit }`

**`DELETE /api/rag/sources`**

Body: `{ source: string, workspaceId: string }`

Deletes all `rag_chunks` rows matching `source` and `workspaceId` in metadata.

```sql
DELETE FROM rag_chunks
WHERE source = $1
  AND metadata->>'workspaceId' = $2
```

Returns: `{ deleted: number }`

**`GET /api/rag/search?q=&workspaceId=&limit=`**

Preview endpoint. Run `searchRag(q, limit)` and return the matching chunks. Used by the UI to let operators verify that a just-ingested document is retrievable.

Response: `{ results: [{ id, source, pack, content }] }`

**`GET /api/rag/status`**

Returns the current RAG status: embedding provider, dimensions, total chunk count.

```typescript
const embed = embeddingProviderStatus();
const countResult = await pool.query('SELECT COUNT(*) FROM rag_chunks');
return {
  embeddingProvider: embed.active,
  dimensions: embed.dimensions,
  configured: embed.configured,
  totalChunks: parseInt(countResult.rows[0].count, 10),
};
```

#### Schema Changes

Add a `workspace_id` column to `rag_chunks` so workspace-scoped queries do not require JSONB metadata extraction:

```sql
-- Migration: src/infrastructure/migrations/XXX-rag-workspace.sql
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS rag_chunks_workspace_id_idx ON rag_chunks(workspace_id);
```

Update `insertRagChunk` signature to accept optional `workspaceId: string | null`. Existing rows keep `workspace_id = NULL` (treated as global/operator knowledge).

#### File Size Limits

- Max file size: 10 MB per upload
- Max text paste: 100,000 characters
- Max chunks per upload: 200 (to prevent runaway ingestion)

Enforce in the route handler before processing. Return 413 if exceeded.

---

### Part 2: app.carinaai.uk UI

**New page:** `src/app/(workspace)/knowledge/page.tsx` (server component for initial data)

**New client components:**
- `src/components/knowledge/KnowledgeUploadPanel.tsx`
- `src/components/knowledge/KnowledgeSourceList.tsx`
- `src/components/knowledge/RagSearchPreview.tsx`

#### Layout

Three panels stacked vertically or in a 2-column grid on wider screens:

**Panel 1: Upload (`KnowledgeUploadPanel.tsx`)**

Three tabs: File Upload | Paste Text | URL

- File Upload tab: drag-and-drop zone plus file picker. Shows accepted types (.md, .txt, .pdf, .docx). Shows file name and size after selection. Pack selector dropdown (defaults to 'custom', lists available packs from `GET /api/rag/status`). Upload button. Progress state (uploading... / done / error).
- Paste Text tab: `<textarea>` for content, `<input>` for title. Character counter showing X/100,000. Pack selector. Upload button.
- URL tab: `<input type="url">` for the URL. Pack selector. Fetch & Ingest button. Shows fetched URL title if extractable.

On success, show: "Ingested. X chunks added." with a green banner. On `alreadyIngested: true`, show: "Already ingested. Delete the existing source first to re-ingest."

**Panel 2: Ingested Sources (`KnowledgeSourceList.tsx`)**

Table with columns: Source, Pack, Chunks, Ingested At, Actions.

Actions column: "Delete" button with confirmation (shows `count` chunks will be deleted). On delete success, refresh the list.

Pagination: Prev / Next. 20 sources per page.

**Panel 3: Search Preview (`RagSearchPreview.tsx`)**

An `<input>` field with a search button. Calls `GET /api/rag/search?q=...`. Renders up to 5 result cards, each showing: source, pack label, and content snippet (first 200 chars). This lets the operator verify that a just-uploaded document is correctly retrievable before using the agent.

#### Navigation

Add "Knowledge" as a nav item in the workspace sidebar, after Settings. Icon: `BookOpen` from `lucide-react`. Link: `/knowledge`.

#### API Routes (Next.js)

All proxy to core using the ops-token + `x-core-org-id` pattern established in `src/lib/core-api-proxy.ts`:

- `src/app/api/knowledge/upload/route.ts` - POST (multipart, proxy to core)
- `src/app/api/knowledge/sources/route.ts` - GET, DELETE
- `src/app/api/knowledge/search/route.ts` - GET
- `src/app/api/knowledge/status/route.ts` - GET

For the file upload proxy: stream the multipart body directly to core. Do not buffer the file in the Next.js API route. Use `request.body` as the body for the fetch to core, and forward the `content-type` header (which includes the multipart boundary).

---

### Part 3: Operator CLI Enhancements (`core.carinaai.uk`)

Extend `src/cli/commands/rag-cli.ts` with new sub-commands:

**`carina rag upload <filepath>`**

```
Reads the file at <filepath>, chunks it, embeds it, and inserts into rag_chunks.
Pack defaults to 'custom'. Override with --pack <name>.
Prints: "Ingested <n> chunks from <filepath>"
```

**`carina rag list [--pack <name>]`**

```
Lists all distinct sources in rag_chunks.
Columns: source, pack, chunks, ingested_at
```

**`carina rag delete <source>`**

```
Deletes all rag_chunks rows where source = <source>.
Prints: "Deleted <n> chunks for source: <source>"
```

**`carina rag re-ingest <source>`**

```
Delete existing chunks for <source>, then re-ingest from the file at that path.
Useful after editing a knowledge document.
```

---

### Part 4: RAG Ingest for the RAG Directory

Once the API is built, wire up automatic ingestion of the `01-devends/RAG/` directory:

**New script:** `scripts/ingest-rag-docs.sh`

```bash
#!/bin/bash
# Ingest all RAG knowledge documents into the rag_chunks table
# Run after adding or updating any RAG-XXX document
cd /opt/lampp/htdocs/verlox/carina/02-backends/core.carinaai.uk
for file in ../../01-devends/RAG/RAG-*.md; do
  pnpm exec carina rag upload "$file" --pack rag-training
done
echo "RAG documents ingested."
```

Also update the existing ingestion pipeline to look for `.md` files in `01-devends/RAG/` when
the pack is `rag-training`, so `carina ingest --pack rag-training` works as an alternative.

---

## TypeScript Requirements

- No `any` types. Use proper interfaces for all request/response shapes.
- The file upload handler must validate MIME type against accepted types before processing.
- All database queries use parameterized queries (no string concatenation).
- Chunk insertion is done in a database transaction so partial failures do not leave orphan chunks.
- The `embed()` call can fail if no embedding provider is configured. Return a clear 503 error
  with message "Embedding provider not configured. Set GOOGLE_API_KEY, VOYAGE_API_KEY, or OPENAI_API_KEY."

## Tests

Write vitest unit tests for:
- `chunkText(content: string): string[]` utility (test heading boundary splitting and character fallback)
- The `isSourceIngested` guard (test with a mock pool)
- The upload API route handler (mock `embed` and `insertRagChunk`, test all three input types and the already-ingested path)

---

## Acceptance Criteria

1. Operator can upload a `.pdf` file from the UI and see it appear in the source list
2. Operator can paste raw text and give it a title; it appears as a source
3. Operator can ingest a URL; the text content is chunked and stored
4. The search preview returns relevant chunks from the just-ingested content
5. Operator can delete a source and its chunks are removed from `rag_chunks`
6. `carina rag upload <file>` works from the CLI
7. `carina rag list` shows all sources with chunk counts
8. `scripts/ingest-rag-docs.sh` successfully ingests all `01-devends/RAG/RAG-*.md` files
9. TypeScript: `npx tsc --noEmit` passes in both repos
10. Tests: all vitest unit tests pass
