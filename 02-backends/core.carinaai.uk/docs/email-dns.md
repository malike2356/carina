# Email DNS (carinaai.uk)

Add these records at your DNS provider for `carinaai.uk` transactional email deliverability via Resend.

## SPF (TXT record)

- Host: `@`
- Value: `v=spf1 include:_spf.resend.com ~all`

## DKIM (TXT record)

Get the exact value from the Resend dashboard after adding the domain:

- Host: `resend._domainkey`
- Value: `[from Resend dashboard]`

## DMARC (TXT record)

- Host: `_dmarc`
- Value: `v=DMARC1; p=quarantine; rua=mailto:lordsesame@gmail.com; ruf=mailto:lordsesame@gmail.com; sp=reject; adkim=s; aspf=s;`

## Verification

After adding records, verify in Resend dashboard: **Domains -> carinaai.uk -> Verify DNS**.

Verification can take up to 48 hours.

## Application env

Set in core `.env`:

```env
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@carinaai.uk
EMAIL_FROM_NAME=Carina by VERLOX
RESEND_PREVIEW_MODE=false
AIVA_APP_URL=https://admin.hireaiva.co.uk
```

Use `RESEND_PREVIEW_MODE=true` in development to log emails to the console instead of sending.

## Inbound support (support@carinaai.uk)

Resend sends outbound mail only. Customer mail to `support@carinaai.uk` needs separate inbound setup:

1. Add MX records or Cloudflare Email Routing for `carinaai.uk`.
2. Route `support@carinaai.uk` to the operator inbox that VERLOX monitors.
3. Run the live test in `01-devends/operations/aiva-support-inbox-checklist.md`.

Set in app and core `.env` for consistent UI copy:

```env
CARINA_SUPPORT_EMAIL=support@carinaai.uk
```
