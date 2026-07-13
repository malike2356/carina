---
id: 2026-07-13_carina_aiva_cost_workspace_comms_03_token_efficiency
title: Token efficiency, cache, compression, and context budget controls
product: core-carina
capability: token-efficiency
status: completed
source: agent-chat
source_chat: 01-devends/prompts-library/source-chats/2026-07-13_carina-aiva-cost-workspace-comms.md
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-aiva-cost-workspace-comms--03-token-efficiency-cache-and-compression.md
repo_paths:
  - 02-backends/core.carinaai.uk/src
  - 02-backends/core.carinaai.uk/tests
depends_on:
  - 2026-07-13_carina_aiva_cost_workspace_comms_01_research_architecture
  - 2026-07-13_carina_aiva_cost_workspace_comms_02_policy_router
tags:
  - token-efficiency
  - cache
  - compression
validation:
  - cd 02-backends/core.carinaai.uk && pnpm check && pnpm test
---

# Token Efficiency, Cache, Compression, and Context Budget Controls

## What This Builds

A practical token reduction layer inspired by LiteLLM caching, GPTCache semantic cache, and LLMLingua-style compression.

## Target Files

- `02-backends/core.carinaai.uk/src/token-efficiency/`
- `02-backends/core.carinaai.uk/src/memory/`
- `02-backends/core.carinaai.uk/src/model-router/`
- `02-backends/core.carinaai.uk/src/skills/`
- Relevant tests beside changed code.

## Implementation Prompt

Build a token efficiency layer with the following controls:

1. Token estimation before provider calls.
2. Context budget planner per model tier.
3. Conversation summarisation and memory compaction.
4. Tool result truncation with retained evidence links.
5. RAG passage budget and deduplication.
6. Response cache for exact safe requests.
7. Semantic cache for safe repeated questions where workspace policy allows reuse.
8. Prompt compression for long context, enabled only when expected savings exceed overhead.
9. Provider prompt caching support where available.
10. Output length controls based on requested task.

Do not cache:

- Private messages across tenants.
- BYOK provider responses outside the tenant boundary.
- High-risk or user-specific legal, medical, security, or financial answers unless explicitly safe.
- Prompts containing secrets or credentials.

Implement a decision record for every optimization:

- `none`
- `exact_cache_hit`
- `semantic_cache_hit`
- `context_compacted`
- `prompt_compressed`
- `tool_result_trimmed`
- `provider_prompt_cache_requested`

Every model call should report:

- raw estimated input tokens
- optimized estimated input tokens
- output token cap
- savings estimate
- optimization reason

## Acceptance Criteria

- Token savings are measured, not guessed.
- Tests cover exact cache hit, semantic cache reject, tenant isolation, context compaction, tool trimming, and compression threshold.
- User output remains complete enough to be useful.
- The system preserves citations, tool evidence, and approval context.

## Validation

```bash
cd 02-backends/core.carinaai.uk
pnpm check
pnpm test
rg -n "semantic_cache|prompt_compressed|context_compacted|token-efficiency" src tests
```

## Post-build

Archive this prompt only after cache safety tests and token savings tests pass.
