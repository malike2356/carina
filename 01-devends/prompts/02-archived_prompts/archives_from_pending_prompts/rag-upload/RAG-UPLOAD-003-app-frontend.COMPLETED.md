# RAG-UPLOAD-003: App Frontend - Knowledge Management UI

**Repo:** `app.carinaai.uk`
**Depends on:** RAG-UPLOAD-002 (core backend must be deployed first)
**Auth pattern:** ops-token + `x-core-org-id` header via `proxyToCoreApi()` (same as `/api/developer/keys`)

---

## Context

The core backend exposes 7 new routes under `/api/carina-ops/rag/`. The app needs:
- Next.js API proxy routes that forward to core with the workspace's `coreOrgId`
- A "Knowledge" page with three UI panels (upload, source list, search preview)
- A nav entry in the workspace sidebar

The existing proxy pattern is in `src/lib/core-api-proxy.ts`. The nav structure is defined in
`src/lib/workspace-nav.ts` as `NAV_ROUTES` with `NavRoute` objects. The workspace layout reads
`NAV_ROUTES` and renders the sidebar from it.

---

## Step 1: Next.js API proxy routes

All four route files live under `src/app/api/knowledge/`.

### `src/app/api/knowledge/upload/text/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { proxyToCoreApi } from '@/lib/core-api-proxy';
import { getWorkspaceCoreOrgId } from '@/lib/workspace-session';

export async function POST(request: NextRequest) {
  const extra = await getWorkspaceCoreOrgId(request);
  return proxyToCoreApi(request, '/api/carina-ops/rag/upload/text', extra);
}
```

`getWorkspaceCoreOrgId` is a helper (write it if it does not exist) that:
1. Reads the session from the `auth` helper (better-auth session)
2. Looks up the workspace `coreOrgId` from SQLite `workspaces` table
3. Returns `{ 'x-core-org-id': coreOrgId }` or `null`

If the workspace has no `coreOrgId`, return `{ error: 'Workspace not linked to a core org' }` with 400.

### `src/app/api/knowledge/upload/url/route.ts`

Same shape as text, proxies POST to `/api/carina-ops/rag/upload/url`.

### `src/app/api/knowledge/upload/file/route.ts`

File uploads need special handling because Next.js buffers multipart by default. Instead, stream
the raw request body directly to core:

```typescript
export async function POST(request: NextRequest) {
  const extra = await getWorkspaceCoreOrgId(request);
  // Forward the raw body and content-type to core; core uses express.raw()
  // Pass filename via x-filename header (read from request headers)
  const filename = request.headers.get('x-filename') ?? 'upload';
  const pack = request.headers.get('x-pack') ?? 'custom';
  const extraHeaders: Record<string, string> = {
    ...(extra ?? {}),
    'x-filename': filename,
    'x-pack': pack,
  };
  return proxyToCoreApi(request, '/api/carina-ops/rag/upload/file', extraHeaders);
}
```

The `proxyToCoreApi` function already forwards the request body and content-type header.

### `src/app/api/knowledge/sources/route.ts`

GET and DELETE:

```typescript
export async function GET(request: NextRequest) {
  const extra = await getWorkspaceCoreOrgId(request);
  return proxyToCoreApi(request, '/api/carina-ops/rag/sources', extra);
}

export async function DELETE(request: NextRequest) {
  const extra = await getWorkspaceCoreOrgId(request);
  return proxyToCoreApi(request, '/api/carina-ops/rag/sources', extra);
}
```

### `src/app/api/knowledge/search/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const extra = await getWorkspaceCoreOrgId(request);
  return proxyToCoreApi(request, '/api/carina-ops/rag/search', extra);
}
```

### `src/app/api/knowledge/status/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const extra = await getWorkspaceCoreOrgId(request);
  return proxyToCoreApi(request, '/api/carina-ops/rag/status', extra);
}
```

---

## Step 2: Navigation entry

In `src/lib/workspace-nav.ts`, add to `NAV_ROUTES` after the packs entry:

```typescript
{
  href: '/knowledge',
  label: 'Knowledge',
  description: 'Upload documents, paste text, or ingest URLs to grow the RAG knowledge base.',
  group: 'intelligence',
  iconName: 'BookOpen',
},
```

The `group: 'intelligence'` places it alongside Packs and Memory in the Intelligence section.

---

## Step 3: Page and components

### `src/app/(workspace)/knowledge/page.tsx`

Server component. Fetches initial RAG status for the header stats.

```typescript
import { KnowledgeUploadPanel } from '@/components/knowledge/KnowledgeUploadPanel';
import { KnowledgeSourceList } from '@/components/knowledge/KnowledgeSourceList';
import { RagSearchPreview } from '@/components/knowledge/RagSearchPreview';

export default function KnowledgePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">Knowledge Base</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Upload documents to grow Carina's RAG knowledge base.
        </p>
      </div>
      <KnowledgeUploadPanel />
      <KnowledgeSourceList />
      <RagSearchPreview />
    </div>
  );
}
```

---

### `src/components/knowledge/KnowledgeUploadPanel.tsx`

Client component. Three tabs: File Upload | Paste Text | URL.

```typescript
'use client';

