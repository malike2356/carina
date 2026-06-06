# Skill Packs

Skill packs bundle domain knowledge (RAG corpus), pre-built skills (structured playbooks), optional tools, and a system prompt suffix.

## What a pack contains

| Component | Location | Purpose |
|---|---|---|
| `pack.json` | Pack root | Metadata, version, triggers |
| Skills | `skills.ts` or `skills/` | Named procedures Carina can invoke |
| Knowledge | `knowledge/` or `brain/` corpus | Markdown ingested into pgvector |
| Tools | `tools/` | Optional MCP tools (e.g. PropertyData) |
| System suffix | `prompts/system.ts` | Extra instructions appended to the agent prompt |

## Active pack

Set `ACTIVE_SKILL_PACK=property-uk` (default). On first wizard run, Carina can install the pack into `~/.carina/packs/`.

## Skills Hub

Published packs are listed at [skills.carinaai.uk](https://skills.carinaai.uk/packs). Self-host the hub with `pnpm hub` and `SKILLS_HUB_*` env vars.

## Auto-written skills

When `SKILL_AUTO_WRITE` is not `false`, Carina evaluates completed tasks and may save new skills to Postgres with Jaccard deduplication (80% overlap threshold). List them with `/skills` in the CLI.

## Learn more

- [property-uk](/skill-packs/property-uk) - built-in UK property pack
- [Creating packs](/skill-packs/creating-packs) - author and publish your own
