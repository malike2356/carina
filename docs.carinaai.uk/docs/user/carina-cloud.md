# Carina Cloud

:::info Canonical inventory
Hosted vs self-hosted surfaces and billing boundaries: [Capability inventory](/docs/capabilities).
:::

**Carina Cloud** is the hosted SaaS at [app.carinaai.uk](https://app.carinaai.uk). Sign up, add your LLM API key, optionally enable a domain pack, and chat in the browser. The agent runs the same MIT kernel as self-host; Cloud adds managed hosting, sessions, and the workspace UI.

Carina Cloud is **not** the same product as **Labyrinth Scout**. Scout is a separate commercial security layer. The Cloud free tier does not bundle Scout.

For team features (BYOK vault, workbench, audit, deployments), upgrade to **Carina Ops** plans on the same app host.

---

## Quick start (one click)

1. Open [app.carinaai.uk/hosted-register](https://app.carinaai.uk/hosted-register) and create an account.
2. Your org and agent workspace are provisioned automatically (empty skill packs, welcome checklist).
3. Add at least one LLM provider key in **Settings** (BYOK required for chat).
4. Optionally enable a domain pack from the packs UI or Hub.
5. Send your first chat message.

When Carina Ops is enabled, new accounts redirect to the onboarding wizard at `/ops/onboarding`. Otherwise you land on chat with a welcome banner.

---

## Plans

For current Carina Cloud and Ops packaging, see [carinaai.uk/pricing](https://carinaai.uk/pricing).

New orgs receive a **14-day Team trial** on registration. Full feature matrix: [Carina Ops plans](/docs/user/carina-ops/plans).

Scout Monitor and Scout Pro are sold separately at [labyrinthscout.com](https://labyrinthscout.com#pricing). Do not conflate Scout checkout with Carina Cloud or Ops checkout.

Marketing summary: [carinaai.uk/cloud](https://carinaai.uk/cloud).

---

## Self-host vs Carina Cloud

| | Self-host `carina-agent` | Carina Cloud |
|---|---|---|
| Install | `npm install -g carina-agent`, Docker, or bare metal | None (browser) |
| Infrastructure | Your servers | VERLOX managed Postgres |
| Inference keys | Your `.env` or BYOK config | BYOK in Settings |
| Skill packs | `carina pack install`, `.env`, or operator store | Same packs; tenant `installed_packs` table |
| Scout | Optional; separate subscription | Optional; not on free tier |
| Ops console | N/A unless you run hosted mode yourself | `/ops/*` on paid plans |

You can use both: Cloud for daily work, self-hosted for local files and tools, with the same Scout key if you subscribe to Scout Pro.

---

## Export and migrate

**Roadmap:** one-click export of org config, installed packs, and vault metadata to a self-host `.env` + YAML bundle. This is not fully automated yet.

Today you can:

- Copy BYOK keys from Settings into your local `.env`
- Reinstall packs with `carina pack install` on self-host
- Export audit and usage CSV on Ops Team (see [Carina Ops plans](/docs/user/carina-ops/plans))

Document any production migration with your operator before moving off Cloud.

---

## Free tier guardrails

| Limit | Value |
|-------|-------|
| Daily chat messages | 100 (configurable via `CARINA_CLOUD_FREE_DAILY_MESSAGES`) |
| Scout bundled | No |
| Ops console | No (trial elevates to Team features for 14 days) |
| Members | 1 |

When the free quota is exceeded, chat returns HTTP 429 with an upgrade link.

---

## Bring your own keys (BYOK)

Inference cost is yours. Carina Cloud stores encrypted provider keys per tenant.

Supported providers match the [configuration guide](/docs/user/configuration): OpenAI, Anthropic, DeepSeek, Gemini, Groq, OpenRouter, and others in the provider registry.

Keys are encrypted at rest (`TENANT_KEY_ENCRYPTION_KEY` on the server) and scoped to your tenant only.

---

## Labyrinth Scout (optional, paid)

Scout watches agents for prompt injection, runaway tools, secret leakage, and anomalies. It is **not included** on the Cloud free tier.

If you subscribe to Scout separately:

| Page | Purpose |
|------|---------|
| `/security` | Subscription status, pairing key, monitored instances |
| `/dashboard` | Tenant-scoped security dashboard |

Cloud chat can report to Scout when a Scout license is active on your account. See [Labyrinth Scout](/docs/user/security/labyrinth-scout) for pairing self-hosted Carina with the same Scout account.

---

## Billing

| Action | Where |
|--------|-------|
| Upgrade to Ops Starter or Team | `/ops/billing` |
| Scout subscription | `/billing` or labyrinthscout.com |
| Manage payment method | Stripe Customer Portal from Billing |

---

## Data isolation

Each hosted user gets:

- Row in `hosted_users` (email, tier, quota counters)
- Dedicated Postgres schema for memories and tenant data
- External session id `hosted:{userId}`
- Separate BYOK rows in `tenant_provider_keys`

Other tenants cannot read your data or keys.

---

## Operators: enable Carina Cloud

```bash
# core.carinaai.uk/.env
HOSTED_MODE=true
CARINA_CLOUD_ENABLED=true
JWT_SECRET=<random>
TENANT_KEY_ENCRYPTION_KEY=<32-byte-hex>
CARINA_HOSTED_APP_HOST=app.carinaai.uk
CARINA_OPS_PRODUCT_ENABLED=true   # optional; enables /ops onboarding wizard
CARINA_CLOUD_FREE_DAILY_MESSAGES=100
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_CARINA_OPS_STARTER=price_...
STRIPE_PRICE_CARINA_OPS_TEAM=price_...
```

Never commit real secrets. See `.env.example` in the repository.

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Chat says no provider | Add BYOK key in Settings |
| 429 daily limit | Wait for quota rollover or upgrade at `/ops/billing` |
| Scout not active | Scout is a separate product; confirm Scout subscription |
| Empty onboarding wizard | `CARINA_OPS_PRODUCT_ENABLED=true` and Stripe configured |

---

## Related docs

- [Getting started](/docs/user/getting-started)
- [Self-hosting](/docs/user/self-hosting)
- [Commercial boundaries](/docs/user/pricing)
- [Carina Ops plans](/docs/user/carina-ops/plans)
- [Labyrinth Scout](/docs/user/security/labyrinth-scout)
