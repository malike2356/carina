# Prompt 09 - Odysseus Media, Themes, Presets, and Auth

## Objective

Adopt the lighter Odysseus polish features that make the workspace feel complete: image and gallery handling, themes, preset states, session organization, and auth hardening such as 2FA if Carina still lacks it.

Reuse rule: theme names, preset labels, auth prompts, and media helper text must be rewritten in Carina voice.

---

## Read First

- `instructions/prompts/researched_gap/3-agents-to-adopt/odysseus/README.md`
- `core.carinaai.uk/apps/cloud/`
- `core.carinaai.uk/src/ui/`
- `core.carinaai.uk/src/session/`
- `core.carinaai.uk/src/auth/`

---

## What to Check

1. Which appearance and personalization features already exist in Carina.
2. Whether gallery or media handling is already present in a usable form.
3. Whether sessions, presets, and theme state are exposed to the user in a clean way.
4. Whether any authentication hardening from Odysseus is actually missing.

---

## Deliverable

Add only what improves the product surface:

- media handling that users can reach from the workspace
- theme and preset behavior that sticks
- auth hardening only where Carina is weaker

---

## Acceptance Criteria

- Personalization features are visible and persistent.
- Media handling does not create a second broken upload path.
- Auth changes do not disturb the current login flow unless they improve it.
