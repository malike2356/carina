**Status: COMPLETED 2026-06-21**


# Gap 30 - Prompt 01: Model Provider Configuration Docs

**Gap:** 30 Documentation: Model Providers, Sandbox & Security
**Prompt number:** 01 of 02
**Name:** Write model-providers.md
**Primary agent:** Claude Code (docs writing)
**Estimated hours:** 2 h
**Depends on:** Nothing

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read first

1. `internal/servers/core.carinaai.uk/src/providers/` -- provider registry
2. `internal/servers/core.carinaai.uk/src/config/schema.ts` -- provider config keys
3. `internal/servers/core.carinaai.uk/.env.example` -- environment config

---

## Goal

Write `docs/user/configuration/model-providers.md`.

```markdown
# Model Providers

## Overview
Carina routes every LLM call through a provider. Providers handle
API keys, request formatting, streaming, and error handling. You
can use built-in providers or connect any OpenAI-compatible endpoint.

## Built-in Providers

| Provider | Setup | Key Models |
|----------|-------|-----------|
| Anthropic | `CARINA_ANTHROPIC_API_KEY` | Claude Opus 4, Sonnet 4 |
| OpenAI | `CARINA_OPENAI_API_KEY` | GPT-5.5, GPT-5.4 Mini |
| Google Gemini | `CARINA_GEMINI_API_KEY` | Gemini 3.1 Pro, Flash |
| Ollama (local) | None | Llama 3.3, Mistral |
| vLLM (local) | `CARINA_VLLM_ENDPOINT` | Any served model |
| OpenRouter | `CARINA_OPENROUTER_API_KEY` | Multi-provider routing |
| Together | `CARINA_TOGETHER_API_KEY` | Llama, Mixtral |

## Adding a Provider

```bash
# Interactive setup
carina provider add

# Direct config
carina provider add openai --key "sk-..."

# From environment
export CARINA_ANTHROPIC_API_KEY="sk-ant-..."
carina provider list
```

## Setting the Default Model

```bash
# Set the primary model
carina models set anthropic/claude-sonnet-4-6

# Set fallback models
carina models add-fallback openai/gpt-5.5

# List models
carina models list

# Test a model
carina models test anthropic/claude-sonnet-4-6
```

## Custom Providers

Connect any OpenAI-compatible endpoint:

```bash
carina provider add custom \
  --name "my-llm" \
  --base-url "https://my-llm-server/v1" \
  --api-key "my-key" \
  --models "my-model-v1,my-model-v2"
```

This works with:
- Self-hosted vLLM / llama.cpp / Ollama servers
- NVIDIA NIM endpoints
- Any OpenAI-compatible API

## API Key Rotation

For production, configure key rotation to avoid single-key failures:

```bash
# Primary key (always tried first)
carina provider config openai --key "sk-primary-..."

# Rotation keys (tried in order if primary fails)
carina provider config openai --rotation-keys "sk-rot1-...,sk-rot2-..."

# Rotation triggers:
# - 401/403 responses
# - Rate limit (429) with retry-after > 30s
# - Connection timeout > 10s
```

## Model-Specific Configuration

Override parameters per model:

```bash
carina models config anthropic/claude-opus-4-6 \
  --thinking high \
  --max-tokens 4096 \
  --temperature 0.7

carina models config openai/gpt-5.5 \
  --thinking medium \
  --max-tokens 8192
```

## Provider Health

Check provider connectivity:

```bash
carina provider test openai
# Latency: 234ms, Status: ok, Models: 12

carina provider test --all
# Shows all providers with latency and status
```

## Environment Variables Reference

| Variable | Provider | Required |
|----------|----------|----------|
| `CARINA_ANTHROPIC_API_KEY` | Anthropic | yes |
| `CARINA_OPENAI_API_KEY` | OpenAI | yes |
| `CARINA_GEMINI_API_KEY` | Google Gemini | yes |
| `CARINA_OPENROUTER_API_KEY` | OpenRouter | yes |
| `CARINA_TOGETHER_API_KEY` | Together | yes |
| `CARINA_VLLM_ENDPOINT` | vLLM | yes |
| `CARINA_OLLAMA_HOST` | Ollama | no (default localhost:11434) |
| `CARINA_PROVIDER_TIMEOUT` | All | no (default 120s) |
| `CARINA_PROVIDER_MAX_RETRIES` | All | no (default 3) |

## Where to find it in source
- `providers/` -- provider implementations
- `config/schema.ts` -- configuration schema
- `.env.example` -- environment template
```

---

## Sidebar update

Add `'user/configuration/model-providers'` under "Getting started" > "Configuration".

---

## Existing Carina files to reference

- `internal/servers/core.carinaai.uk/src/providers/`
- `internal/servers/core.carinaai.uk/src/config/schema.ts`
- `internal/servers/core.carinaai.uk/.env.example`
