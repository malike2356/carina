# Action: Mid-Session Provider Switching (/model command)

## Goal
Let a user switch AI providers mid-conversation with `/model <provider> [model]` (or the existing `/provider` alias) without losing conversation history, fulfilling the "Switch LLM mid-session" claim on the carinaai.uk comparison table.

## Context
- Spec file: `chat.carinaai.uk/prompts/phase2-gap-closure/01-carina-core-gaps/02-provider-switching.md`
- Project root: `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/`
- This is a partial-existing feature, not greenfield:
  - `core.carinaai.uk/src/gateway/commands.ts` (line ~42) ALREADY implements `/provider [name]` and `/provider` (list providers) via `llm.list()`. Read this block first; the new `/model` command must reuse this code path, not duplicate it.
  - `core.carinaai.uk/src/config/index.ts` defines the configured providers (`anthropic`, `openai`, `deepseek` — confirmed at lines 6, 10, 13) and `defaultProvider` (line 39). `openrouter`, `xai`, and `ollama` from the spec's capability table are NOT yet present in config — confirm with `grep -n "openrouter\|xai\|ollama" src/config/index.ts` before assuming they exist.
  - `core.carinaai.uk/src/agents/orchestrator.ts` and `src/agents/carina.ts` drive the agentic loop — these are where a per-turn provider override must be threaded through.
- The gap: `/provider` switches the *active* provider for the session but the spec additionally requires (a) preserving full conversation history across the switch, (b) per-provider capability awareness (vision/streaming/tools), (c) graceful warnings when switching to a less-capable provider mid-tool-call or mid-vision-request, and (d) the `/model` alias name used in the marketing copy.
- Conventions: TypeScript strict, no emojis, no em-dashes, every new file gets a matching `*.test.ts` (Vitest, mirroring `src/security/*.test.ts`).

## Files to create
```
core.carinaai.uk/src/agents/
  provider-capabilities.ts     — Static capability table (chat/vision/streaming/tools per provider)
  provider-capabilities.test.ts
core.carinaai.uk/src/gateway/
  model-command.ts             — /model command handler (wraps existing /provider logic + capability checks)
  model-command.test.ts
```

## Files to modify
- `core.carinaai.uk/src/gateway/commands.ts` — register `/model` as the primary command, with `/provider` kept as a backward-compatible alias (read the existing block at line ~42 first; do not write a second, parallel switching mechanism)
- `core.carinaai.uk/src/agents/orchestrator.ts` — accept a per-session provider override that takes effect on the *next* turn (not mid-tool-call); read the current loop structure before adding the override parameter
- `core.carinaai.uk/src/config/index.ts` — only if `openrouter`/`xai`/`ollama` are genuinely absent (verify first), add minimal config entries so `/model openrouter` does not error with "unknown provider"

## Step-by-step
1. Read `src/gateway/commands.ts` lines 30-75 in full — this is the existing `/provider` implementation. Note exactly how it calls `llm.list()` and switches the active provider.
2. Read `src/agents/orchestrator.ts` to find where the active provider/model is read for each turn's API call.
3. Run `grep -n "anthropic\|openai\|deepseek\|openrouter\|xai\|ollama" src/config/index.ts` to get the definitive list of configured providers. Build `provider-capabilities.ts` only for providers that actually exist in config, using the table from the spec:
   ```typescript
   export const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilities> = {
     deepseek:   { chat: true, vision: false, streaming: true, tools: true },
     openai:     { chat: true, vision: true,  streaming: true, tools: true },
     anthropic:  { chat: true, vision: true,  streaming: true, tools: true },
     // add openrouter/xai/ollama ONLY if they exist in config; otherwise omit
   };
   ```
4. Create `model-command.ts`: parses `/model`, `/model list`, `/model <provider>`, `/model <provider> <model>`. On switch:
   - Calls the same provider-switch routine that `/provider` already uses (do not reimplement it)
   - Looks up `PROVIDER_CAPABILITIES[name]`
   - If the new provider lacks `vision` and the conversation contains a recent image attachment, replies with the spec's warning: `"Note: <Provider> does not support image analysis. Vision features will be unavailable."`
   - If the API key for the requested provider is missing, replies: `"<Provider> API key not configured. Run 'carina config set providers.<provider>.api_key YOUR_KEY'"` (this message format must match what `carina config` from spec 01-cli-packaging.md expects)
   - Confirms the switch: `"Switched to <Provider>. Using <model>."`
5. In `orchestrator.ts`, add a `providerOverride?: { name: string; model?: string }` field read at the start of each turn (not mid-tool-call). If a tool call is in flight when `/model` is issued, queue the switch and apply it after the tool call resolves — implement this with a simple boolean flag checked at the top of the loop, matching the existing loop's style.
6. Wire `/model` into `commands.ts` as the primary entry, keeping `/provider` routed to the same handler for backward compatibility (existing Telegram users may already use `/provider`).
7. Update the `/help` text in `commands.ts` (see line ~64) to list `/model` alongside `/provider`.

## Expected behavior
```
> /model deepseek
Switched to DeepSeek. Using deepseek-chat.
> What's 2+2?
[response from DeepSeek]
> /model openai
Switched to OpenAI. Using gpt-4o.
> [send an image]
[vision analysis from OpenAI]
> /model deepseek
> [send an image]
Note: DeepSeek does not support image analysis. Vision features will be unavailable.
```
Conversation history from before the switch remains visible to the new provider on the next turn.

## Test
- `provider-capabilities.test.ts`: assert the capability table only contains providers present in `src/config/index.ts`, and that `chat: true` holds for every entry
- `model-command.test.ts`:
  - `/model` with no args returns the current provider/model
  - `/model list` returns the same list as the existing `/provider` (no args) command
  - `/model openai` switches and returns the confirmation string
  - `/model badname` returns an "unknown provider" message, not a crash
  - switching to a non-vision provider after an image was sent in the session returns the vision warning
  - missing API key returns the exact config-set hint string
- Run `pnpm test -- model-command provider-capabilities` and confirm all pass
- Manually verify in `pnpm carina` (CLI REPL): run through the verification transcript in the spec file

## Dependencies
- Must read and reuse the existing `/provider` implementation in `commands.ts` (do not fork it)
- `src/config/index.ts` must be read first to know the real provider list before the capability table is written
- No external package dependencies — everything is internal wiring
