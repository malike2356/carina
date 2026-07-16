# Environment variable inventory

Last updated: 2026-06-25

No secret values in this file. Names only.

## core.carinaai.uk

| Variable | Description | Secret | Required |
|----------|-------------|--------|----------|
| DATABASE_URL | PostgreSQL via PgBouncer (`pgbouncer:6432` in Docker prod) | yes | yes |
| POSTGRES_DB | Database name for backup scripts | no | yes |
| POSTGRES_USER | Database user for backup scripts | yes | yes |
| POSTGRES_PASSWORD | Database password | yes | yes |
| PORT | HTTP port (default 4000) | no | no |
| NODE_ENV | `production` or `development` | no | yes |
| PGBOUNCER_ENABLED | `1` routes apps through PgBouncer | no | prod |
| STRIPE_SECRET_KEY | Stripe secret API key | yes | yes |
| STRIPE_WEBHOOK_SECRET | Stripe webhook signing secret | yes | yes |
| STRIPE_PRICE_AIVA_STARTER_MONTHLY | Stripe price ID | no | yes |
| STRIPE_PRICE_AIVA_STARTER_ANNUAL | Stripe price ID | no | yes |
| STRIPE_PRICE_AIVA_TEAM_MONTHLY | Stripe price ID | no | yes |
| STRIPE_PRICE_AIVA_TEAM_ANNUAL | Stripe price ID | no | yes |
| STRIPE_PRICE_AIVA_BUSINESS_MONTHLY | Stripe price ID | no | yes |
| STRIPE_PRICE_AIVA_BUSINESS_ANNUAL | Stripe price ID | no | yes |
| AI_WORKERS_ENABLED | `false` disables Aiva routes | no | no |
| EMAIL_INGESTION_ENABLED | Per-Aiva IMAP connect API, digest storage, and poll cron (all workspaces) | no | no |
| EMAIL_INGESTION_PILOT_WORKSPACE_IDS | Comma-separated workspace UUIDs for IMAP pilot when global flag is false | no | no |
| AIVA_EMAIL_POLL_CRON | Cron for Carina IMAP poll (Europe/London); default every 5 min | no | no |
| AIVA_EMAIL_POLL_LIMIT | Max unseen messages per worker per poll cycle | no | no |
| PROPREENEUR_BRIDGE_ENABLED | Read-only Propreneur portfolio tools and HTTP bridge | no | no |
| PROPREENEUR_BRIDGE_WRITES | Propose deal/compliance/financial writes via bridge (pending review in Propreneur) | no | no |
| BRAIN_KNOWLEDGE_SKILLS_ENABLED | Load `kb-*` skills from synced brain into property-uk pack | no | no |
| BRAIN_KNOWLEDGE_PATH | Override Carina mirror knowledge directory | no | no |
| PROPREENEUR_BRIDGE_BASE_URL | Optional override for bridge base URL (local dev) | no | no |
| PROPREENEUR_CENTRAL_URL | Central Propreneur URL for Tier 3 auto-bridge resolve (default https://{PROPREENEUR_TENANT_BASE_DOMAIN}) | no | no |
| PROPREENEUR_AUTO_BRIDGE_SECRET | Shared secret with Propreneur `AIVA_AUTO_BRIDGE_SECRET` for email-matched auto-bind | yes | no |
| AIVA_DAILY_SUMMARY_ENABLED | Per-worker Telegram summary cron | no | no |
| AIVA_DAILY_SUMMARY_CRON | Default cron when worker has no summarySchedule (Europe/London) | no | no |
| AIVA_SUMMARY_TTS_MAX_CHARS | Max characters sent to TTS for daily summary audio (default 1500) | no | no |
| PROPREENEUR_EVENT_WEBHOOKS | Accept signed POST webhooks from Propreneur tenants at /api/aiva/webhooks/propreneur | no | no |
| PROPREENEUR_WEBHOOK_HMAC_SECRET | Shared HMAC secret (must match Propreneur tenant integrations.aiva.webhook_secret) | yes | no |
| AIVA_BILLING_ENABLED | Billing enforcement flag | no | staging |
| AIVA_GRACE_PERIOD_DAYS | Days before suspend after payment failure | no | no |
| RESEND_API_KEY | Transactional email | yes | yes |
| POSTMARK_INBOUND_WEBHOOK_TOKEN | Email channel webhook verify | yes | prod |
| WHATSAPP_APP_SECRET | Meta webhook signature | yes | prod |
| WHATSAPP_WEBHOOK_VERIFY_TOKEN | Meta hub challenge | yes | prod |
| SLACK_SIGNING_SECRET | Slack request verify | yes | prod |
| TELEGRAM_WEBHOOK_SECRET | Telegram secret token header | yes | prod |
| SCOUT_BASE_URL | Scout API base URL | no | yes |
| SCOUT_API_KEY | Scout API key | yes | yes |
| SCOUT_OPS_TOKEN | Scout analytics callback token | yes | yes |
| AIVA_SCOUT_FLEET_ENABLED | Register Aivas with Scout fleet | no | no |
| AIVA_CHAIN_ATTEST_ENABLED | On-chain activity attestation | no | no |
| ADMIN_TOKEN_SECRET | Admin JWT signing (match admin app) | yes | yes |
| ADMIN_SETUP_TOKEN | Bootstrap admin operator | yes | yes |
| APP_URL | Public app.carinaai.uk URL | no | yes |
| CORS_ORIGIN | Comma-separated CORS allowlist | no | prod |
| ANTHROPIC_API_KEY | Primary LLM provider | yes | yes |
| OPENAI_API_KEY | Fallback LLM / cheap tasks | yes | no |
| BACKUP_REMOTE | Backblaze B2 rclone path (default `backblaze:verlox-backups/postgres/daily`) | no | prod |
| WAL_REMOTE | WAL archive rclone path | no | no |
| BACKUP_ALERT_EMAIL | Restore-test and size-warning alerts | no | prod |
| CRON_HEARTBEAT_PATH | Override cron heartbeat file path | no | no |
| SENTRY_DSN_CORE | Sentry DSN for core backend | yes | no |
| SENTRY_AUTH_TOKEN | Sentry auth token for source map uploads | yes | no |
| SENTRY_ORG | Sentry org slug (source maps) | no | no |
| SENTRY_PROJECT_CORE | Sentry project slug for core | no | no |

## app.carinaai.uk

| Variable | Description | Secret | Required |
|----------|-------------|--------|----------|
| CARINA_CORE_URL | Internal core backend URL | no | yes |
| CARINA_USE_CORE_PROXY | `true` to proxy logs, terminal, MCP, cron to core | no | prod |
| CARINA_OPS_TOKEN | Bearer for core `/api/ops/*`; must match core `CARINA_OPS_TOKEN` | yes | when proxy on |
| CARINA_INTERNAL_KEY | Internal webhooks; match core if set | yes | no |
| BETTER_AUTH_SECRET | Session signing secret | yes | yes |
| DATABASE_URL | Cloud app Postgres | yes | yes |
| NEXT_PUBLIC_APP_URL | Public URL | no | yes |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | Stripe publishable key | no | yes |
| SENTRY_DSN_APP | Sentry DSN (server) | yes | no |
| NEXT_PUBLIC_SENTRY_DSN | Sentry DSN (browser, consent-gated) | no | no |
| SENTRY_AUTH_TOKEN | Source map uploads at build | yes | no |

## admin.carinaai.uk

| Variable | Description | Secret | Required |
|----------|-------------|--------|----------|
| ADMIN_CORE_URL | Internal core URL (`127.0.0.1` on VPS) | no | yes |
| ADMIN_SESSION_SECRET | Admin session signing | yes | yes |
| ADMIN_TOKEN_SECRET | Must match core | yes | yes |
| ADMIN_SETUP_TOKEN | Must match core | yes | yes |
| NEXT_PUBLIC_APP_URL | Public admin URL | no | yes |
| SENTRY_DSN_ADMIN | Sentry DSN | yes | no |
| SENTRY_AUTH_TOKEN | Source map uploads at build | yes | no |

### Post-GTM security (VPS `.env`; documented only until nginx geo blocks are restored)

| Variable | Description | Secret | Required |
|----------|-------------|--------|----------|
| NGINX_ADMIN_IP_ALLOWLIST | `false` at GTM launch; set `true` after GTM per `docker/config/gtm-rollout.json` | no | no |
| NGINX_STAGING_IP_ALLOWLIST | Same for `staging.*` vhosts | no | no |

Sync production values with `docker/scripts/sync-docker-env.py` and `sync-ops-env.py`.

### Propreneur bridge binding (Carina side)

1. Enable on Propreneur tenant: platform flag `aiva_external_bridge`; issue Carina remote API key.
2. On Carina: set `PROPREENEUR_BRIDGE_ENABLED=true` (and `AI_WORKERS_ENABLED=true`).
3. Bind Aiva: `POST /api/aiva/workers/{id}/propreneur/bind` with `tenantSlug` + `apiKey` (validates portfolio read before save).
4. Enable daily summary: `POST /api/aiva/email/summary/config/{workerId}` with `{ "enabled": true, "summarySchedule": "0 7 * * *" }` and `AIVA_DAILY_SUMMARY_ENABLED=true`.
5. Email ingestion: use Propreneur `/settings/email-ingestion` when bound; Carina IMAP connect returns 409 for bound workers.
6. Phase 2 writes (optional): set Propreneur `aiva_bridge_writes` + `aiva_bridge_review_queue` and Carina `PROPREENEUR_BRIDGE_WRITES=true`. Aiva tools create proposals only; approve at Propreneur **Settings > Aiva bridge review**.
