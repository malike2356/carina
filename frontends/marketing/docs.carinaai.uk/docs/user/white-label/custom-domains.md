---
sidebar_position: 3
title: Custom domains
description: Serve a branded Carina Cloud workspace on your own hostname.
---

# Custom domains

Serve the browser workspace on a customer hostname (for example `agents.client.example`) while keeping the Carina control plane on platform hosts.

## What this enables

- Customer-branded browser workspace on a custom hostname
- Canonical invite and public URLs on your domain
- Sender name and address from brand settings
- TLS at nginx with host-aware brand resolution in the app

The control plane (`core.carinaai.uk`, `ops.carinaai.uk`) does not become a customer vanity domain.

## Setup (cloud workspace)

1. Open **Settings** as workspace owner (custom domain tools are linked from the brand section).
2. Add a hostname.
3. Publish DNS TXT:
   - Name: `_carina-verify.example.com`
   - Value: `carina-verify=<token>` (shown in UI)
4. Run verification from settings.
5. Mark the domain **canonical** when invite links should use it.

### API (cloud app)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/workspace/domains` | List domains |
| POST | `/api/workspace/domains` | Declare hostname |
| POST | `/api/workspace/domains/:id/verify` | Verify DNS |
| POST | `/api/workspace/domains/:id/canonical` | Set canonical host |
| DELETE | `/api/workspace/domains?id=` | Remove domain |

### API (hosted org on core)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/carina-ops/domains` | List org domains |
| POST | `/api/carina-ops/domains` | Declare hostname |
| POST | `/api/carina-ops/domains/:id/verify` | Verify DNS |
| POST | `/api/carina-ops/domains/:id/canonical` | Set canonical |
| DELETE | `/api/carina-ops/domains/:id` | Remove domain |

## TLS and nginx

1. Verify the domain in Carina first.
2. Issue a certificate (certbot or your process).
3. Render nginx config:

```bash
cd core.carinaai.uk
CARINA_CUSTOM_DOMAINS="agents.client.example" \
  ./docker/scripts/render-custom-domain-nginx.sh > docker/nginx/conf.d/carina-cloud-custom-domains.conf
```

4. Reload nginx.

Template: `docker/nginx/carina-cloud-custom-domains.inc.example`

nginx forwards the original `Host` header. Brand resolution uses `/api/brand` in the app.

## Related

- [Branding](/docs/user/white-label/branding)
- [Support and troubleshooting](/docs/user/white-label/support-and-troubleshooting)
