# Carina Kernel Phase 2: Extract domain pack npm packages

## Goal

Publish major domain packs as independent npm packages (`@verlox/pack-property`, `@verlox/pack-health`, etc.) installable via `carina pack install` or `npm install`.

## Context

- Target from `CARINA_AS_LINUX.md`:

  ```
  @verlox/pack-property   # property-uk
  @verlox/pack-health     # healthcare
  ```

- Builtin packs today: `core.carinaai.uk/src/skills/packs/`
- Reference pack: `property-uk` (read `pack.json`, skills, tools)
- Pack loader: `pack-loader.ts`, `ACTIVE_SKILL_PACKS`
- Hub CLI: prompt `10`

## Dependencies

`08-split-carina-core-package.md`, `09-stable-public-api-semver.md`

## Files to create

```
core.carinaai.uk/packages/packs/property-uk/package.json      # @verlox/pack-property
core.carinaai.uk/packages/packs/healthcare/package.json       # @verlox/pack-health
core.carinaai.uk/packages/packs/borehole-africa/package.json  # @verlox/pack-borehole-africa (ABBIS domain pack)
core.carinaai.uk/packages/packs/_template/                    # author template (links to good first issue)
```

## Files to modify

- Move or symlink pack content from `src/skills/packs/property-uk/` to `packages/packs/property-uk/`
- `src/skills/index.ts` PACK_REGISTRY: load packs from node_modules `@carina/pack-*` and `~/.carina/resources/packs/`
- Hub seed: register npm package names
- `10-hub-pack-cli-commands.md` install path: support `npm install @verlox/pack-property` then register

## Step-by-step

1. For each v1 pack (minimum: `property-uk`, `healthcare`, `borehole-africa`):
   - Create package with correct scoped name (e.g. `@verlox/pack-property`, `@verlox/pack-borehole-africa`), `files: [pack.json, skills/, tools/, data/, brain/ subset]`
   - `peerDependencies: { "@verlox/carina-core": "^0.2.0" }`
   - Export manifest path for core to discover: `"carina": { "pack": "./pack.json" }` in package.json

   **`borehole-africa` note:** This pack is the domain knowledge layer for ABBIS (abbis360.com), the borehole industry SaaS for Ghana and West Africa. It is the first commercially deployed Carina pack built for a non-UK market. The pack corpus covers Ghana geology, CWSA standards, drilling prices by region, pump selection, water quality limits, equipment specs (Massenza, Hauhinco, Hausherr), and GBDA association rules. Pack source material is in `/opt/lampp/htdocs/verlox/abbis/archive/` and `/opt/lampp/htdocs/verlox/abbis/strategy/04-carina-integration.md`. Build this pack in lockstep with ABBIS application development; do not publish to npm until the RAG corpus is complete and tested.

2. Update pack discovery in core:

   ```typescript
   // Pseudocode: resolve @carina/pack-* from node_modules/carina field
   // plus ~/.carina/resources/packs/
   // plus dev fallback src/skills/packs/ when CARINA_DEV=1
   ```

3. Remove property-uk, healthcare, and borehole-africa from `@verlox/carina-core` tarball `files` list. All packs are opt-in; none ship with the kernel by default.

4. `carina pack install property-uk` resolves to:
   - Hub tarball, OR
   - `npm install @verlox/pack-property` if user passes `--npm`

5. Publish workflow doc in `docs/developer/publishing-a-pack.md`:
   - npm publish for pack package
   - `carina pack publish` for hub listing

6. Tests:
   - Core with `@verlox/pack-property` installed registers property tools
   - Core without pack does not register property tools

## Expected behavior

```bash
npm install -g @verlox/carina-core @verlox/pack-property
export ACTIVE_SKILL_PACKS=property-uk
carina chat
# property tools available
```

## Test

```bash
cd core.carinaai.uk
pnpm test src/skills/pack-loader.test.ts
pnpm test src/skills/pack-manifests.test.ts
```

## Pitfalls

- Large `brain/` corpus for property-uk: consider optional `@verlox/pack-property-data` if tarball exceeds npm limits; document in pack README
- Keep pack versions semver independent of core
