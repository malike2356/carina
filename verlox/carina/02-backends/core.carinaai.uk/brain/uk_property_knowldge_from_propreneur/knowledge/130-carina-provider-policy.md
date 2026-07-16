# Carina provider policy (in-app vs Aiva)

**Last updated:** 2026-06-24

## Purpose

This document defines **when to use which AI provider** for Propreneur in-app Carina. It mirrors the policy used by standalone Carina workers at a high level; runtime details differ by engine (see below).

## Two runtimes (intentional divergence)

| Surface | Router | Provider count | Notes |
|---------|--------|----------------|-------|
| **Propreneur in-app Carina** | `AiRouterService` + `CarinaProviderRoutingService` (PHP) | Configured in `config/ai.php` + tenant BYOK | Low-latency tenant chat; `/model` per conversation |
| **External Aiva workers** | Carina Node `LLMRouter` | Up to 23 providers | Channels (Telegram, WhatsApp, etc.); fleet keys and Scout envelope |

Do not proxy every in-app turn to Node. Align **policy** (legal → Claude, cost → DeepSeek, speed → Groq); do not merge runtimes until a future unified API exists.

## Provider selection guide

### Anthropic (Claude)

**Use when:**

- Legal drafting or interpretation (Section 21/8, possession, deposit disputes)
- Compliance obligations with regulatory wording (HMO licensing, gas safety, EICR, fire risk)
- Long multi-document reasoning (deal packs, tenancy agreements, investor memos)
- High-stakes advice where caution and nuance matter

**Flag:** `carina_provider_routing_v2` (default off) auto-prefers Anthropic for legal/compliance keywords and tools when an Anthropic key is present. Users can still force another provider with `/model <name>`.

### DeepSeek

**Use when:**

- Routine deal maths explanations and calculator walkthroughs
- CRM and pipeline summaries
- High-volume chat where cost per token matters
- Default workspace priority when Claude is not required

**Strengths:** Cost-efficient, strong on structured reasoning at lower price.

### Groq

**Use when:**

- Fast replies for simple lookups and short Q&A
- Scheduled digest generation where latency to first token matters
- Low-complexity tool orchestration steps

**Strengths:** Very low latency on Llama-class models.

### OpenAI (GPT-4o family)

**Use when:**

- Balanced general chat when Anthropic is unavailable
- Vision-heavy certificate or document scans (with cert_scan config)
- Embeddings for RAG (OpenAI-style `/embeddings` is the default path)

### Google (Gemini)

**Use when:**

- Multimodal inputs (images, mixed media) on OpenAI-compat path
- Tenant has Gemini BYOK and prefers Google billing

### OpenRouter

**Use when:**

- Tenant wants a single key for multiple models
- Fallback when primary provider rate-limits

## User controls

1. **Workspace default:** Tenant AI settings (`123-tenant-ai-settings.md`) and `config('ai.priority')`.
2. **Per-conversation override:** `/model` lists allowed providers; `/model anthropic` or `/model claude`; `/model reset` restores workspace default.
3. **BYOK:** Tenant keys in `TenantAiSetting.provider_overrides` take precedence over platform registry keys for that slug.

## Web search policy

Live context uses **Tavily first**, then **Brave Search** fallback (`TavilyWebSearchService`). If both fail, Carina injects an explicit "live search unavailable" note into the system prompt and logs `web_search_unavailable` to the security audit channel. Never answer as if live search succeeded when it did not.

## Operational flags

| Flag | Default | Effect |
|------|---------|--------|
| `carina_ai` | on | In-app Carina chat |
| `carina_agent` | on | Tool-calling agent loop |
| `carina_provider_routing_v2` | off | Legal/compliance → Anthropic when key present |
| `byok_ai` | varies | Tenant-supplied API keys |

## Sync to standalone Carina

This file lives under `propreneur/propreneur-v2/brain/knowledge/` and is copied to `carina/02-backends/core.carinaai.uk/brain/knowledge/` via `carina/scripts/sync-brain-from-propreneur.sh` (prompt 02 brain sync). Edit here first; run sync before relying on Aiva workers to cite the same policy.

## Related

- `123-tenant-ai-settings.md` - workspace provider and BYOK UI
- `08-carina.md` - Carina architecture in Propreneur
- `carina/01-devends/planning/operations/CARINA_PROPRENEUR_CONVERGENCE_CHECKLIST.md` - B1, B5, B7 parity items
