# Hello-world pack template

Copy this folder to create your first domain pack. The directory name `template` is skipped when listing built-in packs (`listBuiltinPackNames()`).

## Quick copy (local install)

```bash
mkdir -p ~/.carina/packs/hello-pack/prompts
cp -r src/skills/packs/template/* ~/.carina/packs/hello-pack/
# Edit pack.json name to hello-pack and update author
sed -i 's/hello-world-template/hello-pack/' ~/.carina/packs/hello-pack/pack.json
export ACTIVE_SKILL_PACKS=hello-pack
carina packs enable hello-pack
carina chat
```

## Files

| File | Purpose |
|------|---------|
| `pack.json` | Manifest validated by `validatePackManifest()` |
| `skills.ts` | Exports `*Skills` array (`PackSkillInput[]`) |
| `prompts/system.ts` | Exports `helloPackSystemSuffix` or `systemSuffix` |

## Validate manifest

```bash
cd core.carinaai.uk
pnpm exec tsx -e "
  import { validatePackManifest } from './src/skills/pack-loader.ts';
  import fs from 'fs';
  const raw = JSON.parse(fs.readFileSync('src/skills/packs/template/pack.json','utf8'));
  console.log(validatePackManifest(raw, 'template'));
"
```

## Tutorial

Full walkthrough: [Build your first domain pack](https://carinaai.uk/docs/developer/first-domain-pack)

## Hub publish

After renaming and testing locally:

```bash
carina pack publish ~/.carina/packs/hello-pack
```

Requires `CARINA_HUB_TOKEN` or local hub with publish key.
