# Email DNS and deliverability (carinaai.uk)

Canonical helpers live in `src/email/deliverability/` (vendored from `shared/email/`).

## Domain separation

| Role | Preferred sender | Env |
| --- | --- | --- |
| Transactional (receipts, resets, security) | `mail.carinaai.uk` (or current `EMAIL_FROM`) | `EMAIL_FROM` |
| Marketing / nurture | `updates.carinaai.uk` | `EMAIL_MARKETING_FROM` |

Code rejects marketing sends that use the transactional `mail.*` / `receipts.*` identity when `EMAIL_DELIVERABILITY_ENFORCE` is not `false`.

Set:

```env
EMAIL_APP_DOMAIN=carinaai.uk
EMAIL_FROM=noreply@mail.carinaai.uk
EMAIL_MARKETING_FROM=hello@updates.carinaai.uk
EMAIL_FROM_NAME=Carina by VERLOX
RESEND_API_KEY=re_...
RESEND_PREVIEW_MODE=false
```

During migration, apex `noreply@carinaai.uk` remains allowed for transactional mail until the `mail.` subdomain is verified in Resend.

## SPF / DKIM / DMARC

Generate and validate programmatically:

- Ops: `GET /api/ops/email-deliverability/status` (authorizeOps)
- Ops: `POST /api/ops/email-deliverability/validate-dns` with `{ "domain": "mail.carinaai.uk" }`

### Manual baseline (apex, current Resend domain)

SPF (TXT `@`):

`v=spf1 include:_spf.resend.com ~all`

DKIM: copy `resend._domainkey` value from the Resend dashboard after adding the domain.

DMARC ladder (do not jump straight to reject on a new subdomain):

1. `p=none` (monitor aggregate reports)
2. `p=quarantine` after clean reports
3. `p=reject` when alignment is stable

Example start record (`_dmarc.mail.carinaai.uk`):

`v=DMARC1; p=none; rua=mailto:dmarc@carinaai.uk; adkim=s; aspf=s;`

Current apex example (already stricter; keep until subdomain cutover is planned):

`v=DMARC1; p=quarantine; rua=mailto:lordsesame@gmail.com; ruf=mailto:lordsesame@gmail.com; sp=reject; adkim=s; aspf=s;`

## Warm-up

New sending domains: start at **50 emails/day**, double every **3 days**, for 2-4 weeks. The warm-up schedule is returned from the ops status endpoint (`warmUp`).

## Monitoring

Delivery webhooks (`/api/webhooks/.../events`) feed an in-process delivery store. Health alerts fire when:

- spam complaint rate proxy > **0.1%**
- inbox placement proxy < **99%**
- hard/block bounce rate > **2%**

Inbox placement is a **proxy** (`delivered / (delivered + spam + bounce)`) until Postmaster or ESP placement signals are wired. Never treat Resend "delivered" as human inbox proof.

## Inbound support (support@carinaai.uk)

Resend sends outbound mail only. Customer mail to `support@carinaai.uk` needs separate inbound setup (MX / Cloudflare Email Routing). Set `CARINA_SUPPORT_EMAIL=support@carinaai.uk` for UI copy.
