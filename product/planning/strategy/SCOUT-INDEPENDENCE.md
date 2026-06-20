# Scout: Verlox SaaS Product Independence

**Date:** 16 June 2026
**Status:** Strategic requirement; implementation in progress
**Owner:** VERLOX (commercial product, sold separately from Carina)

## Product positioning

Labyrinth Scout is a **Verlox SaaS product**: a hosted security control plane that customers subscribe to directly. It is not a Carina feature, add-on, or upsell path inside Carina Cloud.

| Dimension | Scout (Verlox SaaS) | Carina (Verlox SaaS) |
|-----------|---------------------|----------------------|
| **What it is** | Agent security monitoring, prompt guard, kill switch, audit, trust API | Autonomous AI agent platform |
| **Who buys it** | Any team running AI agents (Carina, Hermes, custom, enterprise fleets) | Teams that want a full agent stack |
| **How they pay** | Scout subscription at `labyrinthscout.com` | Carina subscription at `carinaai.uk` / `core.carinaai.uk` |
| **Relationship** | Carina is one integration partner and one customer segment | Carina optionally connects to Scout via API key |

Scout must be sellable to a verlox shop, a fintech running custom agents, or an enterprise with twenty agent instances, without those buyers ever touching Carina branding, checkout, or auth.

## Current problem

Scout's marketing site (`labyrinthscout.com`) routes checkout to `core.carinaai.uk`, links to Carina in the footer, uses Carina-branded CSS (`carina-pulse`, `carina-prod-01`). This makes Scout look like a Carina add-on rather than a Verlox SaaS product customers can buy on its own.

That blocks the commercial model: non-Carina buyers will not subscribe through Carina's billing flow, and Carina-first positioning undersells Scout as a category product (agent security control plane).

## Target state

Scout is a standalone Verlox SaaS that **any AI agent** can connect to. Carina is one customer; like Hermes, OpenClaw deployments, or custom Node/Python agents that report telemetry and accept kill-switch commands over the Scout API.

### SaaS surfaces (must be Scout-owned)

| Surface | Current | Target |
|---------|---------|--------|
| **Signup / login** | Carina session or hosted auth on `core.carinaai.uk` | Scout account at `console.labyrinthscout.com` (email + password or SSO later) |
| **Checkout** | `core.carinaai.uk/checkout?plan=scout_pro` | Scout Stripe checkout at `labyrinthscout.com` or `console.labyrinthscout.com/billing` |
| **Billing portal** | Carina's Stripe account and customer records | Scout's own Stripe products, prices, invoices, and customer portal |
| **Provisioning** | Tenant created via Carina billing webhook | Scout-native tenant + API key issued on successful subscription |
| **Console** | Mixed proxy through Carina hosted routes | First-class Scout console; Carina uses the same API as any other agent |
| **Support / docs** | Carina docs cross-links only | `labyrinthscout.com/docs` as canonical; Carina doc is one integration guide |
| **Trust dashboard** | `carinaai.uk/trust` | `labyrinthscout.com/trust` or console equivalent |
| **Footer / marketing** | Links to `carinaai.uk` | Verlox / Scout links only; Carina mentioned as an integration, not the parent product |
| **Branding CSS/IDs** | `carina-pulse`, `carina-prod-01` | Scout-branded identifiers |
| **Pricing page CTA** | "Start Monitoring" → Carina checkout | Scout signup → Stripe → console with API key |
| **Auth for API** | Coupled to Carina tenant IDs | Scout-issued API keys scoped to Scout tenant; no Carina session required |
| **Database** | Shared `carina_central` | Separate Scout database (or `scout_` prefixed tables with strict tenant isolation) |
| **Deployment** | Mixed in Carina repo under `carina/` | Standalone deploy unit (`console.labyrinthscout.com`, Docker `verlox/scout`); clear Verlox product boundary |
| **npm package** | None | `@labyrinthscout/core` or similar, installable without Carina |

### What "SaaS-ready" means for go-to-market

1. **Self-serve path:** Land on `labyrinthscout.com` → pick tier → pay → receive console URL + API key → connect agent in under 30 minutes.
2. **No Carina prerequisite:** Documentation, SDK, and dashboard never assume Carina is installed.
3. **Verlox as vendor:** Invoices, terms, and support identity are Scout/Verlox, not "Carina security module".
4. **Multi-agent per tenant:** One Scout subscription can protect multiple agent instances (fleet view already exists in console).
5. **Carina remains a channel:** Carina Cloud can still bundle or recommend Scout, but through Scout's API and billing IDs, not by absorbing Scout into Carina checkout.

## Relationship model

```
VERLOX (company)
  │
  ├── Labyrinth Scout (SaaS product) ── subscription at labyrinthscout.com
  │     ├── Carina instances → API key integration (one customer segment)
  │     ├── Hermes / OpenClaw / custom agents → same API
  │     ├── Individual developers → protect local or hosted agents
  │     └── Enterprises → fleet monitoring, governance, kill switch
  │
  └── Carina (SaaS product) ── subscription at carinaai.uk
        └── Optional: LABYRINTH_ENABLED + SCOUT_API_KEY (Scout customer)
```

Carina uses Scout. Carina does not own Scout at the product, billing, or branding level, even when both run on shared Verlox infrastructure today. Customers must be able to buy Scout without buying Carina.

## What stays the same

- Carina's `.env` still supports `LABYRINTH_ENABLED=true` and `SCOUT_API_KEY` for customers who use both products.
- The Scout API endpoints Carina calls remain identical; integration is API-key based, not product coupling.
- The nginx proxy on Contabo can still serve both domains under Verlox ops.
- PostgreSQL can stay physically shared initially; logical tenant separation and Scout-owned billing records are still required.
- VERLOX internal ops (`ops.carinaai.uk`) may administer both products; that panel is never customer-facing for Scout SaaS.

## Success criteria

- A buyer who has never heard of Carina can subscribe, provision, and protect an agent using only Scout URLs and docs.
- Stripe revenue for Scout lands in Scout's product/price IDs and Scout customer records.
- Marketing and console contain no Carina checkout links, Carina auth gates, or "powered by Carina" framing.
- Carina integration docs live under Scout's integration section, mirroring how `custom-agent` and `docker` integrations are documented today.
