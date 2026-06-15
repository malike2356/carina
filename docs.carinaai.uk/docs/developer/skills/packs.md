---
sidebar_position: 1
---

# Skill packs

Packs ship as optional npm packages (`@carina/pack-*`) and legacy built-ins under `src/skills/packs/`. Installed packs also live in `~/.carina/packs/`.

**Shipped today:** 16 pack manifests in core (96 curated skills). Extracted npm packs: `@verlox/pack-property`, `@verlox/pack-health`. See [Publishing a pack](/docs/developer/publishing-a-pack).

## Pack structure

```
my-pack/
  pack.json       # manifest: name, version, description
  skills/         # markdown skill files
  brain/          # optional RAG corpus for ingestion
```

## Activation

```bash
export ACTIVE_SKILL_PACKS=property-uk,core-engineering
carina packs install property-uk
pnpm ingest   # RAG corpus for a pack
```

## Authoring

See user guide [Creating packs](/docs/user/skill-packs/creating-packs). Runtime loading: `src/skills/index.ts` and pack guards in `isSkillAllowedForActivePacks`.
