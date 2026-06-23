# Carina Ops plans

Compare Free, Ops Starter, and Ops Team. For current commercial packaging, use the marketing site: [carinaai.uk/pricing](https://carinaai.uk/pricing).

## Feature matrix

| Feature | Free | Ops Starter | Ops Team |
|---|---|---|---|
| Ops console | No | Yes | Yes |
| Members | 1 | 3 | 10 |
| BYOK providers | 0 | 3 | 10 |
| Included credits | 0 | 500 | 1,500 |
| Workbench | No | Yes | Yes |
| Audit retention | 0 days | 14 days | 90 days |
| Deployments | No | No | Yes |
| CSV exports | No | No | Yes |
| Premium model access | No | Top-up only | Allow with allowance |

## Trial

New orgs receive a **14-day Team trial** on registration. During trial, plan gates behave as Team, including exports and deployments. When the trial ends without a paid plan, the org returns to free and loses ops console access until you subscribe on the marketing site.

## Economic rule

Included credits are there to keep managed usage profitable. If a customer burns through the included allowance, they must:

1. buy a top-up pack
2. move to BYOK
3. or stay on cheaper models

## Upgrade path

1. Owner opens `/ops/billing`.
2. Choose **Ops Starter** or **Ops Team** checkout.
3. Stripe webhook syncs plan to your org.

Use the Stripe customer portal link on Billing for invoices and payment method updates.

## Carina AI vs Carina Ops

- **Carina AI (free):** personal agent and chat.
- **Carina Ops (paid):** org admin, BYOK, workbench, usage quotas, audit, team invites, and model routing.

Scout is optional governance; see [Labyrinth Scout](/docs/user/security/labyrinth-scout).

## Marketing reference

Commercial packaging summary: [carinaai.uk/pricing](https://carinaai.uk/pricing).
Model metering and routing spec: [Metering and routing](./pricing-metering.md).
