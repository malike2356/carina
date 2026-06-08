# Action: Generic Domain Pack Loader - Verify, Generalise, and Document the Existing Pack Architecture (Standalone Carina)

## Goal
Reinterpret this spec's PHP-based "domain pack" architecture (filesystem-scanning, hot-reloading, `SKILL.md`-manifest, `Handler::execute()`) onto Carina's actual, already-working TypeScript pack system, and close the one real gap it has: every other prompt in this batch (`01`, `02`, `03`, `04`, `05`) creates a NEW pack and has been told "check whether a generic pack loader exists yet - register through it instead of hand-extending `PACK_DIRS`." This prompt is what makes that check return "yes."

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- **The spec describes a different architecture almost entirely**: PHP classes (`DomainPacks\PropertyUk\Tools\RightmoveScraper`, `Handler::execute($params)`), filesystem hot-reload watchers, YAML-frontmatter `SKILL.md` manifests, Ollama model configs, and a `restaurant-uk` verification pack. None of this exists in or fits Carina's stack (`grep -rln 'DomainPacks\|SKILL.md\|Handler::execute' src/` returns nothing - this is, like several other phase-3 specs, written for a PHP-hosted product and bulk-imported). **Do not build a PHP-style class-autoloading hot-reload system.** Carina already has a working, simpler pack architecture: read `src/skills/index.ts` (`PACK_DIRS`, `loadSkillsForTask`, `loadPackSkills`, `getPackSystemSuffix`, `exportPack`) and `src/skills/packs/property-uk/` (`skills.ts` + `pack.json`) in full before writing anything - this IS Carina's "domain pack system," already shipped, already working, just not generic yet.
- **The one genuine, valuable idea in this spec is "generic, not hand-wired"**: right now, adding a pack means manually editing `PACK_DIRS` and the `loadPackSkills`/`getPackSystemSuffix` allowlists in `index.ts` (confirmed by reading it - it's a short file with `property-uk` as the only entry). The spec's "scan a directory, validate a manifest, register" lifecycle is a genuinely good idea reduced to its essence: **stop hand-listing packs in `index.ts`; scan `src/skills/packs/` at startup, read each `pack.json`, validate its shape, and build the registry from what's actually on disk.** That is the entire useful kernel of this spec, once you strip away the PHP-specific and hot-reload-specific scaffolding.
- **Explicitly descope these spec elements, with reasons**:
  - **Hot-reload** ("adding/removing a pack does not require restart", filesystem watchers): Carina is a long-running Node process started via `pnpm cli`/Docker, not a dev-mode PHP app reloading on every request. A restart-to-pick-up-new-packs model is normal, safe, and far simpler than running `fs.watch` in production with all the edge cases that brings (partial writes, watcher leaks, re-registration races the spec itself flags as needing "wait for active calls to finish"). Build directory-scanning at startup; explicitly do not build a watcher. If the user wants live reload later, that is a deliberate, separate feature decision - not a default.
  - **PHP `Handler::execute($params)` / class-based tool manifests**: Carina's tools are already `Tool` objects with an `execute` function (`registry.ts`/`tools/index.ts`) - this concept already exists, just under different syntax. A generic pack loader needs to let a pack register `Tool`s the same way `property-uk`'s conditionally-registered tools do (check `tools/index.ts` for how `land-registry`/EPC-style property tools get conditionally added) - not introduce a second tool-registration mechanism.
  - **Ollama `models/` configs**: Carina's own `CLAUDE.md` documents "DeepSeek first for all LLM calls... no local model infrastructure" (cited in `04-datascience-mlops-research.md` for the same reason) - a per-pack local-model-config mechanism contradicts that decision. Drop this section of the manifest entirely; document why.
  - **`restaurant-uk` verification pack**: keep this idea, but as a TypeScript `PackSkillInput[]` + `pack.json` pair (2-3 trivial skills), not a PHP class tree with prompts/tools/models/data subdirectories.

## Files to create
- `src/skills/pack-loader.ts` - generic scan-validate-register logic (`discoverPacks()`, `validatePackManifest()`, `loadAllPacks()`)
- `src/skills/pack-loader.test.ts`
- `src/skills/packs/template/skills.ts` - a documented, copyable starting point (TS file with inline comments explaining each field, mirroring the spec's "template must work out of the box, hello-world domain pack" intent)
- `src/skills/packs/template/pack.json`
- `src/skills/packs/restaurant-uk/skills.ts` - the verification pack (2-3 trivial skills: e.g. `menu-costing`, `food-safety-checklist`)
- `src/skills/packs/restaurant-uk/pack.json`
- `docs/domain-packs.md` - reframed for the actual TS architecture (see step 6)

## Files to modify
- `src/skills/index.ts` - replace the hand-maintained `PACK_DIRS`/allowlist pattern with calls into the new generic loader, while preserving `property-uk`'s existing behaviour exactly (this file's public functions - `loadSkillsForTask`, `loadPackSkills`, `getPackSystemSuffix`, `exportPack` - are likely called from elsewhere; trace every call site with `grep -rn 'loadPackSkills\|getPackSystemSuffix\|loadSkillsForTask' src/` before changing signatures, and keep them backward compatible)

## Step-by-step

1. Read `src/skills/index.ts` in full and trace every call site of its exported functions across `src/`. This file is the thing you're generalising; understand exactly what currently depends on its current shape before changing it, so packs created by `01`-`05`'s prompts (which may run before or after this one, in either order) keep working regardless of sequencing.

2. Define a minimal, TypeScript-native pack manifest shape - reusing `pack.json`'s existing fields (`name`, `version`, `description`, `author`, `skillCount`) plus whatever the loader needs to validate (e.g. confirm `skillCount` matches the actual exported array length - a cheap, useful sanity check the spec's "validation" step gestures at). Do not invent a YAML-frontmatter format to match the spec's `SKILL.md` - `pack.json` already exists, is simpler, and needs no new parser dependency.