type Tab = 'file' | 'text' | 'url';
```

State:
- `tab: Tab` (default `'file'`)
- `pack: string` (default `'custom'`)
- `file: File | null`
- `textContent: string`, `textTitle: string`
- `url: string`
- `status: 'idle' | 'uploading' | 'done' | 'error'`
- `result: { chunksInserted: number; source: string; alreadyIngested?: boolean } | null`
- `error: string | null`

**File tab:**
- Drag-and-drop zone: `<div onDrop={...} onDragOver={...}>`. Label "Drop a file here, or click to browse". Accepted types shown as caption: ".md .txt .pdf .docx, max 10 MB". Hidden `<input type="file" accept=".md,.txt,.pdf,.docx">`.
- After file selected: show file name and size in KB/MB.
- Upload button (disabled when `file === null` or status is `'uploading'`).
- On submit: `POST /api/knowledge/upload/file` with `file` as raw body, `x-filename` and `x-pack` headers. Do NOT use FormData; read the file as ArrayBuffer and send as raw body.

```typescript
const buffer = await file.arrayBuffer();
const res = await fetch('/api/knowledge/upload/file', {
  method: 'POST',
  headers: {
    'x-filename': file.name,
    'x-pack': pack,
    'content-type': 'application/octet-stream',
  },
  body: buffer,
});
```

**Text tab:**
- `<textarea rows={8}` for `textContent`, character counter: `{textContent.length}/100,000`
- `<input>` for `textTitle`
- Pack selector (see below)
- Upload button (disabled when either field is empty)
- On submit: `POST /api/knowledge/upload/text` with `{ text, title, pack }` JSON body

**URL tab:**
- `<input type="url">` for `url`. Placeholder: `https://...`
- Pack selector
- "Fetch and Ingest" button (disabled when `url` is empty or does not start with `https://`)
- On submit: `POST /api/knowledge/upload/url` with `{ url, pack }` JSON body

**Pack selector** (shared across tabs):
Small `<select>` or simple input. Default `'custom'`. Label: "Pack". For now render as a plain `<input type="text" value={pack} onChange=...>` with placeholder `custom`. No need to fetch available packs dynamically.

**Status display:**
- Uploading: spinner + "Uploading..."
- Done and `chunksInserted > 0`: green success banner: `"Done. {chunksInserted} chunk{s} ingested from {source}."`
- Done and `alreadyIngested: true`: amber banner: `"Already ingested. Delete the existing source first if you want to re-ingest."`
- Error: red banner with error message

Use `useToast` for transient feedback (`const { push: toast } = useToast()`).

---

### `src/components/knowledge/KnowledgeSourceList.tsx`

Client component. Table of ingested sources.

State: `sources`, `total`, `page`, `loading`, `deletingSource: string | null`, `confirmDelete: string | null`

On mount and after any delete: fetch `GET /api/knowledge/sources?page={page}&limit=20`.

Table columns: Source, Pack, Chunks, Ingested At, Actions.

Actions column: "Delete" button. On click: set `confirmDelete = source`. Show inline confirm: `"Delete {n} chunks? This cannot be undone."` with Confirm and Cancel buttons.

On confirm: `DELETE /api/knowledge/sources` with body `{ source }`. On success: refetch the list. Show toast "Source deleted."

Pagination: `Previous` / `Next` buttons. Show `Page {page} of {totalPages}`.

Loading state: show a skeleton table with 3 placeholder rows (opacity-50 divs).

---

### `src/components/knowledge/RagSearchPreview.tsx`

Client component. Search box + result cards.

State: `query: string`, `results`, `loading`, `searched: boolean`

`<form onSubmit={handleSearch}>`:
- `<input type="search">` for query. Placeholder: "Search the knowledge base..."
- Submit button: "Search"

On submit: `GET /api/knowledge/search?q={encodeURIComponent(query)}&limit=5`

Results: show up to 5 cards. Each card:
```
[source label]  [pack badge]
content snippet (first 200 chars, trimmed to word boundary)...
```

If `searched && results.length === 0`: "No results found for this query."
If `!searched`: "Enter a query to preview what Carina will retrieve."

---

## Step 4: Check for `getWorkspaceCoreOrgId` helper

Check if this helper already exists (look in `src/lib/workspace-session.ts` or similar). If it does not exist, create it:

**`src/lib/workspace-session.ts`** (or add to existing session utilities):

```typescript
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

export async function getWorkspaceCoreOrgId(
  request: NextRequest,
): Promise<Record<string, string> | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return null;
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.userId, session.user.id),
    columns: { coreOrgId: true },
  });
  if (!workspace?.coreOrgId) return null;
  return { 'x-core-org-id': workspace.coreOrgId };
}
```

Check actual schema column names (may be `core_org_id` snake_case in DB, camelCase in Drizzle).

---

## TypeScript

`npx tsc --noEmit` in `app.carinaai.uk` must pass with zero new errors.
No `any` types. All fetch response types should be declared with interfaces.

---

## Acceptance

- File upload from browser reaches core, chunks are inserted, success banner shows chunk count.
- Source appears in the list immediately after upload (list auto-refreshes).
- Delete removes source from the list.
- Search returns results for a query that matches just-ingested content.
- Nav item "Knowledge" appears in the Intelligence group in the sidebar.
