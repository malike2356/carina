# Secret rotation procedure

Last updated: 2026-06-24

## When to rotate

- **Immediately:** secret committed to git, logged, or shared
- **Annually:** `BETTER_AUTH_SECRET`, `ADMIN_SESSION_SECRET`, `ADMIN_TOKEN_SECRET`, `ADMIN_SETUP_TOKEN`
- **On departure:** shared admin tokens and hosting credentials
- **On Stripe notice:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

## How to rotate

### Session secrets (app + admin)

1. Generate: `openssl rand -base64 48`
2. Update `.env` on VPS for the affected app
3. Recreate container: `docker compose -f docker-compose.prod.yml up -d carina-cloud-staging` (or prod service)
4. All users must sign in again

### ADMIN_TOKEN_SECRET / ADMIN_SETUP_TOKEN (core + admin)

1. Generate new values
2. Update core `.env` and admin `.env` in the same maintenance window
3. Redeploy core and admin apps
4. Re-bootstrap admin operator if setup token changed

### STRIPE_SECRET_KEY

1. Create restricted key in Stripe Dashboard
2. Update `STRIPE_SECRET_KEY` in core `.env`
3. Redeploy `carina-web`
4. Revoke old key after smoke test (checkout + webhook)

### STRIPE_WEBHOOK_SECRET

1. Roll endpoint signing secret in Stripe
2. Update `STRIPE_WEBHOOK_SECRET` in core `.env`
3. Redeploy `carina-web`
4. Send test webhook from Stripe Dashboard

### Database password

1. `ALTER USER` in Postgres
2. Update `POSTGRES_PASSWORD`, `DATABASE_URL`, PgBouncer `userlist.txt`
3. Run `sync-docker-env.py`
4. Restart `postgres`, `pgbouncer`, `carina-web`, `carina-cloud`

### RESEND / channel webhooks

1. Rotate in provider dashboard
2. Update env vars in core `.env`
3. Redeploy `carina-web`
4. Update Meta/Slack/Telegram webhook config if verify tokens changed

## Verification

- `GET /health` returns 200
- Sign in to app and admin
- Stripe test checkout completes
- Inbound channel webhook test succeeds
