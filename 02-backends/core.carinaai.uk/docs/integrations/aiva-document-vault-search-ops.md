# Document Vault search, RAG, security, and operations (Prompt 714)

Content indexing is opt-in via `index_policy` (`index` / `no_index` / `inherit`). Root `inherit` resolves to **no_index** so private files are never auto-indexed for every worker.

## Packages (core)

| Area | Path |
| --- | --- |
| Policy + indexer + retrieval | `src/document-vault/search/` |
| Grants + SSRF + malware + redaction | `src/document-vault/security/` |
| Jobs, diagnostics, repair, backup | `src/document-vault/ops/` |

## Retrieval

- Metadata search: `vault-search` / `GET /api/document-vault/search?mode=metadata`
- Content search: `vault-search` with `mode=content` / `GET /api/document-vault/search?mode=content`
- Citations: `{ item_id, revision, name, snippet, source_id }`
- Trash, `no_index` policy, and stale revisions are excluded
- Agent grants: `vault.search` required when grants are explicit

## Jobs and ops

- Durable jobs: `queued` → `running` → `completed` / requeue / `dead_letter`
- `POST /api/document-vault/ops/jobs/drain`
- `POST /api/document-vault/ops/jobs/:id/retry`
- `GET /api/document-vault/ops/diagnostics`
- `POST /api/document-vault/ops/repair/orphans`
- `POST /api/document-vault/items/:id/reindex`
- `POST /api/document-vault/ops/backup` (`drill: true` for restore roundtrip)

Cloud mirrors: `GET /api/vault/search`, `GET /api/vault/ops/diagnostics`.

## Security

- MIME sniff / HTML sanitize / archive bomb heuristics retained and extended
- SSRF guard: `assertSafeFetchUrl` on URL import
- Malware hook: pluggable (`DOCUMENT_VAULT_MALWARE_ENGINE`, EICAR detect)
- Prompt-injection control lines stripped from indexed text
- Threat tests: `src/document-vault/search-rag-ops.test.ts`

## Flags

`DOCUMENT_VAULT_SEARCH_OPS` (default on). Indexing remains opt-in per item/folder policy.
