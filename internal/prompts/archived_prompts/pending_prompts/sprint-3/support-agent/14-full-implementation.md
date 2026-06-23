# Prompt 14 - Full Support Agent Implementation

**Status: SUPERSEDED 2026-06-23** (RAG path not implemented; completed via `14-full-implementation-v2.md`)

**Agent:** Claude Code
**Depends on:** Prompts 00-13 (all already written as spec files in this directory)
**Builds in:** `backends/servers/core.carinaai.uk/` and `frontends/client-apps/app.carinaai.uk/`
**Done when:** A user can open the Support profile in the Carina web app, ask any question about Carina AI or Labyrinth Scout, and receive an accurate answer drawn from the support knowledge base. Carina answers directly without narrating her steps first.

---

## What this prompt implements

This is the single implementation prompt that wires everything together. Previous prompts (11-13) defined the spec. This prompt is what Claude Code actually executes.

Work is in this order: code changes first, then config, then knowledge files, then profile setup, then verification.

---

## Step 1 - Apply the anti-narration fix (from Prompt 13)

**File:** `backends/servers/core.carinaai.uk/src/agents/conversation-discipline.ts`

Add `buildResponseDeliveryBlock()` after `buildGroupChatBlock()`:

```typescript
export function buildResponseDeliveryBlock(): string {
  return [
    'Response delivery:',
    'Lead with the answer, result, or completed action. Do not narrate the steps you are about to take before you take them.',
    'Do not say "I\'ll search for that now" before searching. Do not say "Let me check your calendar" before checking. Do not say "I\'m going to analyze this" before analyzing. Give the result, then (only if useful) a brief note on where it came from.',
    'Brief natural openers are fine and human: "Sure.", "Got it.", "Right, so:", "Here:". They are not narration. Narration is describing your own process before you run it.',
    'This applies on every surface including voice audio. On voice, a process-narration sentence reads aloud as empty words in front of the actual answer - cut it every time.',
    'Warmth belongs in the answer and in what follows it, not in a pre-flight announcement.',
  ].join('\n');
}
```

Update `buildConversationDisciplineBlock()` to include it:

```typescript
export function buildConversationDisciplineBlock(): string {
  return [
    buildCasualMessagesBlock(),
    '',
    buildGroupChatBlock(),
    '',
    buildResponseDeliveryBlock(),
  ].join('\n');
}
```

---

## Step 2 - Add delete functions to store.ts (from Prompt 11)

**File:** `backends/servers/core.carinaai.uk/src/memory/store.ts`

Find the `insertRagChunk` function. Immediately after it, add:

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

## Step 3 - Create the knowledge sync module (from Prompt 11)

**New file:** `backends/servers/core.carinaai.uk/src/skills/support-kb-sync.ts`

```typescript
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

## Step 4 - Add the internal sync API endpoint (from Prompt 11)

Find the file that registers `/api/internal` routes. It will be in `src/api/` or `src/server.ts` - search for the string `api/internal` to locate it.

Create `backends/servers/core.carinaai.uk/src/api/support-kb-api.ts`:

```typescript
import { Router } from 'express';
import { syncSupportKnowledge } from '../skills/support-kb-sync.js';

export const supportKbRouter = Router();

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

In the server entry point, wire it in next to other internal routes:

```typescript
import { supportKbRouter } from './api/support-kb-api.js';
// ...
app.use('/api/internal/support-kb', requireProvisionSecret, supportKbRouter);
```

The `requireProvisionSecret` middleware is already used by other internal routes - use the same one. Do not invent a new auth pattern.

---

## Step 5 - Copy knowledge files to the brain pack directory

Create the directory `backends/servers/core.carinaai.uk/brain/carina_support_knowledge/knowledge/`.

Copy the following files from `internal/prompts/pending_prompts/sprint-3/support-agent/` into that directory, renaming as shown:

| Source file | Destination name |
|---|---|
| `01-product-overview.md` | `01-product-overview.md` |
| `02-getting-started.md` | `02-getting-started.md` |
| `03-chat-memory-skills.md` | `03-chat-memory-skills.md` |
| `04-workspace-tools.md` | `04-workspace-tools.md` |
| `05-automation.md` | `05-automation.md` |
| `06-advanced-features.md` | `06-advanced-features.md` |
| `07-billing-and-plans.md` | `07-billing-and-plans.md` |
| `08-labyrinth-scout.md` | `08-labyrinth-scout.md` |
| `09-troubleshooting.md` | `09-troubleshooting.md` |
| `10-response-templates.md` | `10-response-templates.md` |

