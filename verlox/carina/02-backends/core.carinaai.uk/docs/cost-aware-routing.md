# Cost-Aware Routing for Carina and Aiva

Updated: 2026-07-13

This document defines the cost, model-routing, token-efficiency, usage-ledger, workspace, and WhatsApp Web pairing architecture for Carina and Aiva.

## Goals

- Keep the first 20 free hosted messages useful without allowing free usage to become a business loss.
- Enforce BYOK, mini or local model fallback, or subscription upgrade after the free allowance is exhausted.
- Route action-heavy work to OpenAI-class models, deep reasoning and long persistent work to Claude-class models, and low-risk routine work to mini or local models.
- Record every hosted model request in a first-party usage ledger before building dashboards or billing decisions on it.
- Reduce token burn with deterministic caching, semantic caching, context trimming, prompt compression, and response reuse where quality risk is acceptable.
- Make Aiva feel like an agentic OS workspace: employees, tasks, approvals, channels, results, handoffs, and completed work must be visible without forcing users to switch to external channels.
- Offer WhatsApp Web pairing for low-friction onboarding while keeping the official WhatsApp Business API as the stable production option.

## Sources Reviewed

| Source | What to adopt | What not to adopt | License and maintenance risk | Security risk | Product fit |
|---|---|---|---|---|---|
| LiteLLM spend tracking, budgets, and provider budget routing: `https://docs.litellm.ai/docs/proxy/cost_tracking`, `https://docs.litellm.ai/docs/proxy/users`, `https://docs.litellm.ai/docs/proxy/provider_budget_routing` | Per-user, per-team, per-key spend logs; budget windows; provider budget routing; model cost maps; dashboard fields for tokens, model, provider, feature tags, and request IDs. | Do not delegate Carina billing authority to a separate LiteLLM proxy. Carina needs first-party policy because it already has hosted identity, BYOK, tenant isolation, and Scout signals. | Open-source project with active docs. Treat as architecture reference unless a later prompt explicitly adds a proxy. | Self-declared user fields can be abused; Carina must bind usage to authenticated tenant and user IDs server-side. | High. It maps directly to hosted tenant usage, subscription policy, and ops dashboards. |
| GPTCache: `https://github.com/zilliztech/gptcache` | Semantic cache pattern: hash exact prompts first, embed normalized task intent second, store cache provenance and similarity score, invalidate on tool, policy, memory, or user data changes. | Do not blindly return cached answers for personal, financial, legal, medical, security, code-changing, or approval-sensitive tasks. | MIT. Project is useful, but API churn is documented. Prefer local Carina implementation over deep runtime dependency. | Cache poisoning and data leakage across tenants are the main risks. Cache keys must include tenant, user, pack, tool policy version, and privacy class. | Medium-high. Best for FAQs, onboarding, docs, pricing, setup guidance, and repeated support answers. |
| LLMLingua and LLMLingua-2: `https://github.com/microsoft/LLMLingua`, `https://arxiv.org/abs/2310.05736` | Prompt compression as an optional preprocessor for long retrieved contexts, history summaries, and low-risk background tasks. Record compression ratio and quality guardrails. | Do not compress system prompts, safety policies, approval instructions, user instructions that change permissions, or exact legal and billing copy. | MIT for code. Research shows strong compression, but production quality depends on task type. | Compression can remove decisive details. Carina must keep original context available and mark compressed turns. | Medium. Use after simpler trimming and summarization are insufficient. |
| Langfuse and Helicone observability patterns: `https://langfuse.com/docs/observability/features/token-and-cost-tracking`, `https://docs.helicone.ai/guides/cookbooks/cost-tracking` | Track tokens, cost, latency, model, provider, user, tenant, feature, session, and tags. Segment by plan, employee, channel, workflow, and environment. | Do not make third-party observability the billing source of truth. | Both are useful references. Self-hosting or proxying adds operational surface. | PII can leak into traces. Carina must only store sanitized metadata in observability. | High. The dashboard model is directly useful for ops and user-facing usage views. |
| Baileys: `https://github.com/WhiskeySockets/Baileys`, `https://baileys.wiki/docs/intro/` | WebSocket-based WhatsApp Web pairing; QR or pairing-code flow; session persistence; lower overhead than browser automation. | Do not describe it as official WhatsApp API. Do not run high-volume outbound automation through it. | MIT. Active, but v7 introduced breaking changes and docs are still moving. | Account bans, session compromise, QR abuse, device takeover risk, and ToS risk. | Good for easy onboarding and small-business inbound workflows with explicit risk disclosure. |
| whatsapp-web.js: `https://github.com/wwebjs/whatsapp-web.js`, `https://wwebjs.dev/` | Browser-backed fallback where Puppeteer compatibility is more important than memory footprint. | Do not make it the default runtime for hosted scale because Chromium increases memory and operational cost. | Apache-2.0. Large community, active releases. | Its own docs warn unofficial clients can be blocked. Browser sessions must be isolated. | Useful fallback for self-hosted or support-assisted pairing. |

