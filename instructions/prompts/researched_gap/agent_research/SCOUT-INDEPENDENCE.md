# Scout; Product Independence

**Date:** 16 June 2026
**Status:** To be corrected

## Current problem

Scout's marketing site (`labyrinthscout.com`) routes checkout to `core.carinaai.uk`, links to Carina in the footer, uses Carina-branded CSS (`carina-pulse`, `carina-prod-01`). This makes Scout look like a Carina add-on rather than an independent product.

## Target state

Scout is a standalone security product that **any AI agent** can use. Carina is just one of its users; like any other agent that connects to Scout for monitoring, prompt guard, and kill switch.

## What to change

| Surface | Current | Target |
|---------|---------|--------|
| **Checkout** | `core.carinaai.uk/checkout?plan=scout_pro` | Own Stripe checkout at `labyrinthscout.com` or `console.labyrinthscout.com/billing` |
| **Billing** | Carina's Stripe account | Scout's own Stripe product/price IDs |
| **Footer links** | Links to `carinaai.uk` | Links to `labyrinthscout.com` |
| **Branding CSS/IDs** | `carina-pulse`, `carina-prod-01` | Scout-branded identifiers |
| **Pricing page CTA** | "Start Monitoring" → Carina checkout | Scout's own checkout flow |
| **Trust dashboard** | `carinaai.uk/trust` | `labyrinthscout.com/trust` or console equivalent |
| **Marketing copy** | "Carina integration" | "Connect any agent; Carina, Hermes, custom" |
| **Auth** | Carina session/hosted auth | Scout's own auth (or API key based; no dependency on Carina) |
| **Database** | Shared `carina_central` | Separate Scout database (or `scout_` prefixed tables) |
| **Deployment** | Mixed in Carina repo under `carina/` | Standalone repo or clearly separated subdirectory |
| **npm package** | None | `@labyrinthscout/core` or similar, installable independently |

## Relationship model

```
Labyrinth Scout (standalone product)
  │
  ├── Carina → uses Scout for security (one customer)
  ├── Hermes → can use Scout for security
  ├── Any AI agent platform → can use Scout
  ├── Individual developers → protect their agents
  └── Enterprises → monitor all their agents
```

Carina uses Scout. Carina does not own Scout at the product/branding level; even if they share infrastructure today. The separation must be clear to customers.

## What stays the same

- Carina's `.env` still has `LABYRINTH_ENABLED=true` and `SCOUT_API_KEY`
- The Scout API endpoints Carina calls remain identical
- The nginx proxy on Contabo can still serve both domains
- The underlying PostgreSQL can stay shared initially; but tables should be logically separated
