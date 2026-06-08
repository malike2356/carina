# Action: Build the Installable Skill Pack Marketplace (Browse, Install, Configure, Uninstall)

## Goal
Build a marketplace UI and backing API on top of the EXISTING skills-hub infrastructure so users can browse, install, configure, update, and uninstall vertical skill packs (property-uk, legal-uk, medical-uk, etc.) through the Carina console with zero code changes to Carina Core.

## Context
- Spec file: `chat.carinaai.uk/prompts/phase2-gap-closure/05-website-promises/02-skill-packs-installable.md`
- **Substantial gap-closure: the hub/pack infrastructure already exists; the marketplace UI and install/configure flows are the gap.** Read these first:
  - `core.carinaai.uk/src/skills/hub/` — read `server.ts`, `build-pack.ts`, `validate.ts`, `migrations.ts` in FULL. This is the skills-hub backend; it almost certainly already implements pack manifest validation (`pack-validator.ts`'s job), pack building, and probably pack storage/registry concepts that `pack-registry.ts` would otherwise duplicate.
  - `core.carinaai.uk/src/skills/packs/property-uk/` — read its `SKILL.md` manifest and directory structure IN FULL. This is the spec's own "reference implementation" (lines 84-105) — it ALREADY EXISTS as a real, working pack. Use its actual manifest format as the ground truth for `pack-validator.ts`, not the spec's idealized description.
  - `core.carinaai.uk/CLAUDE.md` mentions `pnpm hub` (Skills Hub server) and `pnpm ingest` — read what these scripts actually invoke (`grep -n "\"hub\"\|\"ingest\"" core.carinaai.uk/package.json`) to understand the current operational model for packs.
- The gap is most likely: a user-facing BROWSE/INSTALL/CONFIGURE/UNINSTALL flow with a marketplace UI. The hub likely handles "how packs are built and validated" but probably not "how an end user discovers and installs one with a click." Confirm with `grep -rln "marketplace\|install.*pack\|pack.*install\|/api/packs" core.carinaai.uk/src --include="*.ts"`.
- Conventions: TypeScript strict, no emojis/em-dashes, reuse `validate.ts`'s manifest validation rather than writing a second validator, every new module gets `*.test.ts`.

## Files to create (only for confirmed gaps — read the hub fully before assuming any of these don't already exist in another form)
```
core.carinaai.uk/src/web/skill-packs/
  index.html                   — Marketplace/browser UI (spec layout lines 38-73)
  packs.css
  pack-browser.js              — Browse + tabs (Installed/Available/Updates)
  pack-detail.js               — Pack detail view + install button
  pack-manager.js              — Configure/update/uninstall installed packs
core.carinaai.uk/src/skills/
  pack-registry.ts             — Marketplace index (available packs list + metadata: ratings, install counts, version) — ONLY if hub/server.ts does not already serve an equivalent index
  pack-installer.ts            — Install/uninstall/update orchestration — wraps existing build-pack.ts, does not reimplement pack assembly
  __tests__:
    pack-registry.test.ts
    pack-installer.test.ts
core.carinaai.uk/src/api/
  packs-api.ts                 — REST handlers for the 8 documented routes (lines 28-36)
  __tests__/
    packs-api.test.ts
```

## Files to modify
- `core.carinaai.uk/src/skills/hub/server.ts` — confirm whether it already exposes any pack-listing/build endpoints that `packs-api.ts` should call into rather than duplicate; wire the new marketplace API to reuse them
- `core.carinaai.uk/src/skills/hub/validate.ts` — reuse this directly as `pack-validator.ts`'s implementation (re-export or call into it) rather than writing a parallel manifest validator; only extend it if the marketplace needs validation checks the hub's build-time validator does not perform (e.g. checking a pack is compatible with the user's installed Carina version)
- `core.carinaai.uk/src/gateway/commands.ts` or `web.ts` — add the `/packs` route/navigation entry, following existing patterns

## Step-by-step
1. Read `skills/hub/server.ts`, `build-pack.ts`, `validate.ts`, `migrations.ts` in full. Build a checklist: does the hub already (a) maintain a registry/index of available packs, (b) support installing a pack into a running Carina instance, (c) track installed-pack state, (d) support pack configuration? For each "yes," the corresponding spec file becomes a thin wrapper; for each "no," it's a genuine build.
2. Read `skills/packs/property-uk/SKILL.md` and its full directory tree. Compare its REAL manifest fields and structure against the spec's idealized description (lines 84-105: `prompts/`, `tools/`, `models/`, `data/`). Note any differences — the real pack is the ground truth your validator and installer must work against, not the spec's illustration.
3. Search for any existing marketplace/registry concept: `grep -rln "marketplace\|pack.*registry\|available.*pack" core.carinaai.uk/src`. If something close exists, extend it; if nothing does, `pack-registry.ts` is genuinely new — design it to read pack metadata from each pack's `SKILL.md` manifest (ratings/install-counts will need a backing store; if no usage-tracking exists yet, start with manifest-declared metadata only and note that live ratings/install-counts require a tracking table to be added — do not fabricate numbers).
4. Build `pack-installer.ts` as an orchestration layer over `build-pack.ts`: `install(slug)` resolves the pack source, validates via `validate.ts`, copies/links it into the active packs directory, and records install state; `uninstall(slug)` removes it and cleans up tool registrations; `update(slug)` re-runs install against a newer version while preserving the pack's stored configuration. Read `build-pack.ts` closely — it likely already does most of "assembling a pack into a usable form," and this installer should call it, not reimplement it.
5. Build `packs-api.ts` implementing the 8 routes (lines 28-36): list available, list installed, pack detail, install, uninstall, update, get/set configuration. Each handler delegates to `pack-registry.ts`/`pack-installer.ts` — keep this file thin (route parsing + response shaping only).
6. Build the marketplace UI (`index.html` + JS modules) matching the spec's layout (lines 38-73): tabs for Installed/Available/Updates, pack cards with name/description/version/author/install-count/rating, `[Install]`/`[Installed]`/`[Configure]`/`[Uninstall]` buttons wired to the API. Match `core.carinaai.uk/src/gateway/web.ts`'s existing UI conventions (CSS variables, fetch patterns, auth headers).
7. Wire `pack-detail.js` to show the pack's declared contents (prompts/tools/models/data counts) read directly from its manifest — this is the proof-of-concept for "what makes a pack vertical" (spec lines 75-82).
8. Add the `/packs` navigation entry to the existing web gateway.

## Expected behavior
- `https://console.carinaai.uk/packs` (or this codebase's real user-facing console URL) shows `property-uk` already marked Installed, with several other packs available
- Clicking "Install" on a pack runs validation, copies it into the active packs directory, registers its tools, and the pack appears under "Installed" without a Carina restart (confirm whether the hub's existing install mechanism, if any, already achieves hot-reload — if not, document that a restart is currently required and note it as a known limitation rather than building a hot-reload system from scratch)
- After installing, asking Carina a question in that pack's domain produces a domain-aware answer using the pack's prompts/tools
- Updating a pack preserves its existing configuration
- Uninstalling removes the pack and its tools become unavailable

## Test
- `pack-registry.test.ts`: marketplace listing reflects manifest-declared metadata accurately; installed/available/updates partitioning is correct
- `pack-installer.test.ts`: install/uninstall/update against a fixture pack (use `property-uk` or a minimal test fixture) round-trip correctly, including manifest validation rejecting a malformed pack
- `packs-api.test.ts`: each of the 8 routes behaves correctly and is scoped to the authenticated tenant where relevant (pack configuration is per-tenant; the marketplace listing is global)
- Run `pnpm test -- pack` and confirm all pass

## Dependencies
- Step 1-2 (reading the hub and the real `property-uk` pack) is the prerequisite for everything — the hub almost certainly already does most of "what a pack is and how it's assembled," and this prompt's job is the missing END-USER install/manage layer on top
- `validate.ts` must be reused for manifest validation — a second validator is the exact kind of duplication this gap-closure batch exists to prevent
