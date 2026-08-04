# Multi-tenant isolation (Aiva / hosted Core)

## Goal

No workspace may read or write another workspace's contacts, memory, documents,
notes, research, media, cron, or Google credentials. Each customer keeps their
own durable memory and persistence.

## Hermes-style memory per Aiva

Every Aiva worker gets the same layered memory model, scoped to
`workspace_id` + `worker_id` (and `contact_id` for user facts):

| Layer | Aiva mechanism | Isolation |
| --- | --- | --- |
| Hot durable USER/MEMORY | `aiva_worker_persistent_facts` via `worker-memory`; frozen prompt snapshot until writes | workspace + worker (+ contact for user) |
| Episodic recall | `worker-conversation-search` (Postgres scoped; host SQLite FTS5 never used when tenantScope set) | `aiva-<workerId>-%` sessions + employee thread rows |
| Working set | `session-working-sets/aiva/<workerId>/...` | unique session id nested under worker |
| Procedural skills | `aiva_worker_skills` injected + `worker-skills` tool | workspace + worker |
| Optional external | Mem0/Honcho with key `aiva-ext:{workspace}:{worker}:{contact}` | fail-closed: only exact session key rows |
| Host shared memory | blocked (`memory`, `session-search`, `agent-sync`, SHARED_MEMORY) | never reachable from Aiva |

## Scope keys

| Data | Required keys |
| --- | --- |
| Durable Aiva memory (`aiva_worker_persistent_facts`) | `workspace_id` + `worker_id` (+ `contact_id` for user facts) |
| Learning loop | `workspace_id` + `worker_id` |
| Chat / session search | session id prefix `aiva-<workerId>-` plus worker ownership check |
| Session working set | unique `sessionId` under `aiva/<workerId>/` |
| Worker skills | `workspace_id` + `worker_id` |
| Contacts (Google / CSV / manual / enrichments) | full `workspaceId` in filename |
| Workspace documents / notes / research / approvals | `workspace_id` |
| Google tool accounts | `aiva_tool_accounts.workspace_id` |

## Hard rules

1. **Aiva sessions never use host stores.** Blocked tools include `memory`,
   `session-search`, `agent-sync`, `cronjob`, `research-list`, `images-gallery`.
2. **No env Google token fallback** when a `workspaceId` is present.
3. **No unscoped contact / research / media list** when `HOSTED_MODE` or
   `CARINA_OPS_PRODUCT_ENABLED` is on; require `x-workspace-id`.
4. **Docs/notes tools bind to the calling session's workspace only**, never to
   "whichever single workspace is live" and never to `__operator__` for Aiva.
5. **Prompt isolation:** Aiva skips host personality, SHARED_MEMORY, contacts
   dump, standing orders, operator persistent facts, unscoped RAG, and host
   skill MD. Worker durable memory and procedural skills are injected via the
   Aiva persona suffix.
6. **Scoped search never short-circuits into host FTS5.** When `tenantScope` is
   set, `searchSessionsAdvanced` uses Postgres only.

## Disk layout (contacts)

```
CARINA_HOME/profiles/contacts/
  google-<workspaceUuid>.json
  manual-<workspaceUuid>.json
  csv-<workspaceUuid>.json
  enrichments-<workspaceUuid>.json
```

Legacy short-prefix `google-<first16chars>.json` files are still readable for
the matching workspace, but new syncs write the full UUID name.

## Disk layout (working sets)

```
CARINA_DATA/session-working-sets/
  aiva/<workerUuid>/<sessionId>.json
  <host-sessionId>.json
```

## Enforcement helpers

- `src/security/tenant-isolation.ts`
- `WORKSPACE_SECURITY_BLOCKED_TOOLS` in `workspace-capabilities.ts`
- `isToolAllowedForWorker` in `workspace-message-handler.ts`
- `invalidateWorkerDurableMemorySnapshot` in `worker-persistent-memory.ts`
