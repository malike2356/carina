# Carina Cloud

:::info Canonical inventory
Hosted vs self-hosted surfaces and billing boundaries: [Capability inventory](/docs/capabilities).
:::

Carina Cloud is the hosted SaaS at **app.carinaai.uk**. You get a private Carina workspace in the browser while the agent handles real work: chat, memory, skills, and BYOK inference. Pro adds **Labyrinth Scout** security monitoring for your cloud session and any self-hosted Carina you pair with the same account.

This page is the full reference for tenants. VERLOX operators should also read `ARCHITECTURE.md` in the private monorepo for internal wiring.

---

## URLs and roles

| URL | Who | Purpose |
|---|---|---|
| [app.carinaai.uk](https://app.carinaai.uk) | Every cloud tenant | Chat, settings, billing, Scout security |
| [carinaai.uk](https://carinaai.uk) | Prospects | Marketing, [full docs](https://carinaai.uk/docs/), trust page |
| Scout console (private URL) | Scout subscribers | Standalone Scout console; URL emailed at provisioning (cloud Pro includes Scout in-app) |
| [core.carinaai.uk](https://core.carinaai.uk) | VERLOX only | Private operator Carina instance (not tenant admin) |
| ops.carinaai.uk (port 4000) | VERLOX only | Internal platform admin; never shipped to customers |

**One Scout product, two surfaces:**

- **Tenant view** (you): `/security` and `/dashboard` on app.carinaai.uk; scoped to your instances only.
- **Platform view** (VERLOX): ops panel Security tab and Scout operator dashboard; all tenants.

---

## Quick start

1. Open [app.carinaai.uk](https://app.carinaai.uk) and choose **Register**.
2. Create an account (email + password, 8+ characters).
3. Open **Settings** and add at least one LLM provider API key (BYOK). Without a key, chat cannot call a model.
4. Start chatting. Free tier: 100 messages per day.
5. Optional: **Billing** → Upgrade to Pro for unlimited messages and Labyrinth Scout.

---

## Plans

| Feature | Free | Pro |
|---|---|---|
| Daily messages | 100 | Unlimited |
| BYOK provider keys | Yes | Yes |
| Private memory and skills | Yes (isolated schema) | Yes |
| Labyrinth Scout monitoring | No | Yes |
| Security dashboard | No | `/dashboard` |
| Stripe billing | N/A | Monthly subscription |

Pro checkout uses Stripe. After payment, a webhook activates your plan, issues a Scout license key, and provisions your Scout account automatically (same email as Carina Cloud).

---

## Bring your own keys (BYOK)

Inference cost is yours. Carina Cloud stores encrypted provider keys per tenant; the platform does not pay for your LLM usage.

### Supported providers

OpenAI, Anthropic, DeepSeek, Gemini, Groq, OpenRouter, NVIDIA, and others in the [provider registry](/docs/user/configuration). Add keys in **Settings** at app.carinaai.uk.

### How it works

1. Keys are encrypted at rest (`TENANT_KEY_ENCRYPTION_KEY` on the server).
2. Each chat request resolves credentials for your tenant only.
3. Keys are never shown in ops logs or Scout telemetry (`sanitiseParams()` redacts secrets before events leave Carina).

### API access

Authenticated tenants can manage keys via:

```
GET    /api/tenant/providers
POST   /api/tenant/providers   { "provider": "anthropic", "apiKey": "sk-..." }
DELETE /api/tenant/providers/:provider
```

Auth: session cookie (browser) or `Authorization: Bearer <JWT>` from `/app/auth/login`.

---

## Labyrinth Scout (Pro)

Scout watches your agent for prompt injection, runaway tools, secret leakage, and anomalies. On Pro, cloud chat is monitored automatically.

### Tenant pages (app.carinaai.uk)

| Page | What you see |
|---|---|
| `/security` | Subscription status, pairing key, monitored instances, recent events |
| `/dashboard` | Live security dashboard: threats, audit log, agent status, usage (tenant-scoped; no platform kill switch) |
| `/billing` | Plan management; redirects to `/security` after successful upgrade |

Sidebar menu (hosted chat): **Security (Scout)** appears when tier is `pro`.

### What happens when you pay

1. Stripe `checkout.session.completed` webhook runs.
2. `subscriptions` row is created with plan `scout_standard`.
3. A `scout_live_*` license key is stored in `subscriptions.scout_api_key`.
4. Carina calls Scout `POST /api/internal/provision-tenant` to create/link your Scout account and register the license key.
5. Cloud chat reports to Scout using your key and instance id `hosted:{your-user-id}`.

### View your Scout pairing key

1. Go to **Security** (`/security`).
2. Click **Show full key** (session-authenticated).
3. Copy the key or the generated `.env` snippet.

Use the same key to connect a **self-hosted** Carina install to the same Scout account:

```env
LABYRINTH_ENABLED=true
LABYRINTH_URL=<your Scout console URL from provisioning email>
LABYRINTH_API_KEY=scout_live_...
LABYRINTH_INSTANCE_ID=my-laptop-carina
LABYRINTH_INSTANCE_NAME=Carina (my-laptop)
```

Run `carina setup` or paste into `.env`, then restart. Heartbeats and events appear under the same Scout account as your cloud workspace.

### Scout APIs used by the dashboard

The app proxies these to Scout with your tenant key (you do not call Scout directly from the browser for dashboard data):

```
GET /api/dashboard/agent-status
GET /api/dashboard/threat-metrics
GET /api/dashboard/usage-analytics
GET /api/dashboard/audit-log
GET /api/events
```

Tenant keys only see **your** instances and events. Operator keys see the full platform.

### Session APIs

```
GET /app/auth/scout/status   # plan, instances, recent events (masked key)
GET /app/auth/scout/key      # full scout_live_* key + env snippet (Pro only)
```

---

## Billing

| Action | Where |
|---|---|
| Upgrade to Pro | `/billing` → Stripe Checkout |
| Manage subscription | `/billing` → Stripe Customer Portal |
| Invoices | Stripe portal (also stored in `invoices` table) |

Billing API (JWT auth):

```
GET  /api/billing/subscription
GET  /api/billing/usage
GET  /api/billing/invoices
POST /api/billing/cancel
POST /api/billing/reactivate
```

---

## Data isolation

Each hosted user gets:

- Row in `hosted_users` (email, tier, quota counters).
- Dedicated Postgres schema (`schema_name`) for memories and tenant data.
- External session id `hosted:{userId}` so chat sessions do not collide.
- Separate BYOK key rows in `tenant_provider_keys`.
- Scout instance id `hosted:{userId}` for cloud monitoring.

Other tenants cannot read your data, keys, or Scout events.

---

## Quotas

| Tier | Limit |
|---|---|
| Free | 100 messages per day (`messages_today` resets daily) |
| Pro | No daily cap |

When the free quota is exceeded, chat returns HTTP 429 with `upgradeUrl: /billing`.

---

## Trust and verification

Public security posture (risk score, attestation previews) lives on [carinaai.uk/trust](https://carinaai.uk/trust), fed by Scout `GET /api/public/trust`. That is platform-level transparency, not your private dashboard.

On-chain attestations (ERC-8004 / ERC-8126) are planned for hosted tenants and require operator wallet configuration.

---

## Self-host vs cloud

| | Carina Cloud | Self-hosted |
|---|---|---|
| Install | None (browser) | `npm install -g carina-agent`, Docker, or bare metal |
| Inference keys | BYOK in Settings | Your `.env` |
| Scout | Included on Pro; `/security` + `/dashboard` | Pair via wizard or `.env`; optional [Labyrinth Scout](/docs/user/security/labyrinth-scout) subscription |
| Data location | VERLOX Postgres (tenant schema) | Your infrastructure |
| Ops panel | Not available | N/A |

You can use both: cloud for daily work, self-hosted for local files/tools, same Scout key on Pro.

---

## Deploying hosted mode (operators)

Not required for tenants. For VERLOX/VPS operators enabling Carina Cloud:

```bash
# core.carinaai.uk/.env
HOSTED_MODE=true
JWT_SECRET=<random>
TENANT_KEY_ENCRYPTION_KEY=<32-byte-hex>
CARINA_HOSTED_APP_HOST=app.carinaai.uk
CARINA_OPERATOR_HOSTS=core.carinaai.uk
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
LABYRINTH_URL=<your Scout console URL from provisioning email>
SCOUT_PROVISION_SECRET=<shared with Scout>
```

Scout server:

```bash
SCOUT_PROVISION_SECRET=<same secret>
SCOUT_API_KEY=<operator key>
```

Internal tenant admin (VERLOX only): `ops.carinaai.uk` → **Tenants** tab lists `hosted_users`, tiers, usage, BYOK counts; detail view supports tier override and quota reset.

---

## Troubleshooting

| Symptom | Check |
|---|---|
| Chat says no provider | Add BYOK key in Settings |
| 429 daily limit | Upgrade at `/billing` or wait for quota day rollover |
| Scout not active after payment | Stripe webhook delivered? `subscriptions.scout_api_key` populated? `SCOUT_PROVISION_SECRET` matches Scout? |
| Empty Scout dashboard | Send a chat message (registers heartbeat); wait ~60s |
| Self-hosted not in Scout | Correct `LABYRINTH_API_KEY`? Instance heartbeating? |
| `/dashboard` redirects to billing | Tier must be `pro` with active subscription |

---

## Related docs

- [Getting started](/docs/user/getting-started) - install CLI and local agent
- [Configuration](/docs/user/configuration) - env vars and providers
- [Self-hosting](/docs/user/self-hosting) - Docker and bare metal
- [Labyrinth Scout](/docs/user/security/labyrinth-scout) - security control plane
- [Web UI gateway](/docs/user/gateways/web) - local web chat (non-hosted)
