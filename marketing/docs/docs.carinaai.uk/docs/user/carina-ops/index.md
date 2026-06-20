# Carina Ops overview

Carina **AI** is the autonomous agent: chat, tools, memory, and optional self-hosting. **Carina Ops** is the paid operations console on [app.carinaai.uk](https://app.carinaai.uk) for teams that need BYOK, usage controls, audit, and member admin. **Labyrinth Scout** is a separate governance product for agent protection and compliance; it complements Ops but is not required to use Carina Ops.

Sign up at [app.carinaai.uk/hosted-register](https://app.carinaai.uk/hosted-register). After registration, open **Carina Ops** from the app nav at `/ops/`.

## Product ladder

| Product | Who | Where |
|---|---|---|
| Carina AI (free) | Individuals | Chat on app.carinaai.uk |
| Carina Ops Starter | Small teams | `/ops/` on app.carinaai.uk |
| Carina Ops Team | Platform and ops teams | `/ops/` plus deployments and exports |
| Labyrinth Scout | Security and compliance | labyrinthscout.com |

## What Ops includes

- **Vault:** encrypted BYOK provider keys
- **Workbench:** test prompts against your keys
- **Usage and credits:** weighted plan credits, spend visibility, and model-class controls
- **Audit log:** org-scoped events with plan-based retention
- **Billing:** Stripe checkout for Starter and Team plans
- **Onboarding wizard:** guided setup on first visit
- **Model routing:** cheap, balanced, and premium classes with plan gates

## Commercial model

The recommended commercial model is a subscription plus weighted credits, not unlimited token resale. See the [marketing page](https://carinaai.uk/pricing) for current packaging, then read the [metering and routing spec](./pricing-metering.md) for the technical model.

## Next steps

- [Getting started](./getting-started.md)
- [Connect provider keys (BYOK)](./byok.md)
- [Audit and exports](./audit-and-exports.md)
- [Plans comparison](./plans.md)
- [Metering and routing](./pricing-metering.md)
