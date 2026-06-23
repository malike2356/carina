# Phase 1 - Memory + Skills

**Status: COMPLETE**

All deliverables built by Cursor. Do not rebuild.

## What Was Built

- `src/memory/db.ts` - pg Pool with pgvector type registration
- `src/memory/migrations.ts` - idempotent schema: `episodic_memories`, `skill_documents`, `rag_chunks`, `inbound_emails`
- `src/memory/store.ts` - `saveMemory`, `searchMemory` (vector), `getSessionHistory`, `searchRag`, `insertRagChunk`, `deleteMemory`, `listRecentMemories`
- `src/memory/embeddings.ts` - `embed()` via OpenAI `text-embedding-3-small` (1536d), fails gracefully when key missing
- `src/memory/redis.ts` - ioredis client, `initRedis()`, `getRedis()`, fails gracefully
- `src/skills/store.ts` - `saveSkill`, `findRelevantSkills`, `incrementSkillUsage`, `findSkillByKeywordOverlap` (Jaccard), `listSkills`
- `src/skills/writer.ts` - post-turn skill evaluation (heuristic trigger: tool use or multi-step)
- `src/skills/auto-writer.ts` - `evaluateAndWriteSkill()` with LLM meta-prompt and Jaccard deduplication
- `src/skills/ingestion.ts` - walks `archive/property-saas-spec/docs/` and `architecture/`, chunks and embeds `.md` files, skips already-ingested sources
- `src/skills/packs/property-uk/skills.ts` - 6 pre-built skills: brr-analysis, hmo-compliance-check, yield-calculator, deal-sourcing-workflow, area-scoring, bridging-finance-explainer
- `src/skills/packs/property-uk/prompts/system.ts` - system prompt suffix for the property pack

## Run Commands

```bash
pnpm ingest          # ingest property-uk pack from archive/property-saas-spec/
pnpm cli             # CLI shows "Memory: PostgreSQL + pgvector active" when DB connected
```
