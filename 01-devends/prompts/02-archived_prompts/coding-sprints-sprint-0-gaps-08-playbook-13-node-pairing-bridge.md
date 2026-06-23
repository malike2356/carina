# Prompt 13 - Node Pairing Bridge (Cloud + Self-Hosted)

## Objective

Connect the "runs on your computer" story to Carina Cloud: user pairs a home `carina host` node so cloud chat can delegate file/shell tasks to local machine.

---

## Context

**Core:** O7 node host + pairing (`carina pair`, `POST /api/pair/accept`).

**Cloud:** No awareness of paired devices.

---

## Step 1 - Schema

```ts
export const pairedNodes = pgTable('paired_nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  name: text('name').notNull(),
  deviceId: text('device_id').notNull(), // from core pairing
  hostUrl: text('host_url').notNull(), // https://user-tunnel or local bridge URL
  lastSeenAt: timestamp('last_seen_at'),
  status: text('status').notNull().default('offline'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

---

## Step 2 - Pairing flow UI

`/settings/nodes` page:

1. **Add node** shows QR or pairing code (fetch from core `carina pair` via internal API or user pastes token).
2. User runs `carina pair` on home machine; enters code in cloud UI.
3. Cloud `POST /api/nodes/pair` validates token with core, stores `paired_nodes` row.

List nodes: name, status, last seen, Revoke.

---

## Step 3 - Agent delegation

When chat mode is **agent** and workspace has online paired node:

- Tool calls for `file-read`, `file-write`, `shell` route to node proxy `POST {hostUrl}/api/node/execute` with signed workspace token.
- If no node online, fall back to cloud-only tools with message in tool result.

Implement `src/lib/node-proxy.ts`.

---

## Step 4 - Chat UI indicator

Input bar shows pill "Local node: {name}" when node selected (dropdown if multiple).

---

## Acceptance criteria

- [ ] Pair flow stores node and shows in settings.
- [ ] Revoke removes node and rejects further proxy calls.
- [ ] Agent task with paired node executes file read on remote (integration test with mock node).

## Security

- All node requests signed with short-lived JWT (5 min).
- User must explicitly enable "Allow local node tools" per workspace setting.