## Model Tier Policy

Carina must classify every hosted turn before provider execution.

| Tier | Intended use | Provider policy | Default cost posture |
|---|---|---|---|
| `mini` | Simple chat, classification, drafts, summaries, routing, short Q&A, onboarding help | Local model where configured, otherwise lowest-cost hosted mini model | Default after free allowance when user has no BYOK and no subscription |
| `openai_action` | Tool calling, app actions, structured extraction, email operations, workflow execution, web UI task execution | OpenAI-compatible model with strong tool calling | Allowed for subscribers, BYOK users, and limited free allowance |
| `claude_reasoning` | Deep reasoning, mathematical work, long persistent tasks, high-stakes documents, complex planning, mission-critical output | Claude-class model | Reserved for paid plans, BYOK, or explicit operator override |
| `blocked_or_upgrade` | User is over allowance and no safe free path exists | No provider call | Show BYOK, upgrade, or mini fallback options |

Routing decision inputs:

- Authenticated tenant ID, user ID, subscription plan, role, and BYOK status.
- Free message count and paid budget state.
- Task class: chat, action, tool_call, reasoning, coding, calculation, workflow, channel_scan, approval, escalation.
- Risk class: low, medium, high, regulated, security-sensitive.
- Token forecast: prompt tokens, retrieved context tokens, expected output tokens.
- Model quality requirement and maximum allowed cost.
- Scout state when available: normal, caution, suspended.

## BYOK, Free Allowance, and Subscription Policy

- Free hosted users receive 20 hosted messages.
- After 20 free hosted messages, Carina must enforce one of these outcomes:
  - User adds BYOK and pays provider directly.
  - User subscribes and Carina uses hosted keys under the plan budget.
  - User continues on `mini` or local-only mode if the requested task can be safely handled at that tier.
  - User is blocked from provider-backed execution when no safe mini or local path exists.
- BYOK usage is still logged for tokens, latency, model, provider, and feature analytics, but provider cost is marked `externalized`.
- Subscription usage is logged with provider cost, platform fee, margin, and budget window.
- Admin/operator override must be audited and time-limited.

## Cost Formula and Margin Model

All hosted requests must store costs in minor units or high-precision decimals to avoid rounding errors.

Definitions:

- `provider_cost = input_token_cost + output_token_cost + cache_read_cost + cache_write_cost + provider_fixed_fee`
- `payment_fee_buffer = provider_cost * 0.035`
- `platform_margin = provider_cost * 0.015`
- `minimum_billable_cost = provider_cost + payment_fee_buffer + platform_margin`
- `gross_margin = customer_allocated_value - provider_cost - payment_fee_buffer`

The first implementation must use configurable defaults:

```text
payment_fee_rate = 0.035
platform_margin_rate = 0.015
```

The ops dashboard must show:

- Provider cost.
- Fee buffer.
- Platform margin.
- Customer allocated value.
- Gross margin.
- Loss-making users, tenants, employees, channels, and workflows.

## Usage Ledger Schema

The first-party ledger should be append-only.

