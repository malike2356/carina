# Prompt 11 - Support Knowledge Auto-Sync Cron

**Status: SUPERSEDED 2026-06-23** (not implemented; use `14-full-implementation-v2.md` direct injection instead)

**Agent:** Claude Code
**Depends on:** Sprint-3 support-agent knowledge files (01-10) already written
**Builds in:** `backends/servers/core.carinaai.uk/`
**Done when:** A weekly cron job re-indexes all support knowledge files into the RAG store, replacing stale chunks. Running the sync twice produces the same result (idempotent).

---

## Context

The Carina core (`core.carinaai.uk`) has a RAG knowledge system backed by a `rag_chunks` table in Postgres. Brain packs live at `core.carinaai.uk/brain/{pack_name}/knowledge/*.md`. The ingestion module at `src/skills/ingestion.ts` walks those directories, chunks the markdown by heading, embeds each chunk, and inserts into `rag_chunks` with `(source, pack, content, embedding)`.

The current ingestion is append-only: `isSourceIngested(source)` skips files already present. There is no delete-then-reinsert path. The support knowledge needs one because the files change when features ship.

`store.ts` exports: `isSourceIngested`, `insertRagChunk`, `searchRag`. Needs two new exports added.

---

## Step 1 - Copy knowledge files into the brain pack (one-time)

Create the directory and copy the sprint-3 support knowledge files into it:

```
core.carinaai.uk/brain/carina_support_knowledge/knowledge/
  00-README.md
  01-product-overview.md
  02-getting-started.md
  03-chat-memory-skills.md
  04-workspace-tools.md
  05-automation.md
  06-advanced-features.md
  07-billing-and-plans.md
  08-labyrinth-scout.md
  09-troubleshooting.md
  10-response-templates.md
```

The source files are at:
`internal/prompts/pending_prompts/sprint-3/support-agent/01-*.md` through `10-*.md`.

Copy them (do not symlink - the brain directory must be self-contained for deploy). The `00-README.md` should be a short file explaining this pack:

```markdown
# Carina Support Knowledge Pack

This pack contains the user-facing knowledge base for the Carina AI and Labyrinth Scout support agent. It is indexed by the crina:support-kb-sync cron job every Sunday at 02:00 UTC.

To update the knowledge: edit the files in this directory and wait for the next Sunday sync, or trigger a manual sync via `POST /api/internal/support-kb/sync` from the ops console.

Pack name: carina_support_knowledge
```

---

## Step 2 - Add delete functions to `src/memory/store.ts`

Add these two exports immediately after the `insertRagChunk` function:

```typescript
export async function deleteRagChunksBySource(source: string): Promise<number> {
  const result = await pool.query(
    'DELETE FROM rag_chunks WHERE source = $1',
    [source],
  );
  return result.rowCount ?? 0;
}

export async function deleteRagChunksByPack(pack: string): Promise<number> {
  const result = await pool.query(
    'DELETE FROM rag_chunks WHERE pack = $1',
    [pack],
  );
  return result.rowCount ?? 0;
}
```

---

## Step 3 - Create `src/skills/support-kb-sync.ts`

This module re-indexes the `carina_support_knowledge` brain pack. It deletes existing chunks for each source file before re-inserting so updates take effect cleanly.

