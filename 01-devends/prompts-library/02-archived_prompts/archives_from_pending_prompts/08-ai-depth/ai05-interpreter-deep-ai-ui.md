# Interpreter UI for Deep AI Assists

**Status: COMPLETED 2026-08-04**

**What was built:** See programme README and matching Clinicom/Carina implementation paths.

**Roadmap tier:** Must (AI depth)  
**Prompt ID:** AI05  
**Priority:** P0  
**Depends on:** AI04  
**Target time:** 12-20h  
**Primary paths:** `clinicom-ai/web/index.html`, `web/styles.css`, `web/js/app.js`, `web/js/explain-drawer.js`  
**Plan source:** Phase 08 AI depth

## Strategic intent

Make deep AI visible and controllable in the live encounter without turning the timeline into an unowned chatbot dump.

## Context (do not skip)

- Match premium encounter shell language already shipped (`gui-clinical-*`).
- Clinician authorship and safety ack theatre remain mandatory.
- Writing style / a11y / claim firewall rules apply.
- Riverside demo default.

## Problem this prompt solves

Backend assists exist but clinicians cannot see, accept, edit, or dismiss them in the encounter UI.

## Current baseline (read before coding)

- Timeline item rendering in `web/js/app.js`
- Explain drawer, safety overlay, Easy Read rail
- Composer / teach-back flows

## Required deliverables

1. Timeline cards / inline panels for:
   - Cultural note candidates (accept inserts note event; dismiss hides)
   - Confidence explain (“Why this confidence?”)
   - Safety triage assist checklist (does not replace ack modal)
   - Teach-back score chip + coaching tips
2. Composer: specialty simplify toggle when capability live.
3. Clear labelling: `AI assist · source keprix-gemini` (or stub).
4. Keyboard accessible actions; high-contrast mode still usable.
5. Empty/degraded states when deep_ai off.

## Architecture / design constraints

- No auto-filing of assist text into working clinical note without Accept/Edit.
- Mobile composer sheet must still fit actions.
- Keep one primary job per panel; avoid card salad in hero chrome.

## Files to create or change

- `web/js/app.js`, `web/styles.css`, `web/index.html` as needed
- Optional `web/js/deep-ai-ui.js`
- `tests/` browser smoke docs or API contract tests feeding UI fixtures

## Acceptance criteria

1. Manager/clinician demo: turn produces visible cultural assist with Accept.
2. Safety assist appears only when safety flagged; ack still required.
3. Stub source badge visible when backend stubbed.
4. WCAG focus order preserved for new controls.

## Demo / sales / awards proof

Open `/app?story=adaeze` → interpret chest-pain turn → show safety assist + cultural note → accept cultural note into timeline.

## Out of scope

Dashboard intelligence briefs (AI07); marketing claims beyond honesty labels.

## Related prompts

AMP03 safety theatre, AMP04 cultural notes, N06 confidence coaching.

## Handoff

Mark AI05 done; cache-bust interpreter assets; 3-minute demo script lines.
