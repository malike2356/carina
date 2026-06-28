# SOP 001: Platform Architecture and Operations
**Scope:** Internal VERLOX use only. Never share with customers or include in public docs.
**Applies to:** Anyone operating or developing the Carina / Aiva / Scout platform stack.

---

## 1. The Three Products

All three are built from a single mono-repo at `/opt/lampp/htdocs/verlox/carina` locally and deployed to the Contabo VPS at `80.190.81.208` (SSH alias: `aman`).

| Product | What it is | Who uses it | Where |
|---|---|---|---|
| Carina | Open-source AI agent engine | Developers who self-host | MIT license, npm installable |
| Aiva | AI employee service built on Carina | Business owners (paying customers) | app.carinaai.uk |
| Scout | Governance and monitoring layer | Carina self-hosters who want oversight | console.labyrinthscout.com |

These are distinct products with separate pricing. Scout is optional for Carina self-hosters. Aiva plans include built-in governance monitoring that does not require a Scout subscription.

---

## 2. The Five Interfaces (What Each URL Does)

### 2a. app.carinaai.uk (port 4100) - Customer workspace

The product customers pay for. Each business that signs up gets an isolated workspace here. Strict per-workspace isolation: a customer can only see their own data.

Key areas:
- `/register`, `/onboarding` - self-sign-up and 3-step setup wizard
- `/aiva` - manage their Aiva worker(s)
- `/aiva/workers/[id]` - configure a specific worker: persona, channels, training, governance
- `/billing/aiva` - subscribe, upgrade, view invoices, manage via Stripe portal
- `/channels` - connect Slack, email, Trello, calendar
- `/settings` - governance rules, branding, keys, pairing
- `/analytics` - usage and message metrics
- `/chat`, `/documents`, `/logs` - day-to-day operation

Auth: email + password (standard Next Auth session).
Plan gate: `aiva_plan_status` cookie enforced by middleware. Suspended or expired workspaces are bounced to `/billing/aiva`.

### 2b. admin.carinaai.uk (port 4200) - VERLOX Aiva business ops

Your internal panel for running the Aiva business. You log in here to manage all customers. Cross-workspace view: sees every customer's data.

Key areas:
- Dashboard: summary metrics across all customers
- `/customers` - list of all registered workspaces with plan, status, trial days remaining
- `/customers/[id]` - single customer detail: plan, usage, subscription state, billing history
- `/fleet` - all Aiva workers running across every customer workspace
- `/fleet/attestation` - audit log of worker actions for governance review
- `/revenue` - Stripe revenue view across all subscriptions
- `/va-queue` - human VA handoff tasks waiting to be assigned or actioned
- `/audit-log` - platform-level event log

Auth: TOTP (2FA mandatory). Login at `/login` then `/totp-verify`.
Docker service: `carina-admin` at port 4200.
Nginx: `admin.carinaai.uk` proxies to `carina-admin:4200`.

### 2c. ops.carinaai.uk (port 4001 in prod, 4000 in dev) - VERLOX engineering cockpit

Your tool for working directly on the Carina AI engine. Server-rendered Express/EJS app (not React). Single-password auth (no TOTP).

Key areas:
- Chat directly with the Carina agent
- Memories: browse and edit the agent's episodic memory store
- RAG: ingest and query the knowledge corpus
- Skills: manage skill packs and the Skills Hub
- Security: Scout proxy (view agent security events without logging into Scout separately)
- Control Centre: agent configuration, LLM provider routing
- Tenants: multi-tenant workspace configuration
- Subscriptions: Carina platform (hosted mode) subscription management
- AI Platform: model routing, credit ledger
- Channels: agent channel configuration
- Terminal (TUI/PTY): browser-accessible terminal for the running agent
- MCP: Model Context Protocol server management
- Projects: project-level agent routing

Docker service: `carina-ops` at port 4001 (prod) / `carina-admin` at port 4000 (verlox dev compose).
Nginx: `ops.carinaai.uk` proxies to `carina-ops:4001`.

Note on naming confusion: in `docker-compose.verlox.yml` (local dev), the ops Express app is called `carina-admin`. In `docker-compose.deploy.yml` (production), it is called `carina-ops`. The Next.js admin panel (`admin.carinaai.uk`) is the separate `carina-admin` service in production.

### 2d. core.carinaai.uk (port 3000) - Backend API

The backend that both `app.carinaai.uk` and `admin.carinaai.uk` call. Handles:
- Aiva worker provisioning, routing, message dispatch
- Trial and subscription state (PostgreSQL `aiva_subscriptions` table)
- Stripe checkout, webhook processing, billing sync
- Email (Resend: trial warnings, suspension, invoices)
- Daily cron (08:00 UTC): sends trial warning emails, suspends expired trials
- Hourly cron (:15): sweeps past-due workspaces through grace period to suspension