```text
ai_usage_ledger
  id
  created_at
  tenant_id
  user_id
  employee_id
  session_id
  conversation_id
  task_id
  channel_id
  surface
  feature
  provider
  model
  model_tier
  route_reason
  request_tokens
  response_tokens
  total_tokens
  cached_input_tokens
  cached_output_tokens
  compression_ratio
  provider_cost_minor
  payment_fee_minor
  platform_margin_minor
  customer_allocated_minor
  currency
  billing_mode
  byok_provider
  subscription_plan
  free_message_index
  budget_window
  cache_status
  latency_ms
  status
  error_code
  scout_policy_state
  metadata_json
```

Required indexes:

- `(tenant_id, created_at)`
- `(user_id, created_at)`
- `(employee_id, created_at)`
- `(provider, model, created_at)`
- `(billing_mode, created_at)`
- `(status, created_at)`

## Cache and Compression Decision Tree

1. Reject cache for personal data, secrets, code writes, payments, legal advice, medical advice, security incident response, approvals, and live channel messages unless a narrower tenant-scoped cache is explicitly allowed.
2. Check exact deterministic cache for public docs, pricing copy, onboarding content, setup instructions, and static product explanations.
3. Check tenant-scoped semantic cache for low-risk repeated support questions.
4. Trim context by source rank, recency, and user-visible task relevance.
5. Summarize long history into an auditable memory note.
6. Compress retrieved context only when prompt size is the main cost driver and the task class allows lossy preprocessing.
7. Route to `mini`, `openai_action`, or `claude_reasoning`.
8. Record the cache decision, compression ratio, and saved-token estimate in the ledger.

## Workspace Object Model

The Carina and Aiva workspace should be organized around work, not only chat.

```text
employee
  id, tenant_id, name, role, skill_pack, status, policy_profile

task
  id, tenant_id, employee_id, title, status, priority, due_at, source, risk_class

channel
  id, tenant_id, type, provider, status, pairing_mode, policy_profile

approval
  id, tenant_id, task_id, requested_by, risk_summary, status, expires_at

result
  id, tenant_id, task_id, artifact_type, summary, link, created_at

handoff
  id, tenant_id, task_id, reason, human_queue, status, accepted_by
```

Required user experience:

- Mobile and web must let users chat with an Aiva employee directly.
- Users must be able to assign work, see pending work, see completed work, and review approvals without changing channel.
- Channel messages remain inputs and outputs, not the only place to manage the employee.
- Human VA positioning must be practical: backup and escalation when AI cannot complete the work, not a promise of unlimited invisible human labor.

## WhatsApp Web Pairing Architecture

Pairing modes:

- `official_business_api`: stable production mode for businesses that can complete Meta setup.
- `whatsapp_web_baileys`: low-friction QR or pairing-code setup, default unofficial option.
- `whatsapp_web_browser`: Puppeteer fallback for compatibility or self-hosted operators.

Controls:

- Show explicit unofficial-client risk before pairing.
- Encrypt session credentials at rest.
- Scope sessions to tenant and channel.
- Rate-limit outbound messages.
- Do not send bulk marketing or cold outreach through Web pairing.
- Provide revocation and re-pair actions.
- Prefer inbound scanning, triage, reminders, and user-initiated replies.
- Fall back to official Business API for scale, high deliverability, compliance, and multi-agent teams.

## Prompt Sequence

1. Prompt 02 implements the policy router and model tiers.
2. Prompt 03 implements token efficiency, cache policy, and compression hooks.
3. Prompt 04 implements the usage ledger and ops dashboard.
4. Prompt 05 implements direct Aiva employee communications in web and mobile.
5. Prompt 06 redesigns workspace and launcher surfaces around work objects.
6. Prompt 07 repositions human VA marketing copy to avoid overpromising.
7. Prompt 08 adds WhatsApp Web pairing with risk controls and official API fallback.

## Implementation Rules

- Never use client-supplied user IDs for billing or quota attribution.
- Never store provider API keys in usage metadata.
- Never share cache entries across tenants unless the entry is public, static, and explicitly marked global.
- Never route security-sensitive, financial, medical, or legal work to a low-capability model only to save cost.
- Never hide a downgrade. If Carina uses mini mode because the user is over allowance, the UI must say so clearly.
- Scout suspension or caution states must reduce or block risky execution even when the user has budget.
