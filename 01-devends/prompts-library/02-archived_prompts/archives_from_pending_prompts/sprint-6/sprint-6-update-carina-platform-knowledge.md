# Sprint 6; Prompt: Update Carina AI Agent Knowledge of Current Architecture

**Status: COMPLETED 2026-06-25**

**What was built:**

- **platform-knowledge.md:** Updated with `01-devends` / `02-backends` / `03-frontends` layout, active projects, and current paths (updated 2026-06-25).
- **platform-state.md:** New machine-readable index at `02-backends/core.carinaai.uk/src/platform/platform-state.md`.
- **knowledge.ts:** Preloads and injects both markdown files on every agent turn via `buildPlatformKnowledgeContext()`.
- **conversation-discipline.ts:** `buildPlatformProjectAwarenessBlock()` added to base system prompt (compact project summary).
- **Build:** `package.json` build copies both platform markdown files to `dist/src/platform/`.
- **Tests:** `knowledge.test.ts`, `conversation-discipline.test.ts`, system-prompt snapshot updated; `tsc --noEmit` passes.
- **Part C:** Scout console branding checked; already consistent ("Labyrinth Scout" / "Scout"). No changes.
- **Deploy:** Core stack deployed to production VPS; health OK. Docs deploy fixed (broken links in `propreneur-bridge.md`).

**Sprint:** 6
**Prompt number:** 03
**Name:** Update Carina agent's internal knowledge/docs to reflect current architecture
**Primary agent:** Cursor / Claude Code
**Estimated hours:** 2-4 h

---

## Read First

Before writing any code, read these files in full:

1. `02-backends/core.carinaai.uk/src/agents/conversation-discipline.ts`; how system prompt blocks are assembled
2. `02-backends/core.carinaai.uk/src/skills/`; how skills are registered and loaded
3. `01-devends/planning/strategy/CARINA_AI_EMPLOYEE_PLAN.md`; the Aiva product spec
4. `01-devends/planning/strategy/CARINA_AIVA_SCOUT_INCUBATION_PROPOSAL.md`; the incubation proposal
5. `02-backends/xeclone/README.md`; the iLaud multimodal clone spec
6. `02-backends/xeclone/iLaud/persona/voice.md`; voice and tone definition
7. `02-backends/xeclone/iLaud/persona/values.md`; values and decision framework
8. `02-backends/xeclone/iLaud/persona/knowledge.md`; knowledge graph

---

## Context

Carina's agent currently answers architectural questions from static documentation. It has no awareness of:

- The reorganized directory structure (01-devends, 02-backends, 03-frontends)
- The flattened prompt naming conventions
- The xeclone project and iLaud multimodal clone
- The Aiva AI Employee product definition
- The Glen client pipeline
- The Papa Lord incubation proposal
- The Carina-to-Propreneur data bridge spec
- The n8n and MCP integration work

When a user asks Carina "what's new in your architecture?" it should answer with current knowledge, not stale documentation.

---

## What to Build

### Part A: Update Carina's Platform Knowledge

**A1. Update or create a platform knowledge skill**
- New file or update: `02-backends/core.carinaai.uk/src/skills/hub/public/` or wherever built-in skills live
- If Carina uses `PLATFORM_KNOWLEDGE.md` or similar static doc, update it

**A2. Update Carina's conversation discipline**
- In `conversation-discipline.ts`, add a system prompt block that injects current project awareness
- This block should be active when the agent loads platform context
- Include a brief summary of active projects so Carina can reference them in answers

---

### Part B: Create a Carina-facing Index of Current Work

**B1. Create `platform-state.md`**
- New file: `02-backends/core.carinaai.uk/src/platform/platform-state.md`
- A machine-readable index of what's currently active

**B2. Register the state doc in agent loading**
- In `knowledge.ts` (Carina loads context here, not `run_agent.py`)

---

### Part C: Update Scout Dashboard Branding

**C1. Check branding consistency**
- Scout references in the console should use "Labyrinth Scout" or "Scout" consistently
- Ensure the brand glossary from `01-devends/planning/strategy/BRAND_GLOSSARY.md` is applied

---

## Done When

- [x] Platform knowledge skill or doc updated with current architecture
- [x] Carina can answer "what's your architecture?" with the reorganized structure
- [x] Carina can answer "what projects are you working on?" with active project list
- [x] platform-state.md created and loaded by the agent
- [x] Conversation discipline includes project awareness block
- [x] `tsc --noEmit` passes
- [x] No breaking changes to existing Carina functionality

---

## Pitfalls

1. **Don't hardcode**; Project names and statuses change. Make the state doc easy to update.
2. **Don't reveal secrets**; platform-state.md is internal-facing but should still omit credentials, client details, and sensitive personal information.
3. **Keep it compact**; The system prompt block should be short. Link to full docs, don't embed them.
4. **Version this**; Add `updated: 2026-06-25` in the doc so future maintainers know when it was last refreshed.
