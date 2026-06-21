# Hardcoded Parametrics; Audit & Correction Plan

**Date:** 16 June 2026
**Principle:** Nothing that could change at runtime should be hardcoded. Everything must pull from env vars or config.

---

## Category 1; Model/Provider Names (highest impact)

| File | Line | Hardcoded | Fix |
|------|------|-----------|-----|
| `src/config/index.ts` | 17 | `'claude-sonnet-4-6'` | Already fallback for `ANTHROPIC_MODEL`; OK |
| `src/config/index.ts` | 21 | `'gpt-4o'` | Already fallback for `OPENAI_MODEL`; OK |
| `src/config/index.ts` | 25 | `'deepseek-chat'` | Already fallback for `DEEPSEEK_MODEL`; OK |
| `src/config/index.ts` | 29 | `'gemini-2.0-flash'` | Already fallback for `GEMINI_MODEL`; OK |
| `src/config/index.ts` | 33 | `'llama-3.3-70b-versatile'` | Already fallback for `GROQ_MODEL`; OK |
| `src/config/index.ts` | 124 | `'deepseek'` as default provider | Already `DEFAULT_PROVIDER` env; OK |
| `src/brain/llm.ts` | 335,337 | `'deepseek'` as ultimate fallback when no provider configured | **RISK**; if someone deletes their DeepSeek key, this hardcodes the fallback name |
| `src/config/index.ts` | 231 | `'deepseek/deepseek-chat'` as Labyrinth judge model | Already `LABYRINTH_JUDGE_MODEL`; OK |
| `src/brain/provider-registry.ts` | 219 | `'deepseek-chat'` default model for DeepSeek | Already `DEEPSEEK_MODEL`; OK |
| `src/brain/provider-registry.ts` | 222 | `'llama-3.3-70b-versatile'` default for Groq | Already `GROQ_MODEL`; OK |
| `src/brain/provider-registry.ts` | 230 | `'gemini-2.0-flash'` default for Gemini | Already `GEMINI_MODEL`; OK |
| `src/brain/provider-registry.ts` | 243 | `'claude-sonnet-4-6'` default for Anthropic | Already `ANTHROPIC_MODEL`; OK |
| `src/brain/provider-registry.ts` | 249 | `'gpt-4o'` default for OpenAI | Already `OPENAI_MODEL`; OK |
| `src/brain/provider-registry.ts` | 252 | `'anthropic/claude-sonnet-4'` default for OpenRouter | Already `OPENROUTER_MODEL`; OK |
| `src/brain/provider-registry.ts` | 255-277 | 20 more default models for Together, Mistral, Cohere, Perplexity, Fireworks, xAI, Moonshot, Qwen, Zhipu, Cerebras, DeepInfra, Novita, SiliconFlow, NVIDIA, HuggingFace, MiniMax, etc. | Each has `*_MODEL` env override; OK |
| `src/memory/embeddings.ts` | 82 | `'text-embedding-004'` (Gemini) | **HARDCODED**; no env override. Add `GEMINI_EMBEDDING_MODEL` |
| `src/memory/embeddings.ts` | 93 | `'text-embedding-3-small'` (OpenAI) | **HARDCODED**; no env override. Add `OPENAI_EMBEDDING_MODEL` |
| `src/memory/embeddings.ts` | 8 | `DIMENSIONS = 768` | **HARDCODED**; should be configurable per provider. Add `CARINA_EMBEDDING_DIMENSIONS` |

**Verdict:** Provider model names are already env-overridable. **Embedding model names and dimensions are hardcoded.**

---

## Category 2; API URLs (medium impact)

