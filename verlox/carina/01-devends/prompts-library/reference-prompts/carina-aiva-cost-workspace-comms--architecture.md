---
id: 2026-07-13_carina_aiva_cost_workspace_comms_architecture_reference
title: Carina and Aiva cost-aware routing architecture reference
product: carina-aiva
capability: architecture-reference
status: reusable
source: 01-devends/prompts-library/pending/carina-aiva-cost-workspace-comms--01-research-and-architecture.md
created: 2026-07-13
canonical_path: 01-devends/prompts-library/reference-prompts/carina-aiva-cost-workspace-comms--architecture.md
---

# Carina and Aiva Cost-Aware Architecture Reference

Use this reference for prompts 02 through 08 in the cost, workspace, comms, and WhatsApp pairing pack.

## Required Product Policy

- Hosted users receive 20 useful free model-backed messages.
- After the free allowance, require BYOK, subscription, or safe `mini` or local fallback.
- Use mini or local models for simple, low-risk, low-value work.
- Use OpenAI-class models for tool calling, action execution, workflow operations, and structured extraction.
- Use Claude-class models for deep reasoning, serious calculations, long persistent tasks, and mission-critical output.
- Do not silently downgrade. Tell the user when budget policy changes the model tier.
- BYOK usage is externalized cost, but still logged for product analytics.
- Subscription usage must include provider cost, payment fee buffer, platform margin, and customer allocated value.

## Required Cost Formula

```text
provider_cost = input_token_cost + output_token_cost + cache_read_cost + cache_write_cost + provider_fixed_fee
payment_fee_buffer = provider_cost * 0.035
platform_margin = provider_cost * 0.015
minimum_billable_cost = provider_cost + payment_fee_buffer + platform_margin
gross_margin = customer_allocated_value - provider_cost - payment_fee_buffer
```

## Required Ledger Fields

Implement or preserve these concepts even if the first migration uses different exact storage names:

- Tenant, user, employee, session, conversation, task, channel, and surface.
- Provider, model, model tier, route reason, and task class.
- Request tokens, response tokens, total tokens, cached tokens, and compression ratio.
- Provider cost, fee buffer, platform margin, customer allocated value, and currency.
- Billing mode: free, subscription, byok, internal, or operator_override.
- Free message index, budget window, cache status, latency, status, error code, and Scout policy state.

## Cache and Compression Rules

- Exact cache first for public static content.
- Tenant-scoped semantic cache only for low-risk repeated support and documentation answers.
- No cache reuse for secrets, personal data, payments, legal, medical, security incident work, approvals, live channel messages, or code writes unless a narrower explicit policy exists.
- Trim context before compressing it.
- Compress only retrieved context, long history summaries, or background context where lossy preprocessing is acceptable.
- Never compress system prompts, safety policies, approval copy, provider credentials, or user instructions that grant or remove permissions.

## Workspace Rules

The workspace must be organized around work objects:

- `employee`
- `task`
- `channel`
- `approval`
- `result`
- `handoff`

Mobile and web must let users chat with, assign work to, and monitor Aiva employees without switching to external channels. Channels are inputs and outputs, not the workspace itself.

Human VA copy must be practical. Say humans are backup and escalation when AI cannot complete a task. Do not promise unlimited invisible human labor.

## WhatsApp Web Rules

- Support official WhatsApp Business API as the stable production path.
- Support Baileys-style WhatsApp Web pairing as the low-friction path, with explicit unofficial-client risk copy.
- Keep browser-backed whatsapp-web.js style pairing as fallback only when necessary.
- Encrypt sessions, scope sessions to tenant and channel, rate-limit outbound messages, and provide revoke or re-pair actions.
- Do not use WhatsApp Web pairing for bulk marketing, spam, or cold outreach.

## Source Anchors

- LiteLLM cost tracking and spend logs: `https://docs.litellm.ai/docs/proxy/cost_tracking`
- LiteLLM budgets and rate limits: `https://docs.litellm.ai/docs/proxy/users`
- LiteLLM provider budget routing: `https://docs.litellm.ai/docs/proxy/provider_budget_routing`
- GPTCache semantic cache: `https://github.com/zilliztech/gptcache`
- LLMLingua prompt compression: `https://github.com/microsoft/LLMLingua`
- Langfuse token and cost tracking: `https://langfuse.com/docs/observability/features/token-and-cost-tracking`
- Helicone cost tracking patterns: `https://docs.helicone.ai/guides/cookbooks/cost-tracking`
- Baileys WhatsApp Web API: `https://github.com/WhiskeySockets/Baileys`
- whatsapp-web.js: `https://github.com/wwebjs/whatsapp-web.js`
