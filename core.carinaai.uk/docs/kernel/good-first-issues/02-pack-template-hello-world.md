---
title: "feat: add hello-world domain pack template under src/skills/packs/template/"
labels:
  - good first issue
  - pack
---

## Context

Domain packs are how vertical products extend Carina without forking core. New pack authors need a minimal, copy-paste starting point. `pack-loader.ts` already skips a directory named `template` when listing builtin packs (see `listBuiltinPackNames()`).

## Task

Add a **hello-world** pack template under `src/skills/packs/template/` with minimal valid files and a README explaining how to copy it.

## Files to create

```
src/skills/packs/template/
  pack.json          # valid manifest (name: template or hello-world-template)
  skills.ts          # export one PackSkillInput skill
  README.md          # copy instructions, ACTIVE_SKILL_PACKS, ingest command
```

Reference an existing minimal pack for structure, e.g. `src/skills/packs/research-basics/`.

## Acceptance criteria

- [ ] `pack.json` passes `validatePackManifest()` in `src/skills/pack-loader.ts`
- [ ] One skill exported from `skills.ts` with name, description, and prompt suffix
- [ ] README explains: copy folder, rename, set `ACTIVE_SKILL_PACKS`, run `pnpm ingest --pack <name>`
- [ ] Template does **not** appear in `listBuiltinPackNames()` output (directory name `template` is skipped)
- [ ] Optional: add a Vitest case in `src/skills/pack-loader.test.ts` that loads the template manifest when read directly

## Test

```bash
cd core.carinaai.uk
pnpm test src/skills/pack-loader.test.ts
node -e "
  import { readPackManifest } from './dist/skills/pack-loader.js';
  import path from 'path';
  const dir = path.join('src/skills/packs/template');
  readPackManifest(dir).then(m => console.log('OK', m.name));
"
pnpm build && pnpm test
```
