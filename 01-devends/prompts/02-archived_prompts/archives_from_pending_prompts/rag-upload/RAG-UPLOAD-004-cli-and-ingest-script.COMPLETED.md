# RAG-UPLOAD-004: CLI Extensions and Ingest Script

**Repo:** `core.carinaai.uk`
**Depends on:** RAG-UPLOAD-002 (store functions and chunk-text module)
**Goal:** Make RAG ingestion accessible from the terminal without going through the HTTP API.

---

## Context

The existing CLI command is `carina ingest --pack <name>`. It walks `.md` files from a hard-coded
archive directory (`archive/property-saas-spec`). Two things need to change:

1. The `rag` sub-command group needs to be added so operators can manage knowledge from the CLI.
2. The ingest path needs to accept an arbitrary directory so the `01-devends/RAG/` documents
   can be ingested without CLI code changes.

Locate the CLI entry point by finding where `carina ingest` is registered. Look in:
- `src/cli/commands/`
- `bin/` or `src/bin/`
- `package.json` `"bin"` field

---

## Step 1: `carina rag` sub-command group

Find the CLI command registration file and add a new command group `rag` with four sub-commands.
Follow the exact pattern used by existing commands (likely using a commander.js or yargs pattern).

### `carina rag upload <filepath> [--pack <name>]`

1. Resolve `filepath` to an absolute path
2. Check the file exists and its extension is one of `.md .txt .pdf .docx`
3. `const content = await extractFromBuffer(await fs.readFile(filepath), path.basename(filepath))`
4. `const source = 'file:' + path.basename(filepath)`
5. If `await isSourceIngested(source)`: print `Already ingested: {source}. Use --force to re-ingest.`
   If `--force` flag present: call `deleteRagSource(source, null)` first, then proceed.
6. `const chunks = chunkAuto(content)`
7. For each chunk: `await embed(chunk)` then `await insertRagChunkWithWorkspace(source, pack, chunk, embedding, null, { file: filepath })`
8. Print `Ingested {n} chunks from {filepath} into pack '{pack}'`

### `carina rag list [--pack <name>] [--limit <n>]`

1. Call `listRagSources(null, pack ?? null, limit ?? 50, 0)`
2. Print as a formatted table:
   ```
   SOURCE                       PACK       CHUNKS  INGESTED AT
   file:RAG-001-identity.md     carina      5      2026-06-26T10:00:00Z
   ...
   ```
3. Print total at the bottom: `Total: {total} sources`

### `carina rag delete <source>`

1. Call `deleteRagSource(source, null)`
2. Print `Deleted {n} chunks for source: {source}`

### `carina rag search <query> [--limit <n>]`

1. Call `searchRag(query, limit ?? 5)`
2. Print each result:
   ```
   --- Result 1 (source: file:RAG-001-identity.md, pack: carina) ---
   {content snippet, first 300 chars}
   ```

---

## Step 2: Update `carina ingest` to accept a custom directory

The existing `ingest` command walks `ARCHIVE_ROOT`. Add an optional `--dir <path>` flag:

```
carina ingest [--pack <name>] [--dir <path>] [--skills-only]
```

If `--dir` is provided, walk that directory instead of `ARCHIVE_ROOT`.

This is a minimal change: extract the directory argument before calling `ingestPackDirectory()`.

---

## Step 3: Shell script

**New file:** `scripts/ingest-rag-docs.sh`

```bash
#!/usr/bin/env bash
# Ingest all RAG knowledge documents in 01-devends/RAG/ into the rag_chunks table.
# Run this after adding or editing any RAG-XXX.md file.
# Usage: bash scripts/ingest-rag-docs.sh [--force]

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAG_DIR="${REPO_ROOT}/../../01-devends/RAG"
PACK="carina-rag"
FORCE_FLAG=""

if [[ "${1:-}" == "--force" ]]; then
  FORCE_FLAG="--force"
fi

if [[ ! -d "$RAG_DIR" ]]; then
  echo "ERROR: RAG directory not found: $RAG_DIR" >&2
  exit 1
fi

echo "Ingesting RAG documents from: $RAG_DIR"
echo "Pack: $PACK"
echo ""

TOTAL=0
for file in "$RAG_DIR"/RAG-*.md; do
  [[ -f "$file" ]] || continue
  echo "  -> $(basename "$file")"
  node --loader ts-node/esm src/cli/index.ts rag upload "$file" --pack "$PACK" $FORCE_FLAG || true
  TOTAL=$((TOTAL + 1))
done

echo ""
echo "Done. Processed $TOTAL documents."
echo "Run 'carina rag list --pack $PACK' to verify."
```

Make it executable: `chmod +x scripts/ingest-rag-docs.sh`

Also provide a compiled-JS variant using `pnpm exec carina` if the CLI is compiled:

```bash
# Fallback if ts-node is not available:
# pnpm exec carina rag upload "$file" --pack "$PACK" $FORCE_FLAG
```

---

## Step 4: Run the ingest on the 12 RAG documents

After verifying the CLI works, run once manually:

```bash
cd /opt/lampp/htdocs/verlox/carina/02-backends/core.carinaai.uk
bash scripts/ingest-rag-docs.sh
```

Print the result of `carina rag list --pack carina-rag` to verify all 12 documents are ingested.

---

## TypeScript

The new CLI commands must be typed. No `any`. The `embed()` call requires an embedding provider
to be configured - if it is not, print a clear error message and exit with code 1:
`"Embedding provider not configured. Set GOOGLE_API_KEY, VOYAGE_API_KEY, or OPENAI_API_KEY."`

---

## Tests

**New file:** `src/cli/commands/rag-cli.test.ts`

Mock `listRagSources` and assert the `list` command prints correct table output.
Mock `deleteRagSource` and assert the `delete` command prints the deletion count.
Mock `embed`, `insertRagChunkWithWorkspace`, `isSourceIngested` for the `upload` command:
- Uploads a `.md` file and prints chunk count
- Already-ingested source prints "Already ingested" message
- With `--force`: deletes then re-ingests

---

## Acceptance

- `carina rag upload ../../01-devends/RAG/RAG-001-carina-identity-and-purpose.md --pack carina-rag` prints chunk count
- `carina rag list --pack carina-rag` shows all 12 RAG documents after running the ingest script
- `carina rag search "what tools does Carina have" --limit 3` returns relevant chunks
- `carina rag delete file:RAG-001-carina-identity-and-purpose.md` removes chunks and confirms count
- `bash scripts/ingest-rag-docs.sh --force` re-ingests all 12 documents from scratch
