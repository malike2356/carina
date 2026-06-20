# Prompt 27 - Cookbook to Playbook Migration (Names, Aliases, Docs)

## Objective

Complete the rename from cookbook to playbook across CLI, docs, and UI. Keep `src/cookbook/` as internal implementation detail. We are not chefs; we run playbooks.

---

## Context

**Working directories:** `core.carinaai.uk`, `app.carinaai.uk`, `carina/instructions/`

---

## Step 1 - CLI deprecation shim

In `src/cli/commands/cookbook-cli.ts`:

On any invocation, print to stderr:

```
Note: carina cookbook is now carina playbook. Use: carina playbook hardware
```

Forward:
- `carina cookbook` -> `carina playbook hardware`
- `carina cookbook list` -> `carina playbook hardware --list`
- `carina cookbook serve` -> `carina playbook hardware --serve <id>`

Do not remove cookbook-cli registration for 2 release cycles.

Primary command: `playbook-cli.ts` from prompts 20-21.

---

## Step 2 - Docs update

Update or create:
- `core.carinaai.uk/docs/playbook.md` (primary)
- `core.carinaai.uk/docs/cookbook.md` -> short redirect notice pointing to playbook.md section "Hardware capability"

Explain in playbook.md:

| Concept | Name |
|---------|------|
| Hardware model matching | Playbook > Hardware tab (uses internal cookbook module) |
| Task routing | Playbook evaluate |
| Business decisions | Domain plays |

---

## Step 3 - Remove user-facing "cookbook" strings

Grep and replace in user-visible copy only:

```
packages/web/assets/**
packages/web/src/workspace-chrome.ts
app.carinaai.uk/src/components/**
README.md (carina root)
```

Do NOT rename:
- `src/cookbook/` directory
- `src/api/cookbook-api.ts` file (can alias route internally)
- Import paths

---

## Step 4 - Internal gap-close prompts supersession note

Add at top of `instructions/gap-analysis/ODYSSEUS_CLOSE_PROMPTS.md` (historical audit filename):

```
SUPERSEDED IN PART: O1 cookbook user-facing scope is now Playbook prompts 20-21, 25-27.
O1 implementation remains valid as internal hardware module.
```

---

## Step 5 - AGENTS.md / PRODUCT_BIBLE pointers

Add one line to `carina/AGENTS.md` or `PRODUCT_BIBLE.md` glossary:

**Playbook:** Situational decision engine (paths, scoring, domain plays). **Cookbook:** Internal hardware/model catalog module consumed by Playbook.

---

## Step 6 - Verification script

`scripts/verify-playbook-rename.sh`:

- Fails if `Cookbook` appears in `packages/web/assets/web/*.html` visible text
- Passes if `carina playbook --help` works
- Passes if `carina cookbook` prints deprecation notice

---

## Acceptance criteria

- [ ] `carina playbook` is primary documented CLI
- [ ] `carina cookbook` forwards with deprecation notice
- [ ] No "Cookbook" in cloud/core user-visible nav
- [ ] `src/cookbook/` still passes existing tests unchanged
- [ ] verify-playbook-rename.sh passes

## Brand voice

Use: play, path, execute, operator, situational, tradeoff, constraint.

Avoid: recipe, cook, chef, kitchen, ingredient.
