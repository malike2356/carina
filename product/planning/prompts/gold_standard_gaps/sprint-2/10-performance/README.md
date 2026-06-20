# Sprint 2 - Category 10: Performance

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
