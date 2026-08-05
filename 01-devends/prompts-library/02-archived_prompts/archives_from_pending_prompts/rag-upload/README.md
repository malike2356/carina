# RAG Knowledge Upload (RAG-UPLOAD-001 through 004)

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

**Status: FULLY BUILT (COMPLETED 2026-06-26)**

| Prompt | What shipped |
|--------|--------------|
| `RAG-UPLOAD-001-knowledge-upload-module.COMPLETED.md` | Original end-to-end spec |
| `RAG-UPLOAD-002-core-backend.COMPLETED.md` | `chunk-text`, extractors, store extensions, `rag-upload-api.ts`, 7 routes |
| `RAG-UPLOAD-003-app-frontend.COMPLETED.md` | `/knowledge` page, upload panels, proxy routes, sidebar nav |
| `RAG-UPLOAD-004-cli-and-ingest-script.COMPLETED.md` | `carina rag` CLI, `ingest-rag-docs.sh`, `--dir` on `carina ingest` |

## Key paths

**Core (`02-backends/core.carinaai.uk`):**
- `src/api/rag-upload-api.ts` and `src/api/rag-upload-api.test.ts`
- `src/memory/chunk-text.ts` and `src/memory/chunk-text.test.ts`
- `src/memory/rag-extractors.ts`
- `src/cli/commands/rag-cli.ts` and `src/cli/commands/rag-cli.test.ts`
- `scripts/ingest-rag-docs.sh`

**App (`03-frontends/client-apps/app.carinaai.uk`):**
- `src/app/(workspace)/knowledge/page.tsx`
- `src/components/knowledge/*`
- `src/app/api/knowledge/**`

## Operator commands

```bash
# Ingest all 01-devends/RAG/*.md into pack carina-rag
bash scripts/ingest-rag-docs.sh

# Custom directory via existing ingest command
pnpm exec tsx bin/carina.ts ingest carina-rag --dir ../../01-devends/RAG

# CLI management
pnpm exec tsx bin/carina.ts rag list --pack carina-rag
pnpm exec tsx bin/carina.ts rag search "query" --limit 5
```

## Tests

```bash
cd 02-backends/core.carinaai.uk
pnpm test src/api/rag-upload-api.test.ts src/memory/chunk-text.test.ts src/cli/commands/rag-cli.test.ts
```