```typescript
// Re-indexes the carina_support_knowledge brain pack into rag_chunks.
// Safe to run repeatedly; deletes stale chunks before inserting.
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from '../memory/db.js';
import { embed } from '../memory/embeddings.js';
import {
  deleteRagChunksBySource,
  insertRagChunk,
} from '../memory/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORE_ROOT = path.resolve(__dirname, '../../..');
const PACK_NAME = 'carina_support_knowledge';
const KNOWLEDGE_DIR = path.join(CORE_ROOT, 'brain', PACK_NAME, 'knowledge');
const CHARS_PER_CHUNK = 2000;

function chunkMarkdown(content: string): string[] {
  const sections = content.split(/(?=^#{1,3} )/m).filter((s) => s.trim());
  const chunks: string[] = [];
  let buffer = '';

  for (const section of sections) {
    if ((buffer + section).length > CHARS_PER_CHUNK && buffer.trim()) {
      chunks.push(buffer.trim());
      buffer = section;
    } else {
      buffer += (buffer ? '\n\n' : '') + section;
    }
  }

  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks.length > 0 ? chunks : [content.trim()];
}

async function syncFile(filePath: string): Promise<number> {
  const source = path.relative(CORE_ROOT, filePath);
  const content = await fs.readFile(filePath, 'utf8');
  const chunks = chunkMarkdown(content);

  const deleted = await deleteRagChunksBySource(source);
  if (deleted > 0) {
    console.log(`[support-kb-sync] Cleared ${deleted} stale chunks for ${source}`);
  }

  let inserted = 0;
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    const embedding = await embed(chunk);
    await insertRagChunk(source, PACK_NAME, chunk, embedding, { file: source });
    inserted++;
  }

  return inserted;
}

export async function syncSupportKnowledge(): Promise<{ files: number; chunks: number }> {
  await initDb();

  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(KNOWLEDGE_DIR, { withFileTypes: true });
  } catch {
    console.warn(`[support-kb-sync] Knowledge directory not found: ${KNOWLEDGE_DIR}`);
    return { files: 0, chunks: 0 };
  }

  const mdFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== '00-README.md')
    .map((e) => path.join(KNOWLEDGE_DIR, e.name))
    .sort();

  let totalChunks = 0;
  for (const filePath of mdFiles) {
    const n = await syncFile(filePath);
    console.log(`[support-kb-sync] ${path.basename(filePath)}: ${n} chunks`);
    totalChunks += n;
  }

  return { files: mdFiles.length, chunks: totalChunks };
}

const isMain = process.argv[1]?.includes('support-kb-sync');
if (isMain) {
  syncSupportKnowledge()
    .then(({ files, chunks }) => {
      console.log(`[support-kb-sync] Done. ${files} files, ${chunks} chunks indexed.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[support-kb-sync] Failed:', err);
      process.exit(1);
    });
}
```

---

## Step 4 - Add an internal API endpoint for manual trigger

In `src/api/` (find the file that registers internal/ops routes and add there, or create `src/api/support-kb-api.ts`):

```typescript
import { Router } from 'express';
import { syncSupportKnowledge } from '../skills/support-kb-sync.js';

export const supportKbRouter = Router();

// POST /api/internal/support-kb/sync
// Triggers a full re-index of the support knowledge pack.
// Requires the internal provision secret (same middleware as other /api/internal routes).
supportKbRouter.post('/sync', async (_req, res) => {
  try {
    const result = await syncSupportKnowledge();
    res.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: message });
  }
});
```

Wire it into the express app alongside other `api/internal` routes:

```typescript
app.use('/api/internal/support-kb', requireProvisionSecret, supportKbRouter);
```

---

## Step 5 - Register the weekly cron job

The cron job definition in YAML format (for import via `carina cron import` or manual creation in the Cron jobs UI):

```yaml
id: carina-support-kb-sync
name: "Support knowledge sync"
schedule: "0 2 * * 0"
noAgent: true
scriptConfig:
  script: "node --import=./register.js src/skills/support-kb-sync.ts"
  cwd: "/opt/carina/core"
  timeoutMs: 120000
deliveryChannels: []
```

Notes:
- `schedule: "0 2 * * 0"` runs at 02:00 UTC every Sunday.
- `noAgent: true` means no LLM is called; this is a pure script job.
- `cwd` must match the actual deploy path of `core.carinaai.uk` on the VPS. Check `DEPLOY_DIR` in `deploy.sh` and use that path. Do not hardcode `/opt/carina/core` if the actual path differs; read it from the deploy config first.
- The `register.js` loader pattern must match how other script cron jobs invoke TypeScript in this repo. Check existing `CronScriptConfig.script` values in the cron job store for the exact invocation pattern to copy.

Provide the YAML block in the commit message so the operator can paste it into the Cron jobs UI or run `carina cron import < support-kb-sync.yaml`.

---

## Step 6 - Update `deploy.sh` in `app.carinaai.uk`

Add a note to `deploy.sh` (as a comment near the rsync steps):

```bash
# NOTE: To update support knowledge files, edit files in:
#   backends/servers/core.carinaai.uk/brain/carina_support_knowledge/knowledge/
# Then deploy core.carinaai.uk and trigger the sync cron job manually via:
#   POST /api/internal/support-kb/sync   (requires INTERNAL_SECRET header)
# The weekly Sunday cron handles routine refreshes automatically.
```

---

## Done when

- [ ] `brain/carina_support_knowledge/knowledge/` exists with all 10 knowledge files.
- [ ] `store.ts` exports `deleteRagChunksBySource` and `deleteRagChunksByPack`.
- [ ] `src/skills/support-kb-sync.ts` compiles without errors (`pnpm tsc --noEmit`).
- [ ] Running `pnpm tsx src/skills/support-kb-sync.ts` against a dev DB prints chunk counts and exits 0.
- [ ] Running it a second time prints "Cleared N stale chunks" and reinsertes cleanly (no duplicates).
- [ ] `POST /api/internal/support-kb/sync` returns `{ ok: true, files: 10, chunks: N }`.
- [ ] The weekly cron YAML is committed to the repo and documented in the commit message.
- [ ] `pnpm test` (or `vitest run`) passes with no new failures.
