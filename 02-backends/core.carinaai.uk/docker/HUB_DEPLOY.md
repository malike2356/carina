# Skills Hub deploy runbook (hub.carinaai.uk)

Deploy the Carina Skills Hub on the Contabo VPS (80.190.81.208, user `malike`). All changes are made locally in git and pushed via `deploy.sh`; never edit VPS files by hand except one-time operator setup below.

## Prerequisites

- `carina-core` supervisor service already running on the VPS
- Postgres 16 reachable on port 5433 (same instance as Carina)
- DNS A/AAAA record: `hub.carinaai.uk` -> VPS IP

## Steps

### 1. Add hub env vars to VPS `.env`

SSH to the VPS and edit `/home/malike/apps/core.carinaai.uk/.env`. Add or confirm:

```bash
SKILLS_HUB_PORT=3001
SKILLS_HUB_DATABASE_URL=postgresql://carina:secret@localhost:5433/carina_skills_hub
SKILLS_HUB_PUBLISH_KEY=<random 32-char hex secret>
HUB_STRIPE_SECRET_KEY=<Stripe secret key>
HUB_STRIPE_WEBHOOK_SECRET=<Stripe webhook signing secret>
HUB_CHECKOUT_SUCCESS_URL=https://hub.carinaai.uk/?purchase=success
HUB_CHECKOUT_CANCEL_URL=https://hub.carinaai.uk/?purchase=cancel
```

Generate a publish key locally:

```bash
openssl rand -hex 16
```

### 2. Install supervisor config

From your local clone, copy `docker/supervisor/carina-hub.conf` to the VPS:

```bash
scp docker/supervisor/carina-hub.conf malike@80.190.81.208:/tmp/carina-hub.conf
ssh malike@80.190.81.208 'sudo cp /tmp/carina-hub.conf /etc/supervisor/conf.d/carina-hub.conf'
```

Edit placeholders in `/etc/supervisor/conf.d/carina-hub.conf` if you prefer env in supervisor over `.env`, then reload:

```bash
ssh malike@80.190.81.208 'sudo supervisorctl reread && sudo supervisorctl update'
```

### 3. Create the Postgres database (one-time)

On the VPS, connect as a superuser or the `carina` role and create the hub database if it does not exist:

```bash
psql postgresql://carina:secret@localhost:5433/postgres -tc "SELECT 1 FROM pg_database WHERE datname='carina_skills_hub'" | grep -q 1 || \
  psql postgresql://carina:secret@localhost:5433/postgres -c 'CREATE DATABASE carina_skills_hub;'
```

Hub migrations run automatically on first `carina-hub` startup.

### 4. Obtain TLS certificate

```bash
sudo certbot certonly --nginx -d hub.carinaai.uk
```

If `hub.carinaai.uk` is already covered by the `carinaai.uk` certificate SAN list, skip this step and reuse `/etc/nginx/ssl/live/carinaai.uk/`.

### 5. Enable nginx vhost

```bash
sudo cp /home/malike/apps/core.carinaai.uk/docker/nginx/hub.carinaai.uk.conf /etc/nginx/sites-available/hub.carinaai.uk.conf
sudo ln -sf /etc/nginx/sites-available/hub.carinaai.uk.conf /etc/nginx/sites-enabled/hub.carinaai.uk.conf
sudo nginx -t && sudo systemctl reload nginx
```

### 6. Deploy from local machine

From `core.carinaai.uk/` on your workstation:

```bash
bash deploy.sh
```

For a hub-only restart after a small change:

```bash
bash deploy.sh --hub-only
```

### 7. Smoke test

```bash
curl -s https://hub.carinaai.uk/api/registry | head -c 500
```

Expect JSON with `packCount` greater than 0. Also open `https://hub.carinaai.uk/` in a browser for the Hub UI.

Check supervisor:

```bash
ssh malike@80.190.81.208 'sudo supervisorctl status carina-hub'
```

### 8. Register Stripe webhook

In [Stripe Dashboard](https://dashboard.stripe.com/webhooks), add an endpoint:

- URL: `https://hub.carinaai.uk/api/webhooks/stripe/packs`
- Events: `checkout.session.completed`, `payment_intent.payment_failed`

Copy the signing secret into `HUB_STRIPE_WEBHOOK_SECRET` in `.env`, then restart:

```bash
ssh malike@80.190.81.208 'sudo supervisorctl restart carina-hub'
```

## Troubleshooting

| Symptom | Check |
|---|---|
| `502 Bad Gateway` | `sudo supervisorctl status carina-hub`; `curl http://127.0.0.1:3001/api/registry` on VPS |
| Empty registry | Hub logs: `tail -30 /var/log/supervisor/carina-hub.err.log` |
| Stripe webhook 400 | nginx must use `proxy_request_buffering off` on `/api/webhooks/stripe/packs` |
| DB connection refused | Postgres on 5433; `SKILLS_HUB_DATABASE_URL` matches credentials |
