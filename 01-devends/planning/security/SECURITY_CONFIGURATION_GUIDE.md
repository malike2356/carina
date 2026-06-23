# Security configuration completion guide

Step-by-step guide for the remaining items in `SECURITY_HARDENING_CHECKLIST.md` that need operator configuration, not more code.

## Quick status check

```bash
# From carina repo root
bash scripts/verify-security-config.sh vps
```

## 1. Fund attester wallet

**Status on VPS:** wallet is already funded if `setup-trust.sh` completed with balance > 0.

```bash
bash scripts/setup-trust.sh vps
```

If balance is 0, fund the printed address via [Coinbase Base Sepolia faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet), then re-run the script.

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
ssh malike@80.190.81.208 'cd /home/malike/apps/console.labyrinthscout.com && npm run doctor'
# Alert channel credentials should show: Email

# Fire test alert (Scout Pro plan)
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

Record the rotation in your private copy of `instructions/operator-trust-log.template.md`.

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

After any deploy touching trust or security code:

```bash
bash scripts/post-deploy-security-check.sh vps
```

Deploy scripts now remind you to run this at the end.

## 8. Trust bootstrap after wallet or env rotation

```bash
bash scripts/setup-trust.sh vps
bash scripts/post-deploy-security-check.sh vps
```

See also `docs.carinaai.uk/docs/user/security/trust-wallet-rotation.md`.

## 9. Operator logbook and SLA

- Copy `instructions/operator-trust-log.template.md` to a private location.
- Adopt targets from `instructions/SECURITY_INCIDENT_SLA.md`.

## 10. Keep secrets out of the repo

- Never commit `.env`, `.env.bak-*`, or wallet private keys.
- Deploy scripts exclude `.env` from rsync (already configured).
- Add to `.gitignore` locally if you keep operator logs in the repo tree:

```
.env.bak-*
instructions/operator-trust-log.md
```

## Deploy latest security code to VPS

The readiness endpoint and trust freshness fields require a Scout deploy:

```bash
cd console.labyrinthscout.com
bash scripts/deploy-scout.sh
bash ../scripts/complete-production-security.sh vps
bash ../scripts/post-deploy-security-check.sh vps
```
