# Carina Kernel Phase 3: Build your first domain pack tutorial

## Goal

Publish a step-by-step developer tutorial that takes a reader from zero to a working domain pack in 30 minutes (the "Hello World" of Carina).

## Context

- Strategy: `CARINA_AS_LINUX.md` Phase 3 item 8 and "What To Do This Week" item 8
- Reference implementation: `core.carinaai.uk/src/skills/packs/property-uk/`
- Pack APIs: `src/skills/pack-loader.ts`, stable API doc from prompt `09`
- Hub publish: prompt `10`
- Template pack: good first issue `02-pack-template-hello-world.md` from prompt `07`
- Docs site: `docs.carinaai.uk/`

## Dependencies

`09-stable-public-api-semver.md`, `10-hub-pack-cli-commands.md`

## Files to create

- `docs.carinaai.uk/docs/developer/first-domain-pack.md` (main tutorial)
- `docs.carinaai.uk/docs/developer/_examples/hello-pack/` (example pack source copied into docs or linked from monorepo)
- `core.carinaai.uk/src/skills/packs/template/README.md` (if template pack not yet created by issue 02)

## Files to modify

- `docs.carinaai.uk/sidebars.ts`
- `core.carinaai.uk/CONTRIBUTING.md` (link tutorial)
- `carinaai.uk/index.html` (developer CTA link)

## Step-by-step

1. Tutorial outline (use as doc structure):

   **Part 1: Prerequisites (5 min)**
   - Node 22+, `npm install -g @verlox/carina-core` (or `carina-agent` during transition)
   - `carina setup`

   **Part 2: Scaffold a pack (5 min)**
   - Create directory `~/.carina/resources/packs/hello-pack/`
   - Add `pack.json`:

     ```json
     {
       "name": "hello-pack",
       "version": "0.1.0",
       "description": "Hello World domain pack",
       "author": "Your Name",
       "skillCount": 1,
       "optional": true,
       "category": "demo"
     }
     ```

   **Part 3: Add one skill (10 min)**
   - Add skill JSON or TS module following `property-uk` smallest skill example
   - Skill teaches agent to respond with domain-specific greeting

   **Part 4: Enable and test (5 min)**
   - `export ACTIVE_SKILL_PACKS=hello-pack`
   - `carina chat` and verify skill system prompt suffix

   **Part 5: Optional tool (5 min)**
   - Register one trivial tool (e.g. `hello_lookup`) using stable tool API from prompt `09`

   **Part 6: Share (5 min)**
   - `carina pack publish ./hello-pack` (hub token)
   - Or npm publish as `@yourorg/pack-hello` with `carina` field in package.json

2. Include troubleshooting:
   - Pack not loaded: check `ACTIVE_SKILL_PACKS` spelling
   - Manifest validation errors: link to `validatePackManifest`

3. Add copy-paste commands block for each step; test every command against current codebase and fix paths that differ.

4. Add estimated time badges per section (30 min total).

5. Link from manifesto, CONTRIBUTING, and homepage "Build your own" CTA.

6. Optional: Docusaurus interactive check at end ("You should see X in chat output").

## Expected behavior

- A developer with no VERLOX access completes tutorial and has a loadable pack
- Tutorial uses stable public API imports only, not deep internal paths

## Test

- Follow tutorial on clean machine or temp dir; record any broken steps and fix
- `cd docs.carinaai.uk && pnpm build`
- Tutorial mentions kernel vs pack boundary correctly

## Pitfalls

- Do not use fabricated regulatory data in examples
- Keep hello-pack minimal; no property compliance claims
