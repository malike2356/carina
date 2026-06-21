# Sprint 2 - Category 11: Workspace Platform


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## What Exists

- `apps/cloud/src/pages/` - BillingPage, LoginPage, ScoutPage, AgentPage (React)
- Basic workspace shell with chat interface
- Projects concept exists in data model
- `src/workspaces/` - Named agent workspace routing

## What Is Missing

- Memory continuity (cross-session recall, project memory, semantic search)
- Launcher redesign (workspace home showing "continue work" not system internals)
- Distro runtime (carina.distro.json loader, module registration system)
- Distro CLI commands (create, dev, build, deploy, validate, add module)
- Distro module scaffolder (template generator for each module type)
- Shared UI package (@verlox/carina-ui component library)
- ABBIS distro proof (migrate ABBIS onto official distro runtime)
- Propreneur distro (property business vertical on distro runtime)
- Developer release (docs, SDK docs, example distro, community)

## Prompts in This Category

- `01-memory-continuity.md` - Cross-session recall, project memory, semantic search, memory API
- `02-launcher-redesign.md` - Workspace home with "continue work" flow
- `03-distro-runtime.md` - carina.distro.json loader and module registration system
- `04-distro-cli-commands.md` - create, dev, build, deploy, validate, add module commands
- `05-distro-module-scaffolder.md` - Template generator for domain modules
- `06-shared-ui-package.md` - @verlox/carina-ui component library
- `07-abbis-distro-proof.md` - Migrate ABBIS onto distro runtime as proof of concept
- `08-propreneur-distro.md` - Property business distro on Carina platform
- `09-developer-release.md` - SDK docs, example distro, NPM polish, community setup

## Original Reference

`sprint-2/gap-15-workspace-project/` (both source documents)
