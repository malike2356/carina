---
sidebar_position: 5
title: Billing and plans
description: White-label commercial tiers, plan presentation, and what partners bill to their clients.
---

# Billing and plans

White-label billing has two layers: what **you pay Carina** (partner tier) and what **your clients pay you** (your Stripe or contract).

## Partner tiers (hosted)

| Tier | Client workspaces | Typical use |
| --- | --- | --- |
| Starter | Up to 5 | Solo agency or pilot |
| Agency | Up to 25 | Active reseller |
| Enterprise | Up to 500 | Large MSP or platform |

Partner accounts are created on the hosted engine. API: `POST /api/carina-ops/partner/account`.

Usage rollups and summaries: `GET /api/carina-ops/partner/summary`.

## Branded plan names

The cloud app shows plan labels using your `productName` (for example `Acme Cloud Pro` instead of `Carina Pro`). Configure brand in **Settings > Brand**; billing reads resolved brand from `/api/billing/summary`.

Checkout still uses Stripe on the platform side for hosted cloud. Self-hosted operators invoice clients directly.

## What Carina meters

On hosted cloud, Carina tracks workspace usage (messages, tokens) for quotas and partner summaries. Your client contracts and margins are outside the kernel.

## BYOK

Clients bring their own LLM API keys. Carina does not resell model tokens on the standard BYOK path. See [Carina Ops BYOK](/docs/user/carina-ops/byok).

## Upgrade path

1. Operator signs up on app.carinaai.uk.
2. Open **Billing** for workspace plan.
3. For partner features, create a partner account via ops API or VERLOX onboarding.
4. Provision client orgs with `POST /api/carina-ops/partner/clients`.

## Related

- [Partner and reseller](/docs/user/white-label/partner-reseller)
- [Carina Ops plans](/docs/user/carina-ops/plans)
- [Pricing](/docs/user/pricing)