Not accessed directly by end users. All traffic is server-to-server.
Docker service: `carina-web` at port 3000.

### 2e. console.labyrinthscout.com (port 4444) - Scout governance server

The Labyrinth Scout product. Separate from Aiva governance. Used by Carina self-hosters who want cross-agent monitoring, kill switches, and external audit trails. Customers who buy Scout separately get accounts here.

Docker service: `labyrinth-scout` at port 4444.

---

## 3. How the Money Is Collected

### The model

"No card required to start the trial" means no card is collected at registration. This reduces friction and increases sign-up rate. The card is collected at the point of conversion: when the customer decides to continue after the trial.

### Full lifecycle

```
Day 0:  Customer registers at app.carinaai.uk/register.
        provisionTrial() runs:
          aiva_subscriptions: status='trialing', trial_ends_at = NOW() + 15 days, tier='trial'
        Aiva worker is live immediately. No card asked.

Day 12: Email: "3 days left on your Aiva trial. Choose a plan."
Day 13: Email: "2 days left."
Day 14: Email: "1 day left."

Day 15: Trial expires.
        suspendSubscription() runs:
          - All active workers for the workspace are paused
          - Email sent: "Your Aiva trial has ended. Choose a plan." with link to /billing/aiva
          - aiva_plan_status cookie (synced hourly by AivaPlanCookieSync) flips to 'suspended'
          - Middleware bounces all /aiva/* page visits to /billing/aiva?reason=trial_expired
          - All API calls return 402 with { upgradeUrl: '/billing/aiva' }
```

### How the card is collected

