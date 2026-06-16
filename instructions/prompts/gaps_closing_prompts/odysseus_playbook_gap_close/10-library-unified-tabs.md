# Prompt 10 - Library Unified Tabs

## Objective

Upgrade `/library` to Odysseus parity: four tabs **Chats**, **Documents**, **Research**, **Archive** with search, preview, and bulk actions.

---

## Context

**Working directory:** `app.carinaai.uk`

**Prerequisites:** 02 (research jobs), 04 (documents), UI redesign 11 (library page base).

---

## Step 1 - Tab structure

Refactor `library/page.tsx`:

```tsx
type LibraryTab = 'chats' | 'documents' | 'research' | 'archive';
```

Shared header: search input (filters active tab), sort dropdown (recent, alphabetical).

---

## Step 2 - Chats tab

Existing session list enhanced:
- Inline preview (first user message truncated)
- Actions: Open, Archive, Delete, Copy link
- Bulk select checkboxes + Archive selected / Delete selected

Archived sessions move to Archive tab, not deleted.

---

## Step 3 - Documents tab

List from `GET /api/documents?archived=false`:
- Title, updatedAt, word count
- Actions: Open editor, Pin to chat, Archive, Delete

---

## Step 4 - Research tab

List from `GET /api/research`:
- Query, mode, status, completedAt
- Actions: View report, Discuss in chat (from prompt 02), Export md, Delete

---

## Step 5 - Archive tab

Union query: archived sessions + archived documents + old research (status completed, archived flag).

Restore action per item type.

Add `archived` boolean to `research_jobs` if missing.

---

## Step 6 - API extensions

```
PATCH /api/sessions/[id]  - { archived: true }
PATCH /api/documents/[id] - { archived: true }
PATCH /api/research/[id]  - { archived: true }
```

---

## Acceptance criteria

- [ ] All four tabs render with empty states.
- [ ] Search filters current tab client-side (server search optional).
- [ ] Bulk archive works on chats tab.
- [ ] Research tab links to discuss-in-chat flow.