| File | Line | Hardcoded | Fix |
|------|------|-----------|-----|
| `src/brain/provider-registry.ts` | 219 | `'https://api.deepseek.com/v1'` | Already `DEEPSEEK_BASE_URL` |
| `src/brain/provider-registry.ts` | 222 | `'https://api.groq.com/openai/v1'` | Already `GROQ_BASE_URL` |
| `src/brain/provider-registry.ts` | 249 | `'https://api.openai.com/v1'` | Already `OPENAI_BASE_URL` |
| `src/brain/provider-registry.ts` | 252-258 | 6 more provider URLs (OpenRouter, Together, Mistral, Cohere, Perplexity, Fireworks) | All have `*_BASE_URL` overrides; OK |
| `src/brain/provider-registry.ts` | 259-376 | 20 more provider URLs | All have `*_BASE_URL` overrides; OK |
| `src/tools/trello.ts` | 4 | `'https://api.trello.com/1'` | **HARDCODED**; Trello API base. Add `TRELLO_BASE_URL` |
| `src/tools/trello.ts` | 86 | `'https://trello.com/app-key'` (in error message) | Acceptable; it's user-facing text, not an API call |
| `src/tools/web-search-provider.ts` | 84 | `'https://api.search.brave.com/res/v1/web/search'` | **HARDCODED**; Brave search URL. Add `BRAVE_SEARCH_URL` |
| `src/tools/web-search-provider.ts` | 115 | `'https://api.tavily.com/search'` | **HARDCODED**; Tavily URL. Add `TAVILY_SEARCH_URL` |
| `src/memory/embeddings.ts` | 103 | `'https://api.voyageai.com/v1/embeddings'` | **HARDCODED**; Voyage embeddings URL. Provider registry has `VOYAGE_BASE_URL` but embeddings.ts doesn't use it. |
| `src/config/index.ts` | 86 | `'smtp.resend.com'` | Already `SMTP_HOST`; OK |
| `src/config/index.ts` | 90 | `'hello@carinaai.uk'` | Already `SMTP_FROM`; OK |
| `src/config/index.ts` | 104 | `'https://api.propertydata.co.uk'` | Already `LAND_REGISTRY_BASE_URL`; confusing naming but OK |
| `src/config/index.ts` | 190 | `'app.carinaai.uk'` | Already `CARINA_HOSTED_APP_HOST`; OK |
| `src/config/index.ts` | 191 | `'core.carinaai.uk,localhost'` | Already `CARINA_OPERATOR_HOSTS`; OK |
| `src/config/index.ts` | 212 | `'https://hub.carinaai.uk'` | Already `SKILLS_HUB_URL`; OK |
| `src/config/index.ts` | 226 | `'http://localhost:4444'` (Scout URL) | Already `LABYRINTH_URL`; OK |
| `src/config/index.ts` | 230 | `'http://localhost:3000'` (LLM router URL) | Already `LABYRINTH_LLM_ROUTER_URL`; OK |
| `src/config/index.ts` | 235 | `'https://ntfy.sh'` | Already `NTFY_BASE_URL`; OK |
| `src/config/index.ts` | 305 | `'https://prod-nginz-https.wire.com'` | Already `WIRE_API_BASE`; OK |

**Verdict:** Provider URLs are OK. **Trello API base, Brave search URL, Tavily search URL, and Voyage embeddings URL are hardcoded.**

---

## Category 3; Numeric Thresholds (high impact)

| File | Line | Hardcoded | Fix |
|------|------|-----------|-----|
| `src/config/index.ts` | 131 | `sessionTimeout: 60 * 60 * 1000` (1 hour) | **HARDCODED**; Add `CARINA_SESSION_TIMEOUT_MS` |
| `src/config/index.ts` | 132 | `maxMemoryContext: 20` | **HARDCODED**; Add `CARINA_MAX_MEMORY_CONTEXT` |
| `src/config/index.ts` | 203 | `freeDailyMessages: 100` | Already `CARINA_CLOUD_FREE_DAILY_MESSAGES`; OK |
| `src/config/index.ts` | 220-222 | Hub revenue shares: 7000, 2000, 1000 bps | Already `HUB_PACK_*_BPS` env vars; OK |
| `src/config/index.ts` | 232 | `judgeTimeoutMs: 3000` (3 sec) | **HARDCODED**; Add `LABYRINTH_JUDGE_TIMEOUT_MS` |
| `src/agents/carina.ts` | 83,106 | `maxTurns = 20` (per conversation) | **HARDCODED**; Add `CARINA_MAX_TURNS` |
| `src/agents/sub-agent.ts` | 14 | `maxTurns = 10` | **HARDCODED**; Add `CARINA_SUBAGENT_MAX_TURNS` |
| `src/agents/generic-sub-agent.ts` | 30 | `maxTurns = 10` | Same as above |
| `src/agents/cron-step-runner.ts` | 99 | `maxTurns: 10` | Same as above |
| `src/ops/taskflows/engine.ts` | 140 | `maxTurns: 8` | **HARDCODED**; Add `CARINA_TASKFLOW_MAX_TURNS` |
| `src/memory/embeddings.ts` | 84 | `text.slice(0, 8000)` (Gemini input truncation) | **HARDCODED**; Add `CARINA_EMBEDDING_MAX_CHARS` |
| `src/memory/embeddings.ts` | 94 | `text.slice(0, 8000)` (OpenAI input truncation) | Same as above |
| `src/memory/embeddings.ts` | 111 | `text.slice(0, 16000)` (Voyage input truncation) | Same as above |
| `src/brain/request-timeout.ts` | 1 | `90000` (90 sec LLM timeout) | Already `CARINA_LLM_REQUEST_TIMEOUT_MS`; OK |

