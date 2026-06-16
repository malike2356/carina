# Carina Kernel Phase 2: Hub pack CLI commands

## Goal

Implement `carina pack search`, `carina pack install`, and `carina pack publish` CLI commands wired to the existing Skills Hub infrastructure.

## Context

- Target UX from `CARINA_AS_LINUX.md`:

  ```bash
  carina pack search property
  carina pack install property-uk
  carina pack publish ./my-healthcare-pack
  ```

- Existing hub code (read first):
  - `core.carinaai.uk/src/skills/hub/server.ts`
  - `core.carinaai.uk/src/skills/hub/registry.ts`
  - `core.carinaai.uk/src/skills/hub/build-pack.ts`
  - `core.carinaai.uk/src/skills/hub/validate.ts`
  - `core.carinaai.uk/src/skills/hub/hub-client.ts`
  - `core.carinaai.uk/src/setup/` (pack installer if present)
- Overlap: `phase2-gap-closure/05-website-promises/02-skill-packs-installable.md` (web UI); this prompt is CLI-first
- Stable API: prompt `09` manifest validation

## Dependencies

`08-split-carina-core-package.md`, `09-stable-public-api-semver.md`

## Files to create

```
core.carinaai.uk/src/cli/commands/pack/
  search.ts
  install.ts
  publish.ts
  list.ts
core.carinaai.uk/src/cli/commands/pack/pack-cli.test.ts
```

## Files to modify

- `core.carinaai.uk/bin/carina.ts` (register `pack` subcommand group)
- `core.carinaai.uk/src/skills/hub/hub-client.ts` (ensure client methods for search/install/publish exist or add them)
- `core.carinaai.uk/README.cli.md` (document pack commands)

## Step-by-step

1. Read hub server routes in `server.ts`. List existing HTTP endpoints. Extend hub client to match.

2. Implement `carina pack search <query>`:
   - Calls hub registry (local `pnpm hub` or `HUB_URL` env default `https://hub.carinaai.uk`)
   - Prints table: name, version, description, author, verified badge
   - `--json` flag for scripting

3. Implement `carina pack list`:
   - Lists locally installed packs (read from config dir `~/.carina/installed-packs.json` or equivalent)

4. Implement `carina pack install <slug>`:
   - Resolve slug from hub or builtin fallback (`src/skills/packs/` during dev)
   - Validate manifest via `validate.ts`
   - Copy/symlink pack into `~/.carina/resources/packs/` (match `CARINA_RESOURCES_DIR` from domain pack system)
   - Update `ACTIVE_SKILL_PACKS` in `~/.carina/config.yaml` or append to env file
   - Idempotent: reinstall upgrades version if newer

5. Implement `carina pack publish <path>`:
   - Validate local pack directory (`pack.json` + skills)
   - Run `build-pack.ts` to produce tarball
   - POST to hub `/api/packs/publish` with API key `CARINA_HUB_TOKEN` (document in `.env.example`)
   - Free to publish; verified badge is server-side manual for official packs

6. Error handling:
   - Hub unreachable: suggest `pnpm hub` for local dev
   - Invalid manifest: print validation errors from `validate.ts`

7. Tests with mocked hub HTTP (Vitest + fetch mock):
   - search returns filtered results
   - install writes config
   - publish rejects invalid pack

## Expected behavior

```bash
carina pack search property
# property-uk  1.0.0  UK property compliance and data tools

carina pack install property-uk
# Installed property-uk to ~/.carina/resources/packs/property-uk

carina pack publish ./my-pack
# Published my-healthcare-pack@0.1.0 to hub (pending verification)
```

## Test

```bash
cd core.carinaai.uk
pnpm test src/cli/commands/pack/
pnpm carina pack --help
HUB_URL=http://localhost:HUB_PORT pnpm hub &   # separate terminal
pnpm carina pack search property
```

## Pitfalls

- Do not duplicate manifest validation logic; call hub `validate.ts`
- Publish must never upload secrets from pack directory (scan for `.env` and reject)
