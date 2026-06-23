# Prompt 04: Distro CLI Commands


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

The `carina distro` command group provides the developer workflow for creating, validating,
running, and publishing Carina distros. This is the primary interface developers use to
build on top of the Workspace Platform.

## What to Build

### 1. `carina distro create`

Interactive wizard to scaffold a new distro:
```bash
carina distro create
```

```
Distro ID (e.g. my-practice): abbis
Display name: ABBIS Practice Manager
Description: Carina for ABBIS legal practice management
Category: legal
Base skills to include: abbis-billing, property-uk
Tools to block: nmap, nikto (security tools not relevant)
Primary color: #1e40af

Creating abbis distro in ./abbis/...
  carina.distro.json
  prompts/abbis-system.md
  workflows/ (empty)
  README.md

Done. Run: carina distro dev --distro ./abbis/carina.distro.json
```

### 2. `carina distro dev`

Run Carina with a distro in development mode (auto-reload on file change):
```bash
carina distro dev --distro ./abbis/carina.distro.json
```

Uses `chokidar` to watch the distro directory. On change: reload the distro config
and log the diff of what changed (system prompt, tools, skills).

```
[distro-dev] Watching ./abbis/ for changes...
[distro-dev] Loaded: ABBIS Practice Manager v1.0.0
[distro-dev] Tools blocked: nmap, nikto (2 tools)
[distro-dev] Required skills: abbis-billing, property-uk (2 skills)
[distro-dev] Carina ready at http://localhost:3333
```

### 3. `carina distro validate`

Validate a distro without running it:
```bash
carina distro validate ./abbis/carina.distro.json
```

Checks:
- Schema validation (Zod)
- Referenced skill IDs exist in the skills registry
- Referenced tool IDs exist in the tools registry
- System prompt file exists and is readable
- Workflow files exist and are valid TypeScript

```
Validating ABBIS Practice Manager v1.0.0...
  Schema: OK
  Skills: OK (abbis-billing found, property-uk found)
  Tools: OK
  System prompt: OK (1,247 chars)
  Workflows: 2 files, 0 errors

Distro is valid.
```

### 4. `carina distro build`

Package the distro for distribution:
```bash
carina distro build --distro ./abbis/carina.distro.json --output ./dist/abbis.carina
```

Produces a `.carina` file (a zip archive containing all distro assets):
```
abbis.carina (zip)
  carina.distro.json
  prompts/
  workflows/
  assets/   (logo, icons)
  README.md
```

### 5. `carina distro install`

Install a distro from a `.carina` file or the Hub:
```bash
carina distro install abbis                          # from Hub
carina distro install ./dist/abbis.carina           # from local file
carina distro install https://hub.carinaai.uk/...   # from URL
```

Installs to `~/.carina/distros/<id>/`.

### 6. `carina distro list` and `carina distro remove`

```bash
carina distro list     # list installed distros
carina distro remove abbis   # uninstall distro
```

## Verification Checklist

- [ ] `carina distro create` produces a valid `carina.distro.json` and directory structure
- [ ] `carina distro dev` reloads when `carina.distro.json` is edited
- [ ] `carina distro validate` fails with clear message when a required skill ID does not exist
- [ ] `carina distro build` produces a valid zip containing all distro files
- [ ] `carina distro install abbis` installs to `~/.carina/distros/abbis/`
- [ ] `carina distro list` shows installed distros with version numbers

## Files to Create or Modify

- CREATE `src/cli/distro.ts` - all distro subcommands
- MODIFY `src/cli/index.ts` - register distro command group
- CREATE `src/distro/builder.ts` - build/package distro to .carina file
- CREATE `src/distro/installer.ts` - install from file/hub/url
- MODIFY `package.json` - add chokidar dependency if not already present
