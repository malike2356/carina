# Prompt 14 - Unified Brain Panel

## Objective

Merge Memory, Skills, and Brain Settings into one Odysseus-style **Brain** floating panel with sub-tabs: Memories | Skills | Add | Settings.

Replaces three separate sidebar entries with one "Brain" tool link.

---

## Context

**Working directory:** `app.carinaai.uk`

**Prerequisites:** Prompts 09, UI redesign 08-09.

---

## Step 1 - BrainPanel component

Create `src/components/panels/BrainPanel.tsx`:

Tabs:
1. **Memories** - embed existing MemoryPanel content
2. **Skills** - embed SkillsPanel content
3. **Add** - combined form: toggle Memory vs Skill, fields for each
4. **Settings** - auto-extract toggles from prompt 09 (subset, link "All brain settings" to `/settings` Brain tab)

Width: 400px. Same Panel primitive as other panels.

---

## Step 2 - Sidebar cleanup

`AppSidebar.tsx` Tools section:
- Remove separate Memory, Skills links
- Single **Brain** link opens panel with `detail: 'brain'`

`PanelProvider.tsx`: register `brain` panel type.

Keep Notes as separate (Odysseus separates Notes from Brain).

---

## Step 3 - Import/export (Memories tab)

Add buttons on Memories sub-tab:
- Import from file (.txt, .md, .json) - client parse, batch POST `/api/memories`
- Export all memories as .json download
- **Tidy** button: calls `POST /api/memories/tidy` (dedupe similar entries via core or simple string similarity)

Skills sub-tab:
- **Audit all** button: runs confidence review UI (list low-confidence skills)

---

## Acceptance criteria

- [ ] One Brain entry opens tabbed panel.
- [ ] All memory/skills CRUD still works.
- [ ] Settings tab reflects auto-extract toggles.
- [ ] Import/export memories functional.
