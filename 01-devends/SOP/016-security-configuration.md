# SOP 016: Security Configuration
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** Migrated from planning/security/SECURITY_CONFIGURATION_GUIDE.md
**Last reviewed:** 2026-06-25

---

# Security configuration completion guide

Step-by-step guide for the remaining items in `SOP/017-security-hardening-checklist.md` that need operator configuration, not more code.

## Quick status check

```bash
# From carina repo root
bash scripts/verify-security-config.sh vps
```

## 1. Cryptographic audit log (tamper-evident PostgreSQL)

Aiva built-in governance includes a cryptographic audit log: each agent action is hashed with SHA-256 and stored in a tamper-evident PostgreSQL table. No external chain or wallet is required.

Verify the audit log is active:

```bash
ssh aman 'cd ~/apps/core.carinaai.uk && docker compose -f docker-compose.prod.yml exec -T carina-web node -e "const {runMigrations}=require(\"./dist/memory/migrations\"); runMigrations().then(()=>console.log(\"OK\"))"'
```

The `fleet/attestation` view in `admin.carinaai.uk` shows the audit log entries.

## 2. Alert channels (honeypot, stale marker, trust failures)

Minimum recommended: email via Resend.

```bash
SCOUT_ALERT_TO_EMAIL=your-ops@email.com \
  bash scripts/complete-production-security.sh vps
```

This also:
- Copies `RESEND_API_KEY` from Carina core to Scout if Scout's copy is empty
- Sets `SCOUT_CORS_ORIGIN` and Carina `CORS_ORIGIN`

Test delivery:

```bash
ssh aman 'cd /home/malike/apps/console.labyrinthscout.com && npm run doctor'
# Alert channel credentials should show: Email

# Fire test alert (Scout)
curl -X POST https://console.labyrinthscout.com/api/admin/alert-test \
  -H "X-Scout-Key: ${SCOUT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"severity":"critical","instance_id":"config-test"}'
```

## 3. Resend inbound webhook signature (Carina)

1. In [Resend dashboard](https://resend.com/webhooks), create webhook pointing to `https://core.carinaai.uk/webhooks/email/inbound`
2. Copy the Svix signing secret (`whsec_...`)
3. Apply:

```bash
RESEND_WEBHOOK_SECRET=whsec_your_secret \
SCOUT_ALERT_TO_EMAIL=your-ops@email.com \
  bash scripts/complete-production-security.sh vps
```

## 4. Scout and Carina CORS (production)

Handled by `complete-production-security.sh`:

| Variable | Production value |
|----------|------------------|
| `SCOUT_CORS_ORIGIN` | `https://console.labyrinthscout.com,https://carinaai.uk,https://labyrinthscout.com` |
| `CORS_ORIGIN` (Carina) | `https://core.carinaai.uk` |

## 5. Rotate Scout secrets (quarterly)

```bash
bash scripts/rotate-scout-secrets.sh vps
bash scripts/post-deploy-security-check.sh vps
```

Record the rotation in your private operator log (see section 9).

## 6. Channel credential audit before production

Before enabling any channel in Carina `.env`:

| Channel | Required vars | Webhook secret required in production |
|---------|---------------|--------------------------------------|
| Email inbound | `EMAIL_CHANNEL_WEBHOOK_SECRET` | yes |
| Home Assistant | `HA_CHANNEL_WEBHOOK_SECRET` | yes |
| Webhook channel | `WEBHOOK_CHANNEL_SECRET` | yes |
| API channel | `API_CHANNEL_API_KEY` | yes |
| Telegram | `TELEGRAM_BOT_TOKEN` | platform-managed |
| Slack | `SLACK_SIGNING_SECRET` | yes |
| Discord | `DISCORD_PUBLIC_KEY` | yes |

Leave channels disabled (`*_ENABLED=false`) until secrets are set.

## 7. Post-deploy checks (automate)

After any deploy touching security code:

```bash
bash scripts/post-deploy-security-check.sh vps
```

Deploy scripts now remind you to run this at the end.

## 8. Keep secrets out of the repo

- Never commit `.env`, `.env.bak-*`, or private keys.
- Deploy scripts exclude `.env` from rsync (already configured).
- Add to `.gitignore` locally if you keep operator logs in the repo tree:

```
.env.bak-*
operator-trust-log.md
```

## 9. Operator logbook and SLA

- Maintain a private operator log recording: secret rotations, security incidents, alert acknowledgements.
- Adopt response targets from `SOP/018-security-incident-sla.md`.

## Deploy latest security code to VPS

When Scout security code changes:

```bash
cd console.labyrinthscout.com
bash scripts/deploy-scout.sh
bash ../scripts/complete-production-security.sh vps
bash ../scripts/post-deploy-security-check.sh vps
```
