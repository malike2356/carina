# AI Providers and Model Routing

## Overview

Carina is multi-model by design. It does not depend on any single AI provider. The provider
registry (`src/brain/provider-registry.ts`) manages all configured providers, their capabilities,
costs, and availability. The model router selects the best provider for each request based on
capability requirements, cost targets, and current availability.

## Configured Providers

From the provider registry, the confirmed named providers are:

| Provider | Type | Capabilities |
|---|---|---|
| `anthropic` | Cloud | Chat, vision, streaming, tools, large context |
| `gemini` | Cloud | Chat, vision, streaming, tools, embeddings |
| `voyage` | Cloud | Embeddings only (no chat, no vision) |
| `openai` | Cloud | Chat, vision, streaming, tools, embeddings |
| `deepseek` | Cloud | Chat, streaming, tools (cost-effective) |
| `groq` | Cloud | Chat, streaming, fast inference |
| `mistral` | Cloud | Chat, streaming, tools |
| `ollama` | Local | Chat, streaming (any model pulled locally) |
| `lm-studio` | Local | Chat, streaming (local OpenAI-compatible API) |
| `perplexity` | Cloud | Chat with built-in web search |
| `cohere` | Cloud | Chat, embeddings |
| `grok` | Cloud | xAI Grok models |
| `together` | Cloud | Open-source model hosting |
| `fireworks` | Cloud | Fast inference for open models |
| `replicate` | Cloud | ML model hosting and inference |
| `huggingface` | Cloud | Open-source model API |

The full count is 30+ providers based on the COMPARISON.md verified metric. The registry
supports dynamic provider registration, so new providers can be added without code changes
by adding to the provider definitions list.

## Provider Capabilities

Each provider definition includes:
```typescript
capabilities: {
  chat: boolean,         // Can handle multi-turn conversations
  vision: boolean,       // Can process images
  streaming: boolean,    // Supports streaming responses
  tools: boolean,        // Supports function/tool calling
  embeddings: boolean    // Can generate embedding vectors
}
usdPerToken: number      // Cost per token (used for cost-aware routing)
```

## Model Selection

The brain module (`src/brain/`) handles model selection. The selection process:

1. **Capability filter:** Eliminate providers that lack required capabilities for the current
   request (e.g., a request that includes an image requires `vision: true`)

2. **Cost-aware routing:** For requests that do not require specific capabilities, prefer lower
   cost providers. The `usdPerToken` field on each provider enables this comparison.

3. **Availability check:** Disabled providers (via `disableProvider()`) are excluded.
   `isProviderDisabled(name)` checks runtime state.

4. **Fallback chain:** If the primary provider fails (API error, rate limit), the router
   falls through to the next available provider in capability-matched order.

5. **Provider override:** The operator or user can specify a provider directly. The model
   selection still validates that the specified provider has the required capabilities.

## Local Model Support (Ollama and LM Studio)

Carina supports running AI models entirely locally via Ollama or LM Studio. This enables:
- Offline operation (no internet required for inference)
- Cost reduction (no per-token charges for routine queries)
- Data privacy (no user data sent to third-party cloud APIs)
- Experimentation with open-source models (Llama, Mistral, Qwen, Gemma, etc.)

Local providers are configured by setting `OLLAMA_BASE_URL` (default `http://localhost:11434`)
or `LM_STUDIO_BASE_URL`. The provider base URL function (`providerBaseUrl()`) handles this.

## Embedding Provider Chain

For RAG embeddings specifically, the chain is:

```
CARINA_EMBEDDING_PROVIDER env override (if set)
  -> Gemini text-embedding-004 (if GOOGLE_API_KEY configured)
  -> Voyage AI voyage-3 (if VOYAGE_API_KEY configured)
  -> OpenAI text-embedding-3-small (if OPENAI_API_KEY configured)
  -> No embeddings (RAG disabled)
```

The embedding provider must be consistent: if you ingest chunks with Gemini embeddings, you
must query with Gemini embeddings. Switching providers after ingestion invalidates existing
chunks (they must be re-ingested).

## Cost Tracking

The provider registry tracks costs per request via `usdPerToken`. The usage reporting system
(`src/usage/`) aggregates this into per-workspace, per-day cost summaries visible in:
- The operator TUI (terminal UI)
- The `app.carinaai.uk` usage dashboard
- The `admin.carinaai.uk` platform analytics

The platform event emitter (`src/billing/platform-event-emitter.ts`) records `tokens_in` and
`tokens_out` on every `platform_events` row, enabling per-partner cost attribution for the
tollbooth billing model.

## OpenAI-Compatible API

Carina exposes an OpenAI-compatible chat completions API at `src/api/openai-compatible/`. This
means any client that supports the OpenAI API (LangChain, OpenAI SDK, most AI frameworks) can
point at Carina and use it as a drop-in replacement. Carina then handles provider routing,
memory, tool execution, and Scout governance transparently.

This is significant for the partner API: a partner can integrate Carina using the OpenAI SDK
they already have without changing their integration code.

## Provider Registry Functions

| Function | Purpose |
|---|---|
| `disableProvider(name)` | Disable a provider at runtime (e.g., due to API outage) |
| `enableProvider(name)` | Re-enable a disabled provider |
| `isProviderDisabled(name)` | Check if a provider is currently disabled |
| `resolveAliasTarget(name)` | Resolve a provider alias to its canonical name |
| `providerBaseUrl(def)` | Get the base URL for a provider (handles local provider override) |
| `isEmbeddingProviderConfigured(id)` | Check if an embedding provider has valid credentials |
| `embeddingProviderStatus()` | Get full status of the embedding provider chain |
