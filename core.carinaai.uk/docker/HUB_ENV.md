# Hub Environment Variables

All variables are consumed by the carina-hub supervisor process and the
Docker carina-hub service.

## Required

| Variable | Description | Example |
|---|---|---|
| SKILLS_HUB_PORT | Port the hub server listens on | 3001 |
| SKILLS_HUB_DATABASE_URL | PostgreSQL connection string | postgresql://carina:secret@localhost:5433/carina_skills_hub |
| SKILLS_HUB_PUBLISH_KEY | 32-char secret for pack publishing API | (generate with: openssl rand -hex 16) |

## Stripe (optional - required only for paid packs)

| Variable | Description |
|---|---|
| HUB_STRIPE_SECRET_KEY | Stripe secret key (sk_live_...) |
| HUB_STRIPE_WEBHOOK_SECRET | Stripe webhook signing secret (whsec_...) |
| HUB_CHECKOUT_SUCCESS_URL | Redirect after successful payment |
| HUB_CHECKOUT_CANCEL_URL | Redirect after cancelled payment |
| HUB_PACK_AUTHOR_REVENUE_SHARE_BPS | Author share in basis points (7000 = 70%) |
| HUB_PACK_CARINA_REVENUE_SHARE_BPS | Carina platform share (2000 = 20%) |
| HUB_PACK_PLATFORM_FEE_BPS | Payment processor fee estimate (1000 = 10%) |

## Security scanner (optional)

| Variable | Description | Default |
|---|---|---|
| CARINA_HUB_SANDBOX_SCAN | Run JS blocks through worker sandbox | false |

## DNS

Add a CNAME or A record for hub.carinaai.uk pointing to 80.190.81.208
in Cloudflare. The nginx config at docker/nginx/hub.carinaai.uk.conf
handles TLS termination.

## TLS certificate

The nginx config references /etc/letsencrypt/live/carinaai.uk/. If
hub.carinaai.uk is already covered by the wildcard cert, no additional
cert is needed. If not:

    sudo certbot certonly --nginx -d hub.carinaai.uk

## VPS supervisor deploy

1. Copy supervisor/carina-hub.conf to /etc/supervisor/conf.d/ on the VPS
2. Fill in the CHANGE_ME values in the environment= line
3. sudo supervisorctl reread && sudo supervisorctl update
4. sudo supervisorctl start carina-hub

## Docker Compose deploy (Verlox personal stack)

    docker compose -f docker-compose.prod.yml -f docker-compose.verlox.yml up -d carina-hub

Set HUB_PUBLISH_KEY, HUB_STRIPE_SECRET_KEY etc. in your .env file or
pass via environment before running compose.
