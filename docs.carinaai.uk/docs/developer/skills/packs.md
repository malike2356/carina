---
sidebar_position: 1
---

# Skill packs

Packs live under `src/skills/packs/` (shipped) and `~/.carina/packs/` (installed).

**Shipped today:** 16 packs with 96 curated skills in pack manifests (plus Skills Hub and user-authored skills).

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
