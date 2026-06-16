# Prompt 08 - Personas + Group Chat

## Objective

Implement Odysseus-style custom characters and multi-persona group chat. PewDiePie: "create your own characters... create a group chat with them."

Carina core has `personality` CLI and group-chat adapters; cloud has nothing user-facing.

---

## Context

**Working directories:** `core.carinaai.uk`, `app.carinaai.uk`

**Files to inspect first:**
- `core.carinaai.uk/src/profiles/personality.ts`
- `core.carinaai.uk/src/gateway/group-chat.ts`
- `app.carinaai.uk/src/db/schema.ts`

---

## Step 1 - Schema

```ts
export const personas = pgTable('personas', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  name: text('name').notNull(),
  avatarInitials: text('avatar_initials').default('AI'),
  avatarColor: text('avatar_color').default('#22c55e'),
  systemPrompt: text('system_prompt').notNull(),
  tone: text('tone'), // optional shorthand
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const groupChats = pgTable('group_chats', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  title: text('title').notNull(),
  personaIds: jsonb('persona_ids').$type<string[]>().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const groupChatMessages = pgTable('group_chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupChatId: uuid('group_chat_id').notNull(),
  personaId: uuid('persona_id'), // null = user
  role: text('role').notNull(), // user | persona
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

Use `avatarInitials` (2 chars) instead of emoji in UI to comply with ASCII-only copy in code comments; user can pick color.

---

## Step 2 - Personas CRUD

`/settings/personas` page:
- List personas
- Create/edit: name, initials, color, system prompt, tone preset dropdown
- Delete with confirm

API: `/api/personas` CRUD.

---

## Step 3 - Group chat UI

`/chat/group/[id]` or mode on standard chat:

1. User creates group: select 2-4 personas + title.
2. User sends message.
3. Backend orchestrates round-robin or parallel persona replies (one turn each per user message):
   - For each persona, call provider with persona system prompt + transcript.
   - Stream each reply as separate bubble with persona label.

Orchestration in `src/lib/group-chat-orchestrator.ts` (cloud) or delegate to core internal API.

Keep token budget: max 2 persona replies per user message in v1.

---

## Step 4 - Sidebar entry

Under Tools: Personas (settings) and optional "Group chat" in New chat dropdown.

---

## Acceptance criteria

- [ ] Create persona and use in 2-persona group chat.
- [ ] Each persona reply shows distinct label/avatar.
- [ ] Group transcript persists in DB.
- [ ] No emoji required in codebase strings (use initials + color).

## Note

This is intentionally lighter than Odysseus meme characters; professional tone for property SaaS, same mechanics.
