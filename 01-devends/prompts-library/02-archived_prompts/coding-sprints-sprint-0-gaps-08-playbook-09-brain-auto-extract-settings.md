# Prompt 09 - Brain Auto-Extract Settings

## Objective

Expose Brain auto-extract settings in Carina Cloud: auto-extract memories from conversations, auto-extract skills from agent workflows, auto-approve skills above confidence threshold, max skills injected per request.

Target story: "extracts memories from your conversation... the more you use it, the more it will understand you."

---

## Context

**Working directory:** `app.carinaai.uk`

**Core:** memory extraction and skill auto-writer exist; toggles are ops-only today.

**Prerequisite:** UI redesign prompts 08-09 (memory/skills panels).

---

## Step 1 - Workspace settings schema

Extend `workspace_settings` (or add columns):

```ts
autoExtractMemories: boolean('auto_extract_memories').default(true),
autoExtractSkills: boolean('auto_extract_skills').default(false),
autoApproveSkillsMinConfidence: integer('auto_approve_skills_min_confidence').default(85),
maxSkillsPerRequest: integer('max_skills_per_request').default(3),
injectMemoriesInChat: boolean('inject_memories_in_chat').default(true),
```

Migration + API PATCH on `/api/workspace/settings`.

---

## Step 2 - Settings UI - Brain tab

On `/settings`, add tab **Brain** (or section in Appearance):

| Toggle | Label | Help text |
|--------|-------|-----------|
| autoExtractMemories | Auto-extract memories | Save useful facts from conversations to Memory |
| autoExtractSkills | Auto-extract skills | Learn reusable procedures from agent tasks |
| slider 50-100 | Auto-approve skills at or above | Skills above this confidence are enabled automatically |
| number 1-10 | Max skills per request | Cap skill injection per message |

Save button persists to workspace_settings.

---

## Step 3 - Post-chat hooks

After assistant message completes in `/api/chat/route.ts`:

1. If `autoExtractMemories`, queue async job `POST /api/internal/memory/extract` to core with session id + last N messages (fire-and-forget, do not block stream).
2. If `autoExtractSkills` and mode was agent, queue skill extract job similarly.

Jobs must respect workspace id and internal key.

---

## Step 4 - Memory panel indicator

In `MemoryPanel.tsx`, show badge "Auto-extracted" on memories with `source: 'conversation'` metadata (add column `source` on `user_memories` if missing).

---

## Acceptance criteria

- [ ] Toggles persist per workspace.
- [ ] With auto-extract on, new memory row appears after chat (integration test with mocked core).
- [ ] Skills above confidence threshold auto-enabled in workspace_skills join table.
- [ ] `maxSkillsPerRequest` respected in `buildSystemPrompt` / carina-chat skill injection.