**Verdict:** 8 hardcoded numeric thresholds. Most impact: session timeout and max turns.

---

## Category 4; Default Strings (medium impact)

| File | Line | Hardcoded | Fix |
|------|------|-----------|-----|
| `src/config/index.ts` | 142 | `'edge'` as default TTS provider | Already `TTS_PROVIDER`; OK |
| `src/config/index.ts` | 143 | `'en-GB-SoniaNeural'` as TTS voice | Already `TTS_VOICE`; OK |
| `src/config/index.ts` | 114 | `'Carina AI'` as IRC realname | Already `IRC_REALNAME`; OK |
| `src/config/index.ts` | 186 | `'change-me-in-production'` as JWT secret | Already `JWT_SECRET`; OK (this is intentionally weak default) |
| `src/config/index.ts` | 228 | `'carina-local'` as Scout instance ID | Already `LABYRINTH_INSTANCE_ID`; OK |
| `src/config/index.ts` | 229 | `'Carina Local'` as Scout instance name | Already `LABYRINTH_INSTANCE_NAME`; OK |

**Verdict:** Default strings are already env-overridable. Clean.

---

## Category 5; Port Numbers (low impact, sensible defaults)

| File | Line | Hardcoded | Fix |
|------|------|-----------|-----|
| `src/brain/provider-registry.ts` | 279 | `'http://127.0.0.1:11434/v1'` (Ollama) | Already `OLLAMA_BASE_URL`; OK |
| `src/brain/provider-registry.ts` | 284 | `'http://127.0.0.1:1234/v1'` (LM Studio) | Already `LMSTUDIO_BASE_URL`; OK |
| `src/brain/provider-registry.ts` | 289 | `'http://127.0.0.1:8000/v1'` (vLLM) | Already `VLLM_BASE_URL`; OK |
| `src/brain/provider-registry.ts` | 324 | `'http://127.0.0.1:8080/v1'` (llama.cpp) | Already `LLAMACPP_BASE_URL`; OK |
| `src/brain/provider-registry.ts` | 335 | `'http://127.0.0.1:4000/v1'` (LiteLLM) | Already `LITELLM_BASE_URL`; OK |
| `src/brain/provider-registry.ts` | 341 | `'http://127.0.0.1:30000/v1'` (SGLang) | Already `SGLANG_BASE_URL`; OK |

**Verdict:** All local provider ports are base URL fallbacks. Overridable via env. Clean.

---

## Category 6; LLM Router Fallback (HIGH RISK; **MUST FIX**)

| File | Line | Hardcoded | Fix |
|------|------|-----------|-----|
| `src/brain/llm.ts` | 335 | `?? 'deepseek'` when no provider in map | **HARDCODED**; if all providers removed, falls back to 'deepseek' string |
| `src/brain/llm.ts` | 337 | `?? 'deepseek'` when preferred provider not in map | Same as above |
| `src/config/index.ts` | 124 | `defaultProvider: (process.env.DEFAULT_PROVIDER ?? 'deepseek')` | **HARDCODED**; the config-level fallback is also 'deepseek' |

