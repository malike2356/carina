---
sidebar_position: 2
---

# Publishing a domain pack

Major domain packs can ship as scoped npm packages (`@carina/pack-*`) and can also be listed on the [Carina Skills Hub](https://hub.carinaai.uk). The current public kernel package is `carina-agent`; the future scoped `@carina/core` package will ship pack **metadata** only, with pack bodies as opt-in installs.

## Package layout

Use `packages/packs/_template/` as a starting point. A publishable pack includes:

```
my-pack/
  package.json       # name: @carina/pack-<slug>, carina.pack → pack.json
  pack.json          # manifest: name, version, description, skillCount
  src/index.ts       # exports { skills, systemSuffix }
  skills.ts          # PackSkillInput[]
  prompts/system.ts  # optional systemSuffix string
  tools/             # optional domain tools
  data/              # optional static domain data
  README.md
```

For the future scoped package split, `package.json` will declare:

```json
{
  "name": "@carina/pack-property",
  "peerDependencies": { "@carina/core": "^0.2.0" },
  "imports": { "#core/*": "@carina/core/internal/*" },
  "carina": { "pack": "./pack.json", "slug": "property-uk" }
}
```

Pack code imports core helpers via `#core/...` (resolved to `@carina/core/internal/*` at publish time after the scoped package split).

## npm publish

1. Bump semver in `pack.json` and `package.json`.
2. Build core and the pack from the monorepo root:

   ```bash
   cd core.carinaai.uk
   pnpm build
   pnpm --filter @carina/pack-property build
   ```

3. Publish from the pack directory:

   ```bash
   cd packages/packs/property-uk
   npm publish --access public
   ```

4. Register the npm name in core `PACK_NPM_PACKAGES` (`src/skills/pack-discovery.ts`) and add `npmPackage` on the manifest entry in `src/skills/pack-manifests.ts`.

## Hub listing

After npm publish (or for hub-only packs):

```bash
carina pack publish property-uk
```

This uploads a tarball to the Skills Hub registry. Users can install with:

```bash
carina pack install property-uk
```

## npm install path

Users can install directly from npm:

```bash
npm install @carina/pack-property
export ACTIVE_SKILL_PACKS=property-uk
carina chat
```

Or use the CLI flag:

```bash
carina pack install property-uk --npm
```

Core resolves packs in this order: `~/.carina/packs/`, monorepo `packages/packs/` (dev), legacy `src/skills/packs/` when `CARINA_DEV=1`, then installed `@carina/pack-*` in `node_modules`.

## Large corpora

If a pack RAG corpus exceeds npm size limits, split data into a companion package (for example `@carina/pack-property-data`) and document the dependency in the pack README. Keep pack semver independent of the Carina kernel package.

## v1 extracted packs

| Slug | npm package | Status |
|------|-------------|--------|
| `property-uk` | `@carina/pack-property` | Published |
| `healthcare` | `@carina/pack-health` | Published |
| `borehole-africa` | `@carina/pack-borehole-africa` | Private WIP (ABBIS corpus) |

Remaining built-in packs still live under `src/skills/packs/` until extracted in a later phase.