On `/billing/aiva`, the customer picks a plan and clicks "Get started". This calls `POST /api/aiva/billing/checkout`, which calls `createAivaCheckoutSession()` on the core backend. The customer is redirected to `checkout.stripe.com` (Stripe's hosted page). Stripe collects the card there.

After payment, Stripe fires a `checkout.session.completed` webhook to `https://core.carinaai.uk/webhooks/stripe`. The handler calls `activateAivaSubscription()`, which sets status to `active`, records the Stripe subscription ID, and reactivates all paused workers. This happens within seconds of payment.

### Stripe events the system handles

| Event | Effect |
|---|---|
| `checkout.session.completed` | Activates subscription, reactivates workers |
| `customer.subscription.updated` | Syncs plan tier, period dates, cancellation state |
| `customer.subscription.deleted` | Marks subscription as cancelled |
| `invoice.paid` | Records invoice in `aiva_invoices` table |
| `invoice.payment_failed` | Marks subscription past-due, starts grace period |

### What you must configure in Stripe before payment goes live

**Step 1: Create products in Stripe Dashboard (dashboard.stripe.com > Products)**

Create three products with monthly and annual prices:

| Product | Monthly (GBP) | Annual (GBP) | Notes |
|---|---|---|---|
| Aiva Starter | 49.00 | 470.40 (20% off) | 1 Aiva worker slot |
| Aiva Team | 99.00 | 950.40 (20% off) | 5 Aiva worker slots |
| Aiva Business | 299.00 | 2870.40 (20% off) | Unlimited worker slots |

This gives 6 Stripe price IDs (3 products x monthly/annual).

**Step 2: Create a webhook endpoint in Stripe**

Go to Developers > Webhooks > Add endpoint.
- URL: `https://core.carinaai.uk/webhooks/stripe`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
- Copy the signing secret (`whsec_...`)

**Step 3: Set env vars on the VPS**

```bash
ssh aman
nano ~/apps/core.carinaai.uk/.env
```

Add:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_AIVA_STARTER_MONTHLY=price_...
STRIPE_PRICE_AIVA_STARTER_ANNUAL=price_...
STRIPE_PRICE_AIVA_TEAM_MONTHLY=price_...
STRIPE_PRICE_AIVA_TEAM_ANNUAL=price_...
STRIPE_PRICE_AIVA_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_AIVA_BUSINESS_ANNUAL=price_...
```

Do NOT set `AIVA_BILLING_ENABLED=false`. The checkout only throws if that is explicitly false.

**Step 4: Restart the core service**

```bash
ssh aman
cd ~/apps/core.carinaai.uk
docker compose restart carina-core
```

**Testing before going live**: use Stripe test mode keys (`sk_test_...`) and the Stripe CLI to simulate webhook events locally. `stripe listen --forward-to https://core.carinaai.uk/webhooks/stripe` forwards test events to production to verify the end-to-end flow.

### Plan tiers and limits

| Tier | Price | Workers | Messages/month | Aiva Training | Custom Governance |
|---|---|---|---|---|---|
| Trial | Free (15 days) | 1 | 200 | No | No |
| Starter | GBP 49/mo | 1 | 2000 | No | No |
| Team | GBP 99/mo | 5 | 10000 | No | No |
| Business | GBP 299/mo | Unlimited | Unlimited | Yes | Yes |

Message limits are enforced in `message-router.ts` via `checkAndEnforceLimit()`. Training is gated by `PlanGateSection planRequired="business"`. Custom governance rules are gated to business tier.

---

## 4. Onboarding a New VA Customer (Manual Flow)

This is the process for the first customer (or any customer where you are directly involved):

1. Customer registers at `app.carinaai.uk/register`. Their workspace and 15-day trial are created automatically.

2. Customer completes the 3-step onboarding wizard (business name, channel connection, first task).

3. Open `admin.carinaai.uk` and navigate to `/customers`. Confirm the workspace appears.

4. Open `/customers/[id]` to review their trial status and initial configuration.

5. Open `/va-queue`. If the customer's Aiva worker needs a human VA to be assigned or briefed, the task appears here. Action it: assign a VA, set up the handover document, and complete the task.

6. The customer opens `app.carinaai.uk/aiva`. Their worker is live.

7. Before day 12, check `/customers/[id]` to see if the customer is engaging. Reach out proactively if they have not activated any channels or sent any messages.

---

## 5. Deployment

### Full stack deploy (core + ops + app + scout + marketing)

```bash
cd /opt/lampp/htdocs/verlox/carina
bash scripts/deploy-carina.sh
```

This syncs all services via rsync to the VPS, builds the Next.js apps, runs migrations, and restarts Docker containers.

### Marketing-only deploy (fastest, no Docker rebuild)

```bash
cd /opt/lampp/htdocs/verlox/carina
bash scripts/deploy-marketing.sh carina
```

Use this after any change to `03-frontends/marketing/carinaai.uk/` only.

### What each deploy step does

1. rsync `core.carinaai.uk` to VPS (excludes `.env`, `node_modules`, `/data/`)
2. Build `ops.carinaai.uk` locally (`pnpm build`), rsync to VPS
3. Build and deploy `app.carinaai.uk` (standalone Next.js, migrations run on startup)
4. rsync `console.labyrinthscout.com` and `scout-engine`
5. rsync marketing sites (`carinaai.uk`, `docs.carinaai.uk`, `labyrinthscout.com`)
6. On VPS: `docker compose up -d --build` (or rolling restart per service)

### Critical rule

Never edit files directly on the VPS. All changes must be made locally, committed to git, and deployed via the scripts above. Direct VPS edits diverge from git history and cause merge conflicts on the next deploy.

### Checking what is running

```bash
ssh aman
docker ps
```

Key container names in production:
- `carina-web` - core API (port 3000)
- `carina-cloud` - app.carinaai.uk (port 4100)
- `carina-admin` - admin.carinaai.uk (port 4200)
- `carina-ops` - ops.carinaai.uk (port 4001)
- `labyrinth-scout` - Scout server (port 4444)
- `carina-hub` - Skills Hub (port 3001)
- `carina-nginx` - Nginx reverse proxy (ports 80, 443)
- `postgres` - PostgreSQL 16
- `redis` - Redis 7

---

## 6. The Pricing Architecture (Internal Context)

### Two tracks

The pricing page at `carinaai.uk/pricing` separates two distinct audiences:

**Track 1: Build with Carina** (developers, technical users)
- Carina Core: free, self-hosted
- Scout Monitor: GBP 49/mo (external AI governance)
- Scout Govern: GBP 79/mo (custom governance rules)
- Enterprise: custom

**Track 2: Run an Aiva** (business owners, non-technical)
- Starter: GBP 49/mo (1 Aiva worker, 2000 messages)
- Team: GBP 99/mo (5 workers, 10000 messages)
- Business: GBP 299/mo (unlimited, training, custom governance rules)
- Enterprise: custom

### What "built-in governance" means on Aiva plans

Aiva plans include governance monitoring built into the Carina runtime: volume spike detection, escalation rate tracking, unauthorized tool detection, operator kill switch, and a full cryptographic audit log. This is NOT a Scout subscription. Scout at `labyrinthscout.com` is the standalone product for self-hosters who want governance external to their own instance.

Approved wording:
- Starter/Team badge: "Governance monitoring included"
- Business badge: "Custom governance rules included"
- FAQ answer: "Aiva plans include built-in governance monitoring and a full audit log. Scout is the separate product for teams self-hosting Carina."

### What the audit log actually is

Each message and action is stored with a SHA-256 content hash in the `aiva_audit_log` table on the core PostgreSQL database. The hash makes individual records tamper-evident (any modification breaks the hash). There is no blockchain. No customer data leaves VERLOX infrastructure. Audit logs are available on request.

---

## 7. Key Environment Variables (Reference)

All env vars live in `~/apps/core.carinaai.uk/.env` on the VPS. Never commit `.env` to git.

| Variable | Purpose | Where set |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe API secret (sk_live_...) | core.carinaai.uk |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | core.carinaai.uk |
| `STRIPE_PRICE_AIVA_*_MONTHLY` | Price IDs for each plan/interval | core.carinaai.uk |
| `STRIPE_PRICE_AIVA_*_ANNUAL` | Price IDs for annual billing | core.carinaai.uk |
| `AIVA_BILLING_ENABLED` | Set to 'false' to disable checkout | core.carinaai.uk (omit to enable) |
| `RESEND_API_KEY` | Email sending (trial emails, invoices) | core.carinaai.uk |
| `DB_PASSWORD` | PostgreSQL password | all services |
| `ADMIN_PASSWORD` | ops.carinaai.uk login password | ops service |
| `SESSION_SECRET` | ops.carinaai.uk session signing key | ops service |
| `SCOUT_API_KEY` | Shared secret between Carina and Scout | carina-web + labyrinth-scout |
| `NGINX_ADMIN_IP_ALLOWLIST` | IP-restrict admin.carinaai.uk (false at GTM) | nginx config |

---

## 8. Common Operational Tasks

### Check trial status for a customer

```bash
ssh aman
docker exec -it postgres psql -U carina -d carina_central \
  -c "SELECT workspace_id, tier, status, trial_ends_at, NOW() - trial_ends_at AS overdue FROM aiva_subscriptions ORDER BY created_at DESC LIMIT 20;"
```

### Manually extend a trial

```bash
ssh aman
docker exec -it postgres psql -U carina -d carina_central \
  -c "UPDATE aiva_subscriptions SET trial_ends_at = NOW() + INTERVAL '7 days' WHERE workspace_id = 'WORKSPACE_ID';"
```

### Manually reactivate a suspended workspace

Do this only after confirming payment has been arranged. Use the Stripe portal or set directly:

```bash
docker exec -it postgres psql -U carina -d carina_central \
  -c "UPDATE aiva_subscriptions SET status = 'active', tier = 'starter' WHERE workspace_id = 'WORKSPACE_ID';"
```

Then restart any paused workers from `admin.carinaai.uk/fleet`.

### View recent email sends (trial cron logs)

```bash
ssh aman
docker logs carina-web --tail 200 | grep "\[aiva:trial"
```

### Check Stripe webhook delivery

Go to `dashboard.stripe.com` > Developers > Webhooks > select the endpoint > Events tab. Failed events can be resent from there.

---

## 9. What to Do When Something Breaks

| Symptom | Likely cause | Where to look |
|---|---|---|
| Customer says Aiva stopped working | Trial expired or payment failed | `admin.carinaai.uk/customers/[id]` then `aiva_subscriptions` table |
| Checkout button does nothing | Stripe env vars not set | Check `STRIPE_SECRET_KEY` and price IDs in `.env` |
| Webhook not firing | Stripe endpoint misconfigured | Stripe Dashboard > Developers > Webhooks |
| Trial emails not sending | Resend API key missing or cron crashed | Check `RESEND_API_KEY`, check `docker logs carina-web` |
| Worker paused but subscription is active | Sync issue between Stripe and DB | Run `activateAivaSubscription()` manually or use admin panel |
| ops.carinaai.uk not loading | `carina-ops` container down | `ssh aman && docker ps && docker logs carina-ops` |
| admin.carinaai.uk not loading | `carina-admin` container down | `ssh aman && docker ps && docker logs carina-admin` |
| Schema migration not applied | New inline migration not run | Restart `carina-web` (migrations run at startup via `runMigrations()`) |

---

## 10. What Is Not Built Yet (Operational Gaps as of 2026-06-25)

| Gap | Impact | What is needed |
|---|---|---|
| Stripe credentials not set on VPS | No payment collected after trial | Set 8 env vars (see Section 3) |
| Custom domain automation | Business customers need manual nginx config per domain | Cursor prompt pending: `sprint-7-custom-domains.md` |
| admin.carinaai.uk not in deploy script | Deploy does not build/sync the Next.js admin panel | Add deploy step to `scripts/deploy-carina.sh` |
| VA onboarding wizard in admin | New VA setup requires direct DB work | Cursor prompt written: `sprint-7-admin-va-setup-wizard.md` |

---

*Last updated: 2026-06-25. Owner: VERLOX internal.*
