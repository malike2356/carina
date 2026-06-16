# Prompt 04 - Document Editor (Human Types, AI Assists)

## Objective

Add `/documents` to Carina Cloud with Odysseus/Claude-style live editor: **the user types**; AI fixes formatting, spelling, and fact-checks on request. AI must not ghost-write full documents by default.

---

## Context

**Working directories:** `app.carinaai.uk`, `core.carinaai.uk`

**Core:** `documents-api` exists (O4). Cloud has no documents route.

**PewDiePie quote:** "I can't type in it... if I type whatever I want, I can just tell it: fix the formatting, fix the spelling, or fact check this piece."

**Files to inspect first:**
- `core.carinaai.uk/src/gateway/documents-api.ts`
- `app.carinaai.uk/src/db/schema.ts`
- `app.carinaai.uk/src/components/panels/NotesPanel.tsx` (pattern for panels)

---

## Step 1 - Schema

```ts
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  sessionId: uuid('session_id'), // optional link to chat session
  title: text('title').notNull().default('Untitled'),
  content: text('content').notNull().default(''),
  format: text('format').notNull().default('markdown'), // markdown | plain
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

---

## Step 2 - API

```
GET    /api/documents
POST   /api/documents
GET    /api/documents/[id]
PATCH  /api/documents/[id]     - title, content (autosave)
DELETE /api/documents/[id]
POST   /api/documents/[id]/assist - { action: 'format' | 'spellcheck' | 'factcheck', selection?: string }
```

Assist endpoint:
- If `selection` provided, only transform selection; else whole doc.
- Call chat provider with system prompt: "Return only the corrected text. Do not add commentary."
- Return `{ content: string }` for client to apply as diff or replace.

Debounce autosave: client saves on 1s idle via PATCH.

---

## Step 3 - UI `/documents` and `/documents/[id]`

**List page:** grid of cards (title, updatedAt, word count). New document button.

**Editor page:** split layout:
- Left (70%): `contenteditable` or CodeMirror-lite textarea for markdown (use simple textarea + preview toggle for v1).
- Right (30%): AI assist panel with buttons:
  - Fix formatting
  - Fix spelling
  - Fact-check selection (disabled if no selection)
- Top bar: title input, Pin to chat, Archive, Export .md

**Pin to chat:** creates context pin on active session (or picker modal) type `document`, id + title.

Add sidebar link: Documents.

---

## Step 4 - Input bar integration

In `AttachPanel.tsx`, add "Documents" tab listing workspace documents; selecting one adds context pin.

---

## Acceptance criteria

- [ ] User can create, edit, autosave document without AI.
- [ ] Assist actions return editable result; user confirms apply.
- [ ] Pin document shows chip above input bar.
- [ ] Documents appear in Library Documents tab (prompt 10).
