# Propreneur v2 - Coder Standards
# Stack: Laravel 12, PHP 8.2+, PostgreSQL 16, Redis, Meilisearch, Vite + Tailwind v4
# Read CLAUDE.md before this. These standards extend it with production and quality rules.

---

## 0. READ FIRST

Read `CLAUDE.md` before touching anything. In particular:
- NEVER run `migrate:fresh`, `db:wipe`, or `migrate:reset` on non-testing databases. `DatabaseWipeGuard` will block it, but do not try.
- Central DB: `propreneur_central`. Tenant DBs: `propreneur_t_{slug}`.
- Never edit files directly on the VPS. Local first, commit, deploy via `git pull`.

---

## 1. PRODUCTION MINDSET

Propreneur v2 is a multi-tenant SaaS serving UK property investors. Real people's business data lives in tenant databases.

"Your users don't care if it works on your machine. They care if it works on theirs."

Production readiness gates before any feature ships:

1. Observability: every significant action is logged. Destructive actions, billing events, and AI calls must have audit log entries with user ID, tenant ID, timestamp, and outcome. Never log passwords, tokens, payment card data, or personal data beyond what is needed for debugging.

2. Error handling: Laravel exception handling must return meaningful messages to users. Never expose stack traces, database queries, or internal paths in production error responses. Every external call (Carina AI, Stripe, Meilisearch) must have a fallback or a graceful failure state.

3. Config hygiene: no hard-coded values. All provider keys, URLs, tenant config, and feature flags live in `.env`. See `.env.example` for the authoritative list.

4. Tenant isolation: a tenant action must never access data from another tenant. Before every query in a tenant context, verify the tenancy middleware has resolved and scoped the connection. Run `pnpm typecheck` (where applicable) and check Telescope queries in dev to confirm no cross-tenant leakage.

5. Canary mindset: new AI integrations, new billing flows, new Carina features - test with the Xelox dev tenant first. Do not enable new features for all tenants without a staged rollout using feature flags.

---

## 2. DEPLOYMENT - NEVER DO THIS MANUALLY

Every deploy goes through the documented flow. Manual deploys cause drift.

```bash
# Local dev only - never run these on the VPS directly
honcho start
php artisan serve --host=propreneur.test --port=8000
```

Production deploy: commit locally, push to git, SSH to VPS, `git pull`, `php artisan migrate --force`, cache clear. Read `brain/knowledge/68-solution-dependencies-and-production-readiness.md` for the full checklist.

Blue-green principle: when shipping significant changes (new tenant flow, billing changes, schema changes), maintain a rollback path. Know which migration is the last safe one. Test migration rollback on a copy of prod data before running forward.

---

## 3. SECURITY - THE 5 MISTAKES WE DO NOT MAKE

1. TRUST THE FRONTEND: hiding a button in the Blade template is not access control. Every controller action must verify the authenticated user has permission to perform that action on that resource. Use Spatie permissions and policy classes. Do not check roles in templates and assume the controller is safe.

2. BROKEN ACCESS CONTROL: every request must verify: who is the user, what is their role, are they in the right tenant, and is this action within their permission set. The `access-admin-ui-lab` feature flag on the UI lab is an example of correct gating - apply the same pattern everywhere.

3. BUSINESS LOGIC ABUSE: property workflows have steps (e.g. deal stages, subscription provisioning, onboarding). Validate that each step can only be reached after its prerequisites. A tenant cannot skip to a paid feature without completing billing. A deal cannot move to completion without required fields.

4. TRUST EXTERNAL SERVICES BLINDLY: AI providers (via `app/Services/Ai/`), Stripe, and Carina - validate every response. Never pass an AI response directly to a database write without validation. Never trust a webhook payload without signature verification.

5. CREDENTIAL EXPOSURE: zero credentials in code, git history, Telescope logs, or error messages. Stripe keys are especially sensitive - the accounting keys and the billing keys are different; see `.env.example`. All AI provider keys rotate; use the vault pattern.

