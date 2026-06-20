# Carina Kernel Phase 2: Split @verlox/carina-core package

## Goal

Restructure `core.carinaai.uk` into a pnpm workspace where `@verlox/carina-core` is the installable kernel (tools, memory, routing, CLI) without bundled domain packs, with a backward-compatible `carina-agent` meta-package.

## Context

- Today: single package `carina-agent` in `core.carinaai.uk/package.json` ships all packs in `files`
- Target from `CARINA_AS_LINUX.md`:

  ```
  @verlox/carina-core          # kernel only
  carina-agent          # meta-package: depends on @verlox/carina-core (transition shim)
  ```

- CLI packaging gap: `phase2-gap-closure/01-carina-core-gaps/01-cli-packaging.md` (complete or merge its deliverables here)
- Pack loader: `src/skills/pack-loader.ts`, `BUILTIN_PACKS_DIR`
- Do NOT move Scout server or ops panel into this workspace

## Dependencies

`00-lock-brand-and-boundaries.md`, `phase2-gap-closure/01-carina-core-gaps/01-cli-packaging.md` (run first or in parallel)

## Files to create

```
core.carinaai.uk/pnpm-workspace.yaml
core.carinaai.uk/packages/core/package.json       # name: @verlox/carina-core
core.carinaai.uk/packages/core/tsconfig.json
core.carinaai.uk/packages/core/src/index.ts         # re-export public API
core.carinaai.uk/packages/cli/package.json          # name: @carina/cli or keep bin on core
core.carinaai.uk/packages/meta-carina-agent/package.json  # name: carina-agent, depends on @verlox/carina-core
```

## Files to modify

- `core.carinaai.uk/package.json` (becomes workspace root)
- `core.carinaai.uk/tsconfig.json` (project references)
- `core.carinaai.uk/bin/carina.ts` (move to `packages/core/bin/` or `packages/cli/`)
- `scripts/export-carina-core-public.sh` (export `@verlox/carina-core` layout)
- All internal imports: use `@verlox/carina-core` path alias where crossing package boundary

## Step-by-step

1. Read `core.carinaai.uk/package.json`, `bin/carina.ts`, and `src/index.ts`. Map modules into kernel vs pack vs web:

   **Kernel (@verlox/carina-core):**
   - `src/agents/`, `src/brain/`, `src/config/`, `src/memory/`, `src/tools/`, `src/types/`
   - `src/gateway/` except heavy web static assets (defer web to prompt `12`)
   - `src/skills/index.ts`, `pack-loader.ts`, hub client; NOT `src/skills/packs/*` builtins (prompt `13`)

   **Not kernel:**
   - `src/skills/packs/*` (separate packages)
   - `src/gateway/web/` static UI (prompt `12`)
   - Scout-specific server code

2. Create pnpm workspace at `core.carinaai.uk/pnpm-workspace.yaml`:

   ```yaml
   packages:
     - 'packages/*'
   ```

3. Create `packages/core/package.json`:

   ```json
   {
     "name": "@verlox/carina-core",
     "version": "0.2.0",
     "type": "module",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "bin": { "carina": "./dist/bin/carina.js" },
     "files": ["dist/", "templates/", "README.md", "LICENSE"],
     "dependencies": { }
   }
   ```

   Move kernel source into `packages/core/src/` OR use TypeScript project references pointing at root `src/` with `exports` map (prefer minimal move: keep `src/` at root initially, set `"name": "@verlox/carina-core"` on root package first, then extract physically in a second commit if needed).

   **Pragmatic v1 approach (recommended):**
   - Rename root package to `@verlox/carina-core` in `package.json`
   - Publish `carina-agent@0.2.0` as thin wrapper package in `packages/meta-carina-agent/` that depends on `@verlox/carina-core@^0.2.0` and re-exports bin
   - Remove `src/skills/packs/` from `@verlox/carina-core` `files` array (packs become optional install)

4. Default install behavior:
   - `npm install -g @verlox/carina-core` installs kernel only; zero packs enabled unless `ACTIVE_SKILL_PACKS` set
   - `npm install -g carina-agent` installs meta package that pulls `@verlox/carina-core` + documents how to `carina pack install property-uk`

5. Update `pnpm test`, `pnpm build` scripts at workspace root to run across packages.

6. Update `README.md` and `README.cli.md` install instructions:

   ```bash
   npm install -g @verlox/carina-core
   # or during transition:
   npm install -g carina-agent
   ```

7. Add Vitest smoke test: fresh install simulation with no packs; agent starts with core tools only.

8. Update export script for public repo to match new package name(s).

## Expected behavior

- Kernel installs without shipping all 16 domain packs in npm tarball
- Existing `pnpm test` passes
- `carina chat` works with `ACTIVE_SKILL_PACKS=` empty (core-only mode)

## Test

```bash
cd core.carinaai.uk
pnpm install
pnpm build
pnpm test
pnpm carina --version
ACTIVE_SKILL_PACKS= pnpm carina chat --once "hello"   # or equivalent non-interactive smoke
```

- `npm pack @verlox/carina-core` tarball excludes `src/skills/packs/` (verify with `tar tzf`)

## Pitfalls

- Do not break `pnpm hub` or ingest scripts; update paths in workspace root scripts
- Keep Node `>=22` engine constraint
- Scout client in core stays optional; no hard dependency on `@verlox/carina-scout` npm package until prompt `14`
