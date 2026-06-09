# Action: Domain Pack System

## Goal
Generic pack registry with optional domain packs. Users enable packs via ACTIVE_SKILL_PACKS; no pack required by default.

## Status: DONE

Implementation:
- `src/skills/index.ts` - PACK_REGISTRY with all builtin packs
- `src/skills/pack-loader.ts` - manifest validation and discovery
- `src/skills/user-resources.ts` - user skill upload and knowledge ingestion
- `CARINA_RESOURCES_DIR` - user resources root (~/.carina/resources)

## Available domain packs (all optional)

| Pack | Category |
|---|---|
| property-uk | property |
| healthcare | healthcare |
| finance | finance |
| core-engineering | engineering |
| creative-basics | creative |
| productivity | productivity |
| research-basics | research |

## User extensions

```
CARINA_RESOURCES_DIR/skills/*.json     # drop skill files
CARINA_RESOURCES_DIR/knowledge/*.md    # RAG documents
CARINA_RESOURCES_DIR/packs/            # custom pack dirs
```

File paths: use `@resources/relative/path` in file-read and file-write.

## Enable packs

```
ACTIVE_SKILL_PACKS=property-uk,healthcare,finance
```