### Propreneur-specific additions:
- GUI-first policy: every admin operation must be reachable from the UI. Do not build terminal-only admin flows. Wrap them in a controller action and route.
- `audit_log` table: all major admin and destructive actions must be recorded. Match the existing pattern in the codebase.
- SSRF: if any feature accepts URLs from users (property links, document sources, integrations), validate and whitelist before making any server-side request.

---

## 4. FORM AND UI STANDARDS

This is a SaaS used by property professionals. They are busy. Forms must work correctly first time, or they will not trust the platform.

Validation rules (decided, not debated):
- Validate on blur: check when the user leaves a field. Not on every keystroke, not only on submit.
- Once wrong, switch to live: clear the error the instant the user fixes it.
- Green confirmation: show a positive check mark when a field is valid. Do not only flag errors.
- Never validate on submit only: filling 10 fields blind then seeing everything turn red causes abandonment.

Password fields:
- Eye toggle to unmask.
- Live strength meter with a requirements checklist.
- Never block paste. Property professionals use password managers.
- Offer a generated password option.

Pre-fetching:
- Dashboard: pre-fetch property summary data, deal counts, and notification count on session start. Do not wait for the user to click.
- CRM: when a user hovers over a contact or deal card, begin fetching the detail view data.
- Billing: pre-load subscription status and available plan details when the user enters the billing section.

---

## 5. THE 8-SECOND TEST

Every time the landing page, onboarding screen, or plan selection page changes, apply this test:

Can a UK property professional who has never seen Propreneur answer these three questions in under 8 seconds:
1. What problem does Propreneur solve for them?
2. How does it solve it?
3. What do they do next (sign up, start trial, upgrade)?

If no: fix the hero copy before anything else. Messaging clarity converts better than any design change.

---

## 6. MULTI-TENANCY RULES

- Central DB (`propreneur_central`): tenants, domains, subscriptions, platform_users.
- Tenant DBs: `propreneur_t_{slug}` - all property, deal, CRM, document, and user data.
- Never write a query in a tenant context that touches the central DB directly unless through the defined cross-tenant service layer.
- Subdomain routing: `{slug}.propreneur.co.uk`. Test every new route with the Xelox tenant before enabling for all.
- Migrations: central migrations in `database/migrations/`, tenant migrations in `database/migrations/tenant/`. Run tenant migrations separately.

---

## 7. AI INTEGRATION RULES

- Never call any AI provider directly from a controller.
- All AI calls go through `app/Services/Ai/`.
- Carina context is built by `CarinaBaselineContextService.php`.
- RAG runs through `RagService.php`.
- Providers: OpenAI, Anthropic, Gemini, DeepSeek, Groq, OpenRouter, Ollama. Multi-provider means the system must not break when one provider is unavailable.
- Log every AI call: provider, model, prompt hash (not the full prompt if it contains PII), token count, outcome.
- AI responses that affect data (property valuations, deal suggestions) must go through human review before being committed to the database.

---

## 8. TESTING

```bash
# Run before every handoff
php artisan test
./vendor/bin/pint   # code style
```

Tests run against `propreneur_testing`. Never against `propreneur_central`.

Coverage requirements:
- All billing flows: subscription creation, upgrade, downgrade, cancellation, webhook handling.
- All tenant isolation paths: verify a tenant cannot access another tenant's data.
- All AI integration failure cases: provider unreachable, invalid response, rate limit.
- All access control paths: verify roles block what they should block.

---

## 9. COMMIT DISCIPLINE

Format: `feat(propreneur): ...` / `fix(tenant): ...` / `fix(billing): ...` / `chore: ...`

Every PR must:
- Specify affected tenant scope (central, tenant, both).
- List migration files included and whether they are reversible.
- Include screenshots for any UI changes.
- Confirm audit_log coverage for any new destructive action.

Never commit: `.env` contents, real tenant data, real email addresses, Stripe live keys, or any credential.
