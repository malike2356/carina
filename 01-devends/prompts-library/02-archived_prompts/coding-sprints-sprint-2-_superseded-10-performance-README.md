# Sprint 2 - Category 10: Performance


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## What Exists

- `src/brain/` - LLMRouter with 23 providers and fallback chain
- `src/memory/` - PostgreSQL + pgvector memory backend
- DeepSeek first, Claude and OpenAI as fallbacks
- Basic session indexing in PostgreSQL

## What Is Missing

- Prompt caching (cache identical or near-identical prompts to avoid redundant LLM calls)
- Auxiliary model routing (use cheaper/faster models for low-complexity tasks)
- FTS5 session search (full-text index on session transcripts for fast recall)
- Model failover with circuit breaker (stop hammering failed providers)
- User modeling (learn each user's patterns to pre-warm context and reduce latency)

## Prompts in This Category

- `01-prompt-caching.md` - SHA-256 keyed prompt cache in Redis with TTL
- `02-auxiliary-model-routing.md` - Route low-complexity tasks to Haiku/Gemini Flash
- `03-fts5-session-search.md` - PostgreSQL full-text index on sessions + memory search API
- `04-model-failover.md` - Circuit breaker pattern for provider failures with health tracking
- `05-user-modeling.md` - Per-user preference and pattern learning to reduce cold-start latency

## Original Reference

`sprint-2/gap-09-performance-parity/`