**Decision (16 June 2026):** No provider name shall be hardcoded as the default anywhere. The default is whatever is configured in settings (env). If no paid provider is configured, the ultimate fallback is **free GitHub Copilot** so Carina is never dead.

**Fallback chain (in priority order):**
1. `DEFAULT_PROVIDER` env var → use it
2. First configured paid provider with a valid API key → use it
3. GitHub Copilot free tier (auto-detected from `gh auth token`) → use it
4. If none of the above → log a clear error, refuse to chat

**Fix for llm.ts:**
- Line 335: Replace `?? 'deepseek'` with: check FREE_COPILOT_PRESET availability, then first configured provider, then error.
- Line 337: Same; if the preferred provider isn't in the map, auto-activate Copilot free before erroring.

**Fix for config/index.ts:**
- Line 124: Remove `'deepseek'` fallback. If `DEFAULT_PROVIDER` is not set, leave empty. LLM router resolves at runtime using the chain above. The type cast `as 'anthropic' | 'openai' | 'deepseek'` should not restrict to three providers.

```typescript
// Was:
defaultProvider: (process.env.DEFAULT_PROVIDER ?? 'deepseek') as 'anthropic' | 'openai' | 'deepseek',

// Should be:
defaultProvider: process.env.DEFAULT_PROVIDER ?? '',  // resolved at runtime by LLM router
```

---

## Summary; What Needs Fixing

###  Must fix (runtime values that can change)

| Item | Current | Should be |
|------|---------|------------|
| `sessionTimeout` | Hardcoded `3600000` (1hr) | `CARINA_SESSION_TIMEOUT_MS` env |
| `maxMemoryContext` | Hardcoded `20` | `CARINA_MAX_MEMORY_CONTEXT` env |
| `maxTurns` (Carina agent) | Hardcoded `20` | `CARINA_MAX_TURNS` env |
| `maxTurns` (subagent) | Hardcoded `10` | `CARINA_SUBAGENT_MAX_TURNS` env |
| `maxTurns` (taskflow) | Hardcoded `8` | `CARINA_TASKFLOW_MAX_TURNS` env |
| `judgeTimeoutMs` | Hardcoded `3000` | `LABYRINTH_JUDGE_TIMEOUT_MS` env |
| Gemini embedding model | Hardcoded `'text-embedding-004'` | `GEMINI_EMBEDDING_MODEL` env |
| OpenAI embedding model | Hardcoded `'text-embedding-3-small'` | `OPENAI_EMBEDDING_MODEL` env |
| Embedding dimensions | Hardcoded `768` | `CARINA_EMBEDDING_DIMENSIONS` env |
| Embedding truncation lengths | Hardcoded `8000` / `16000` | `CARINA_EMBEDDING_MAX_CHARS` env |
| LLM ultimate fallback | Hardcoded `'deepseek'` string | Use dynamic first-configured provider |

###  Should fix (API endpoints that could change)

| Item | Current | Should be |
|------|---------|------------|
| Trello API base | Hardcoded `https://api.trello.com/1` | `TRELLO_BASE_URL` env |
| Brave search URL | Hardcoded `https://api.search.brave.com/...` | `BRAVE_SEARCH_URL` env |
| Tavily search URL | Hardcoded `https://api.tavily.com/search` | `TAVILY_SEARCH_URL` env |
| Voyage embeddings URL | Hardcoded in `embeddings.ts` (not using `VOYAGE_BASE_URL` from registry) | Use `VOYAGE_BASE_URL` or `providerBaseUrl(PROVIDER_MAP.voyage)` |

###  Already clean

- All model names (env-overridable per provider)
- All service ports (base URL env vars)
- All provider API URLs (base URL env vars)
- All default strings (env vars)
- TTS provider/voice (env vars)
- LLM request timeout (env var)

---

## Total: 14 hardcoded values to fix

9 numeric/threshold values, 2 embedding model names, 1 embedding constant, 3 API URLs, 1 LLM fallback behavior.