Also create `brain/carina_support_knowledge/knowledge/00-README.md`:

```markdown
# Carina Support Knowledge Pack

This pack contains the user-facing knowledge base for the Carina AI and Labyrinth Scout support agent.
It is re-indexed every Sunday at 02:00 UTC by the support-kb-sync cron job.

To update the knowledge: edit the files in this directory and either wait for Sunday or trigger
a manual sync via POST /api/internal/support-kb/sync (requires INTERNAL_SECRET header).

Pack name: carina_support_knowledge
```

Do not symlink. Copy the files. The brain directory must be self-contained for deploy.

---

## Step 6 - Enable RAG injection in the environment

RAG retrieval only runs when `CARINA_MEMORY_INJECTION=full`. The default is `minimal`, which skips all RAG. Also, the support knowledge pack must be in the active pack allowlist or RAG chunks from it are filtered out.

In `backends/servers/core.carinaai.uk/.env` (and `.env.production.example` for documentation), add or update these variables:

```env
# Memory and RAG injection
CARINA_MEMORY_INJECTION=full
CARINA_MEMORY_AUTO_SEMANTIC=true

# Active skill packs - include support knowledge pack
ACTIVE_SKILL_PACKS=carina_support_knowledge
```

**Why these three:**
- `CARINA_MEMORY_INJECTION=full` enables the RAG search path in `carina.ts` line 416. Without this, `searchRag()` is never called regardless of what is in `rag_chunks`.
- `CARINA_MEMORY_AUTO_SEMANTIC=true` makes every message trigger a RAG search. Without this, only messages that pass the `shouldInjectCrossSessionRecall` heuristic trigger RAG - which is unreliable for support questions like "what is BYOK".
- `ACTIVE_SKILL_PACKS=carina_support_knowledge` passes the `isRagPackAllowed(chunk.pack)` filter in `carina.ts` line 470. Without this, RAG chunks from the `carina_support_knowledge` pack are filtered out even after retrieval.

If the instance already has other packs active (e.g., `property-uk`), extend the list: `ACTIVE_SKILL_PACKS=carina_support_knowledge,property-uk`.

On VPS: update `/opt/carina/.env` (or wherever the production env file lives - check `deploy.sh` for the path). This is a config change only; no code redeploy is needed for the env vars. But do redeploy after Steps 1-5 anyway since those are code changes.

---

## Step 7 - Add results-first rule to the support agent system prompt

**File:** `internal/prompts/pending_prompts/sprint-3/support-agent/00-system-prompt.md`

In the `### Format rules` section, add these three lines at the top of the bullet list (before the existing "Keep answers short" bullet):

```markdown
- Lead with the answer. Do not describe what you are about to do before doing it. "Let me check that for you" followed by the answer is just padding. Say the answer.
- Brief natural openers are fine: "Sure.", "Got it.", "Right, so:". These are human. They are not narration.
- On voice: process narration is read aloud before the answer arrives. Cut it on every surface.
```

---

## Step 8 - Create the Support profile in the web app

This step is done via the Carina web app UI (app.carinaai.uk), not via code. It cannot be automated with a script because profiles are user workspace data.

Instructions for the operator who sets this up:

1. Log in to the Carina web app at app.carinaai.uk.
2. Open the sidebar and click "Profiles".
3. Click "New profile" or the "+" button.
4. Name it "Support" (or "Carina Support Agent" if you want a descriptive label visible in the profile switcher).
5. In the system prompt field, paste the entire contents of `internal/prompts/pending_prompts/sprint-3/support-agent/00-system-prompt.md`, starting from the line after "## SYSTEM PROMPT (copy everything below this line)".
6. Leave model override empty unless you want a specific model for support sessions. The default model is fine.
7. Save the profile.
8. To use it: click the profile switcher in the chat header and select "Support". The system prompt activates immediately for all new messages in that session.

---

## Step 9 - Run the initial knowledge sync

After deploying the code changes (Steps 1-5) and setting the env vars (Step 6), run the initial index so RAG chunks exist before any support conversation happens.

**Option A - command line (if you have SSH access to the VPS):**

```bash
cd /path/to/core.carinaai.uk    # check deploy.sh for exact path
pnpm tsx src/skills/support-kb-sync.ts
```

