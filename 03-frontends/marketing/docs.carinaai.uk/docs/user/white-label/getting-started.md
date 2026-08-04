---
sidebar_position: 1
title: Getting started
description: White-label onboarding path for agencies, consultancies, and niche operators reselling Carina.
---

# White-label getting started

White-label Carina lets you sell an AI agent product under your brand while Carina runs the engine, memory, tools, and deploy stack behind the scenes. Scout is separate and only enters the picture when you add it explicitly.

This guide is for **partner operators** (agencies, consultancies, MSPs) and **managed customers** who receive a branded workspace. It does not cover kernel development; see the [Developer Guide](/docs/developer/intro) for that.

## Who does what

| Area | You (partner or customer) | Carina platform |
| --- | --- | --- |
| Product name, logo, colors | Yes | Defaults only |
| Custom domain and TLS | You configure DNS; Carina verifies | Routing and brand resolution |
| Client workspaces | You create and hand off | Isolation and quotas |
| LLM API keys (BYOK) | Your keys in the workspace vault | Proxy and metering only |
| Skill packs and vertical bundles | You choose what to enable | Pack format and install |
| Billing to end clients | Your Stripe or contract | Partner tier limits on hosted cloud |
| Kernel updates, security patches | Receive via deploy | Carina ships and documents |

## Paths

### Managed cloud (fastest)

Best for agencies launching client workspaces on the hosted Carina workspace.

1. Create your operator account on [app.carinaai.uk](https://app.carinaai.uk).
2. Open **Settings > Brand** and set product name, support email, and accent color.
3. Upgrade to a partner-capable plan if you need multiple client workspaces ([Billing and plans](/docs/user/white-label/billing-and-plans)).
4. Add a [custom domain](/docs/user/white-label/custom-domains) when you are ready for a customer hostname.
5. Install [vertical skill packs](/docs/user/white-label/skill-packs) that match your niche.
6. [Hand off](/docs/user/white-label/customer-handoff) the workspace to your client.

### Self-hosted white-label

Best for operators who want their own VPS or private cloud.

1. Deploy the Carina stack with [Self-hosting](/docs/user/self-hosting) or your operator runbook.
2. Use a dedicated compose project per customer when multiple brands share one host ([Docker isolation](/docs/user/white-label/support-and-troubleshooting#docker-stack-isolation)).
3. Point `CARINA_CLOUD_CONTEXT` at your branded app build or configure brand JSON per workspace.
4. Scope ops tooling with `OPS_DOCKER_PROJECTS` or `CARINA_WHITE_LABEL_STACK` so unrelated stacks stay hidden.

## First-week checklist

| Step | Where | Done when |
| --- | --- | --- |
| Brand configured | App **Settings > Brand** | Login page shows your product name |
| Provider key added | **Settings > API keys** | Chat returns model responses |
| Vertical packs installed | **Skill packs** | Domain context appears in chat when relevant |
| Domain verified (optional) | **Settings** or ops API | Browser opens your hostname with correct brand |
| Client invited | Workspace handoff doc | Client signs in on your URL |
| Support contact set | Brand settings | Emails and help links use your address |

## In-app onboarding

The cloud app shows a **setup checklist** on the launcher until core steps are complete. It mirrors this doc: keys, brand, packs, and handoff links. Dismiss it when your workspace is production-ready.

## Related guides

- [Branding](/docs/user/white-label/branding)
- [Custom domains](/docs/user/white-label/custom-domains)
- [Billing and plans](/docs/user/white-label/billing-and-plans)
- [Partner and reseller](/docs/user/white-label/partner-reseller)
- [Customer handoff](/docs/user/white-label/customer-handoff)
- [Support and troubleshooting](/docs/user/white-label/support-and-troubleshooting)
