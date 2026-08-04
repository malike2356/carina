# Aiva hosted inbound email (operator setup)

Note: Cloudflare is now the preferred low-cost inbound provider. Use `AIVA-HOSTED-EMAIL-CLOUDFLARE.md` for the current setup. Keep this Mailgun guide only as a fallback provider option.

One-time Mailgun setup for automatic Aiva email addresses. End users never see this.

## Why this scales

Every Aiva gets an alias like `ama-9f2a1b@inbox.hireaiva.co.uk`. That is not a Mailgun mailbox. Mailgun uses one catch-all inbound route for the whole subdomain. Our app maps the recipient to a worker row in `aiva_hosted_email_addresses`. You do not create individual Mailgun mailboxes per Aiva.

## One-time Mailgun setup

1. Add domain: `inbox.hireaiva.co.uk` in Mailgun.
2. Configure the DNS records Mailgun provides:
   - MX
   - SPF
   - DKIM
   - tracking CNAME if Mailgun asks for it
3. Create a catch-all inbound route:
   - Match recipient: `.*@inbox.hireaiva.co.uk`
   - Action: forward to webhook
     - Preferred app proxy: `https://admin.hireaiva.co.uk/api/aiva/email/inbound/mailgun`
     - Or core directly: `https://core.carinaai.uk/api/aiva/email/inbound/mailgun`
4. Set `MAILGUN_WEBHOOK_SIGNING_KEY` in production from the Mailgun HTTP webhook signing key.
5. Confirm env:
   - `AIVA_HOSTED_EMAIL_ENABLED=true`
   - `AIVA_HOSTED_EMAIL_DOMAIN=inbox.hireaiva.co.uk`
   - `AIVA_HOSTED_EMAIL_PROVIDER=mailgun`
6. Hire or backfill an Aiva, then send a test email to its generated address.

## Backfill existing workers

```bash
cd carina/verlox/carina/02-backends/core.carinaai.uk
pnpm carina aiva-email-addresses backfill
pnpm carina aiva-email-addresses status --json
```

The backfill command is idempotent. It prints counts only (no message bodies, no secrets).

## Operator status

`carina doctor` includes an `Aiva hosted email` check:

- Hosted email enabled
- Domain configured
- Mailgun signing key present
- Last inbound webhook received (process lifetime)
- Unknown recipient count (process lifetime)

## Product surface

- Default user flow: show the address with Copy and Send test.
- Advanced (optional): Connect Gmail, Outlook, or IMAP for an existing business mailbox.
- Do not show MX, DNS, webhook URLs, or Mailgun wording in the normal Aiva worker UI.
