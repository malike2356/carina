# SOP-009: Cron Workflows

VPS-level cron jobs that support Carina platform operations.
All jobs run on the Contabo VPS (80.190.81.208) as the deploy user.

## Jobs

### 1. Metered billing usage report

Reports month-to-date platform event counts to Stripe for all active partner accounts.
Uses `action: 'set'` so running the job twice in a day does not double-count.

```cron
0 2 * * * curl -s -X POST https://core.carinaai.uk/internal/billing/report-usage \
  -H "Authorization: Bearer $CARINA_OPS_TOKEN" \
  -H "Content-Type: application/json" \
  >> /var/log/carina/metered-billing.log 2>&1
```

Time: 02:00 UTC daily.
To report for a single partner only, add `--data '{"partnerId":"<uuid>"}'` to the curl command.

Requires:
- `CARINA_OPS_TOKEN` set in the deploy environment (see `.env.production`)
- `STRIPE_PRICE_PLATFORM_EVENTS_METERED` set (see `SOP-008` or `.env.production.example`)
- Partner account has `stripe_metered_item_id` populated (set by `attachMeteredBilling`)

Log rotation: add `/var/log/carina/metered-billing.log` to logrotate if it grows large.

### 2. Author earnings calculation (month-end)

Calculates author earnings from premium pack installs and upserts into `author_earnings`.
Run at month-end. Stripe Connect payout from this ledger is a future sprint.

```cron
0 3 1 * * curl -s -X POST https://core.carinaai.uk/internal/billing/calculate-author-earnings \
  -H "Authorization: Bearer $CARINA_OPS_TOKEN" \
  -H "Content-Type: application/json" \
  >> /var/log/carina/author-earnings.log 2>&1
```

Time: 03:00 UTC on the 1st of each month.
To recalculate for a specific month: add `--data '{"billingMonth":"2026-06"}'`.

### 3. Platform health probe (every minute)

Run from the ops machine (NOT from inside the Docker stack - so VPS outages are detected).

```cron
* * * * * curl -s -X POST https://core.carinaai.uk/internal/ops/health-probe \
  -H "Authorization: Bearer $CARINA_OPS_TOKEN" \
  >> /var/log/carina/health-probe.log 2>&1
```

Probes `platform_api`, `core_api`, `app_frontend` per invocation.
Results are stored in `platform_health_checks` and surfaced at `GET /api/v1/platform/status`.
90-day retention: run the following monthly to keep the table lean:
```sql
DELETE FROM platform_health_checks WHERE checked_at < NOW() - INTERVAL '90 days';
```

### 4. SLA report (month-end review trigger)

Not automated - run manually after the month-end or via curl to review:
```
curl -s "https://core.carinaai.uk/internal/ops/sla-report?month=2026-06" \
  -H "Authorization: Bearer $CARINA_OPS_TOKEN"
```

If `slaBreach: true`, review `creditDuePartners` and apply Stripe credits manually
via `stripe.customers.createBalanceTransaction`. Only automate after three clean months.

## Adding new cron jobs

1. Add the cron line to the deploy user's crontab on the VPS: `crontab -e`
2. Document it here with: schedule, endpoint, auth header, log destination, dependencies
3. Commit this file so the cron setup is reproducible
