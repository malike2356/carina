# Provider streaming compatibility matrix

This document describes how Carina providers behave for **streaming chat**, **tool streaming**, and **reasoning effort**. The live matrix is printed by:

```bash
carina providers matrix
carina providers matrix --all
carina providers info <provider> [--model MODEL_ID]
```

## Column guide

| Column | Meaning |
|--------|---------|
| stream | Text tokens stream to the client (SSE or equivalent) |
| s+tool | Tool call deltas stream alongside text when tools are enabled |
| tools | Provider adapter supports tool/function calling |
| vision | Image input supported on chat path |
| reason | Provider catalog includes reasoning-capable models |
| effort | Reasoning effort / thinking budget can be set for the active model |

Run `carina providers info anthropic --model claude-sonnet-4-6` to see model-specific effort detection.

## Transport notes

### openai-compatible

Most cloud and local OpenAI-compatible backends (OpenAI, Groq, Together, Ollama, vLLM, etc.) use Server-Sent Events with `chat.completions` deltas. Tool call fragments usually arrive as incremental JSON in `delta.tool_calls`.

### anthropic-messages

Anthropic uses the Messages API with SSE event types (`content_block_delta`, etc.). Tool input can stream in blocks. Extended thinking uses separate thinking blocks (see effort below).

### google-generative

Gemini streams generateContent chunks. When tools are enabled, tool calls may batch in the final chunk depending on model; Carina marks **s+tool** as no for Gemini in the matrix.

### external-cli / oauth / alias

External CLI providers do not expose API-grade streaming to Carina. OAuth and alias entries inherit the target provider when routed.

## Reasoning effort modes

| Mode | Providers | Control |
|------|-----------|---------|
| openai-parameter | OpenAI, Azure, OpenRouter (o-series / gpt-5) | `reasoning_effort`: low, medium, high |
| anthropic-thinking | Anthropic, Bedrock Claude | Thinking budget / extended thinking blocks |
| gemini-thinking | Gemini 2.5 thinking models | Thinking budget levels |
| native-reasoner | DeepSeek reasoner, R1-style models | Reasoning tokens in output; no separate knob |

Detection is implemented in `src/brain/provider-capability-detection.ts` and surfaced in `carina providers info`.

## Embeddings (RAG + memory)

Embeddings are **not** chat-routable. Backends:

| Provider | Env | Used for |
|----------|-----|----------|
| Gemini | `GEMINI_API_KEY` | Default when set; cheapest |
| Voyage | `VOYAGE_API_KEY` | Strong retrieval; `carina providers info voyage` |
| OpenAI | `OPENAI_API_KEY` | Fallback `text-embedding-3-small` @ 768d |

Set `CARINA_EMBEDDING_PROVIDER=voyage|gemini|openai` to force order. Check runtime chain:

```bash
carina rag status
```

Voyage is wired through `src/memory/embeddings.ts` into RAG ingest (`carina ingest`), episodic memory, session search, and persistent memory.

## Credential profiles

Provider API keys and pools are managed per operator profile:

```bash
carina credentials configure          # interactive add
carina credentials profiles           # auth + transport overview
carina credentials status
carina credentials add openai sk-...
```

Store path is shown in `carina credentials status` (`~/.carina/credentials.json` by default).