3. Implement `discoverPacks()`: read subdirectories of `src/skills/packs/`, for each one check for `pack.json` + `skills.ts`, parse and validate the manifest (`validatePackManifest()` - clear error per missing/malformed field, skip-and-warn rather than crash-the-process on one bad pack), and dynamically `import()` the skills module. Note the ESM dynamic-import path-resolution gotcha (`.js` extensions at runtime vs `.ts` at authoring time - check how the existing codebase handles this elsewhere, e.g. in `tools/index.ts`'s registration list, since dynamic imports of TypeScript-authored-but-compiled files are exactly the kind of thing that silently breaks between `pnpm dev` and `pnpm build`).

4. Implement `loadAllPacks()`: call `discoverPacks()` once at startup (mirror wherever `tools/index.ts`'s registration currently happens - likely also at startup), build the registry the current hand-maintained `PACK_DIRS` map represents, and feed it into the existing `loadSkillsForTask`/`loadPackSkills`/`getPackSystemSuffix` functions so their *external* behaviour is unchanged - only the *source* of the pack list moves from a hardcoded map to a filesystem scan.

5. Update `src/skills/index.ts` to use the new loader internally. **This is a refactor of working code - the highest-risk step in this prompt.** Run the full existing skill-related test suite before AND after, and add a regression test that asserts `property-uk` loads with exactly the same skills, count, and system suffix as before the change (a snapshot-style assertion is appropriate here specifically because "did I just silently break the one pack we ship to customers" is the exact failure mode a refactor like this risks).

6. Write `docs/domain-packs.md` reframed for the real architecture - cover: what a pack is (a directory with `pack.json` + `skills.ts` exporting `PackSkillInput[]`), how to create one (copy `template/`, write skill entries following the `Skill` shape, add tools to `tools/index.ts` if the pack needs new ones - point at the conditional-registration pattern), the manifest spec (`pack.json` fields), how to test (`pnpm vitest run src/skills/`), how to "share" a pack (it's a directory in a TypeScript monorepo - the honest answer may be "submit a PR," not a marketplace; don't invent packaging/distribution infrastructure the spec only vaguely gestures at and this product has no channel for).

7. Build the `template/` pack: 1-2 skill entries with prose `steps` that are themselves instructional ("// Replace this trigger list with phrases your domain's users would say", etc. - inline TS comments explaining each field, since the spec explicitly asks for "comments in every file explaining what to customize").

8. Build and run the verification: create `restaurant-uk` from the template, confirm `loadAllPacks()` discovers it, confirm its skills are retrievable via `loadPackSkills('restaurant-uk')`, then delete the directory and confirm a clean restart shows it gone with no dangling references or errors (this directly mirrors the spec's own verification steps - "create a test pack... verify Carina loads it... delete... verify clean removal" - just executed against the real architecture instead of the PHP one). Leave `restaurant-uk` in the repo as a working example alongside `template/` (a live, loadable example is more useful in code review and to future pack authors than a deleted one - the spec's "delete it" instruction was about proving the lifecycle works, which you can demonstrate and then keep the artifact).

9. Document in your completion summary: (a) the explicit descoping of hot-reload, PHP handlers, and Ollama configs with the one-line reason for each, (b) confirmation that `01`-`05`'s packs (whichever already exist on disk by the time this runs) load correctly through the new generic mechanism without modification, (c) the manifest-validation rules you implemented and what they catch.

## Expected behavior
- Starting Carina (`pnpm cli`) discovers every pack under `src/skills/packs/` (including `property-uk` and any of `core-engineering`/`creative-basics`/`research-basics`/`productivity-uk` that exist by then) without a single line of hand-edited `PACK_DIRS` configuration.
- Adding a new pack means: create a directory, write `pack.json` + `skills.ts`, restart. No code changes to `index.ts`.
- A malformed pack (bad `pack.json`, `skillCount` mismatch, missing `skills.ts`) produces a clear startup warning and is skipped - it does not crash Carina or silently corrupt the registry.
- `property-uk`'s behaviour is provably unchanged (regression-tested), because this was a refactor of the one pack actually shipped to customers.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/skills/
pnpm test
pnpm build
pnpm cli   # confirm startup logs show all discovered packs, including restaurant-uk and template
```
Manual check:
```
1. Confirm `loadPackSkills('property-uk')` returns the same skills/count as before the refactor
2. Temporarily rename a pack.json to break its JSON - confirm Carina logs a clear warning and starts up normally, skipping only that pack
3. Confirm restaurant-uk's skills are discoverable in a session ("what's a good way to cost out a restaurant menu?")
```

## Dependencies
- Should run early relative to `01`, `02`, `03`, `04`, `05` if possible (they were each told to "check whether a generic loader exists" - if this one runs first, they register through it cleanly; if it runs last, it must absorb whatever packs they already created without breaking them - either order must work, but running this one first removes the most rework)
- No new external dependencies (dynamic `import()` and `fs.readdir` are native; `pack.json` parsing is plain `JSON.parse`)
