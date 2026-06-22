# Prompt 01 - Cookbook to Playbook Migration

## Objective

Replace user-facing "cookbook" terminology with "playbook" terminology across Carina,
Scout, and security-facing copy. Keep internal implementation names such as
`src/cookbook/` in place unless there is a separate migration prompt for code paths.

We want the product language to say playbook. Cookbook may remain only where it is a
private implementation detail or a temporary compatibility alias.

---

## Context

**Working directories:** `carina/`, `core.carinaai.uk/`, `app.carinaai.uk/`

**Canonical reference prompt:** `carina/internal/prompts/archived_prompts/gaps_closing_prompts/playbook_gap_close/27-cookbook-to-playbook-migration.md`

**Voice rule:** Use Carina-native wording. Do not ship competitor phrasing or borrowed
labels in user-facing text.

---

## Step 1 - Inventory user-facing cookbook strings

Search the repo for visible occurrences of:

- `cookbook`
- `Cookbook`
- `cookbooks`
- `Cookbooks`

Classify each hit as one of:

1. User-facing copy to replace with `playbook`
2. Internal implementation detail to keep
3. Temporary compatibility alias to keep for deprecation

Only category 1 is rewritten.

---

## Step 2 - Replace product language with playbook

Update first-party user-facing copy in:

- docs
- prompt packs
- READMEs
- CLI help text
- UI labels
- onboarding text
- status messages
- error messages
- security and Scout copy

Preferred replacements:

- `cookbook` -> `playbook`
- `Cookbook` -> `Playbook`
- `cookbooks` -> `playbooks`
- `Cookbooks` -> `Playbooks`

Keep the meaning intact. If a phrase now reads awkwardly, rewrite the whole sentence.

---

## Step 3 - Keep the internal module boundary stable

Do not rename these unless a separate migration prompt exists:

- `src/cookbook/`
- any imports that point at that internal module
- internal data models or API names that are not exposed to users

If a user-facing command or page points at the module, add a playbook label or alias on top
of the existing implementation.

---

## Step 4 - Compatibility aliases

If the CLI or any public route still exposes cookbook naming, keep the alias but make it
obviously transitional.

Use a deprecation notice such as:

`Note: carina cookbook is now carina playbook. Use: carina playbook hardware`

Rules:

- `carina playbook` is the primary command and documented term
- `carina cookbook` may remain as a forwarding alias for a limited period
- any alias output must be brief, direct, and consistent with Carina voice

---

## Step 5 - Update internal guidance

Update the language in:

- `carina/internal/prompts/pending_prompts/REUSE-RULES.md`
- `carina/AGENTS.md`
- `carina/PRODUCT_BIBLE.md` if it exists

The glossary should say that Playbook is the user-facing term, while Cookbook is only an
internal implementation label if the code still needs it.

---

## Step 6 - Verify the rename is complete

Add or update a small verification script that checks:

- no user-facing HTML, Markdown, or docs still say Cookbook when they should say Playbook
- `carina playbook --help` works
- `carina cookbook` either no longer exists or prints the deprecation notice
- internal module paths under `src/cookbook/` are still present if they are meant to stay

Use grep-style checks first, then run any project-specific tests that cover the renamed
surface.

---

## Acceptance criteria

- [ ] User-facing product copy says Playbook, not Cookbook
- [ ] Internal `src/cookbook/` implementation details remain stable unless explicitly migrated
- [ ] Any compatibility alias is documented and deprecated
- [ ] Glossary and prompt guidance reflect the new terminology
- [ ] Verification script passes

---

## Brand voice

Use: playbook, play, path, execute, operator, situational, policy, response.

Avoid: cookbook, recipe, chef, kitchen, ingredient, unless the text is explicitly talking
about the internal legacy name or a compatibility alias.