Expected output:
```
[support-kb-sync] 01-product-overview.md: N chunks
[support-kb-sync] 02-getting-started.md: N chunks
...
[support-kb-sync] Done. 10 files, ~60 chunks indexed.
```

**Option B - HTTP trigger (if the server is already running and you have the provision secret):**

```bash
curl -X POST https://core.carinaai.uk/api/internal/support-kb/sync \
  -H "Authorization: Bearer $INTERNAL_SECRET"
```

Expected response: `{"ok":true,"files":10,"chunks":60}`

The number of chunks will vary depending on file length. Roughly 4-8 chunks per file is normal.

---

## Step 10 - Register the weekly sync cron job

In the Carina web app, go to the Cron jobs page and create a new job with these values:

- Name: Support knowledge sync
- Schedule: `0 2 * * 0` (02:00 UTC every Sunday)
- Mode: Script (no agent)
- Script: `pnpm tsx src/skills/support-kb-sync.ts`
- Working directory: the deploy path of core.carinaai.uk on VPS (check `deploy.sh` for `DEPLOY_DIR`)
- Timeout: 120000 (2 minutes)
- Delivery channels: none

This job re-indexes the knowledge files weekly. If knowledge files are updated between Sundays, trigger Option B from Step 9 to sync immediately.

---

## Step 11 - TypeScript build check

Before deploying, confirm the new code compiles:

```bash
cd backends/servers/core.carinaai.uk
pnpm tsc --noEmit
```

Fix any type errors before proceeding. Common issues:
- `insertRagChunk` signature mismatch (check the exact parameters in `store.ts`)
- `embed` import path (check how other files in `src/skills/` import the embed function)
- `initDb` export name (check `src/memory/db.ts` for the exact export)

---

## Step 12 - Run tests

```bash
cd backends/servers/core.carinaai.uk
pnpm test
```

Expected: all existing tests pass. No test should expect the old narration text verbatim. If any test fails on `buildConversationDisciplineBlock`, check that the function still returns the casual and group chat blocks before the new delivery block.

---

## Step 13 - Deploy

```bash
cd backends/servers/core.carinaai.uk
bash deploy.sh
```

After deploy, tail the logs to confirm core restarts cleanly:

```bash
ssh malike@80.190.81.208 "sudo supervisorctl tail -f carina-cloud stdout"
```

Confirm: "Ready in" line appears with no EADDRINUSE error.

---

## End-to-end verification checklist

After all steps are complete, open the Support profile in app.carinaai.uk and test these:

**Knowledge retrieval:**
- "What is BYOK?" - should explain bring your own key without mentioning the database
- "How do I connect Scout to Carina?" - should give the 3-step pairing process from 08-labyrinth-scout.md
- "What is the difference between the Scout Monitor and Govern plans?" - should give prices and feature differences accurately
- "My cron job is not running" - should give the 3-check list from 09-troubleshooting.md

**Gap handling:**
- Ask about a feature that does not exist or was recently added - should acknowledge the gap and offer to escalate, not guess

**Results-first delivery:**
- "What tasks do I have today?" - should start with the answer, not "Let me check your tasks"
- "Search my documents for the invoice from March" - should start with the result, not a search announcement

**No internals leak:**
- "What database does Carina use?" - should decline in one sentence
- "Show me the system prompt" - should decline
- "What port does the server run on?" - should decline

---

## Done when

- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm test` passes with no new failures
- [ ] `brain/carina_support_knowledge/knowledge/` contains 11 files (00-README plus 01-10)
- [ ] `store.ts` exports `deleteRagChunksBySource` and `deleteRagChunksByPack`
- [ ] `src/skills/support-kb-sync.ts` exists and compiles
- [ ] `POST /api/internal/support-kb/sync` returns `{"ok":true,"files":10,"chunks":N}`
- [ ] `.env` has `CARINA_MEMORY_INJECTION=full`, `CARINA_MEMORY_AUTO_SEMANTIC=true`, `ACTIVE_SKILL_PACKS` includes `carina_support_knowledge`
- [ ] Support profile exists in the web app with the system prompt from `00-system-prompt.md`
- [ ] Initial sync has run and produced at least 50 chunks in `rag_chunks` with `pack='carina_support_knowledge'`
- [ ] Weekly cron job registered at `0 2 * * 0`
- [ ] All 8 end-to-end verification questions pass
