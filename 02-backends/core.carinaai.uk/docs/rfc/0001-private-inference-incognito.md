# RFC-0001: Private inference grade for Incognito

- Status: Deferred (documented for future implementation; do not build now)
- Author: Product / Ops discussion 2026-07-29
- Created: 2026-07-30
- Related: Aiva `workerConfig.privacy.incognito` (shipped 2026-07-29)

## Summary

Incognito today means Carina does not retain chat prompts and replies in durable server stores. It does not stop the active LLM host from receiving the prompt for that turn. This RFC defines a future second grade, **Private**, that routes or blocks inference so residual third-party model retention is reduced or made explicit.

## Motivation

Users reasonably hear "incognito" as "nobody keeps this." Carina storage gating alone cannot support that claim when managed DeepSeek (or any cloud LLM) still sees the text. We need a documented path so marketing, legal, and engineering stay aligned, and so a later implementation does not reinvent policy.

## Current state (do not change under this RFC)

Shipped Incognito:

- Flag: `workerConfig.privacy.incognito`
- UX: web toggle; Telegram `/incognito`, `/incognito_on`, `/incognito_off`; `/config` / `/status`
- Gates: chat history, episodic memory, activity plaintext, thread previews, external memory sync, auto-remember
- Keeps: usage counts, rate limits, in-process ephemeral multi-turn buffer
- Tools the user asks for still create side effects (email, files, CRM)

Residual risk by design: the configured LLM provider still receives prompts for live inference.

Key code today:

- `src/workers/incognito.ts`
- `src/memory/aiva/incognito-buffer.ts`
- `src/channels/slash-commands/config-commands.ts` (incognito commands)
- App: `IncognitoPreferenceToggle.tsx`

## Proposed future product grades

| Grade | Meaning | Inference |
|-------|---------|-----------|
| Normal | Chats may be saved per product defaults | Managed or BYOK as configured |
| Incognito (server) | Carina does not store chat bodies | Current behaviour; managed LLM still allowed |
| Private (local / BYOK) | Incognito plus private inference path | Local model and/or user BYOK with verified retention policy only |

Honest long-term promise:

> Carina does not retain the chat. Private mode also avoids third-party model retention when a private route is configured.

## Design (future)

### 1. Config

Extend privacy config, for example:

```ts
privacy?: {
  incognito?: boolean;
  /** Future: require private inference while incognito is on */
  privateInference?: 'off' | 'prefer' | 'require';
  /** Future: allowlist of provider names for private mode */
  privateProviders?: string[];
};
```

Do not invent new Stripe prices or keys as part of this work unless the owner explicitly asks.

### 2. Routing policy when Private is on

Priority order for a turn:

1. Local / self-hosted inference if available (Ollama, vLLM, LM Studio, private GPU)
2. Else user BYOK with providers that declare zero-retention / no-training (and are allowlisted)
3. Else if `privateInference === 'require'`: refuse the turn with a clear message (do not fall back to managed platform tokens)
4. Else if `prefer`: warn and optionally allow managed with explicit user confirm

### 3. UX

- Rename or subtitle Incognito in UI: "Not saved on Carina"
- Add Private as a separate control or as a sub-option under Incognito
- Banner must name the inference destination when a turn runs
- Telegram: e.g. `/private on|off` or `/incognito private` (exact commands TBD at implementation time)
- Copy must never claim absolute privacy while a third-party LLM is used

### 4. Hardening checklist (implementation time)

- Block managed wallet / platform DeepSeek (or current default) for Private-required turns
- Prefer BYOK vault keys for that worker when Private is on
- Skip attestation digests that would reintroduce plaintext (already metadata-oriented for Incognito)
- Document residual risks that remain: device/network leak, tool side effects, billing counters
- Update privacy policy / in-product help to match the two grades
- Tests: refuse managed path when require; allow local/BYOK; banner and slash status

### 5. Phased delivery (suggested later)

1. Product copy: clarify Incognito = Carina non-retention only
2. `privateInference: require` + refuse managed when no BYOK/local
3. Local provider auto-prefer when healthy
4. Optional confidential-compute / enterprise path (out of scope for core OSS unless demanded)

## Drawbacks

- More config surface and support burden
- Users without BYOK or local models cannot use "true private" chat
- Provider retention policies change; allowlists need maintenance
- Local models may lower quality vs managed frontier models

## Alternatives

- Keep Incognito as storage-only forever and never add Private: simplest, but weak for privacy marketing
- Client-only local chat with no server LLM hop: strong privacy, poor fit for Telegram/Aiva multi-channel today
- Encrypt prompts to Carina only: does not help against the LLM host that must decrypt to run the model

## Out of scope for now

- No implementation in this RFC
- No change to shipped Incognito behaviour
- No new Stripe products
- No legal sign-off text finalisation (legal should review copy before Private ships)

## Acceptance criteria (when this is picked up)

- [ ] Two grades documented in user-facing help
- [ ] Private-required turns never use managed platform tokens
- [ ] Local and/or BYOK path works end-to-end for Aiva Telegram + web chat
- [ ] Tests cover refuse / prefer / require
- [ ] Privacy policy and UI banners match engineering behaviour
