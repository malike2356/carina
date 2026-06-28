# TB-005: Partner Analytics API

**Sprint:** Tollbooth platform infrastructure
**Phase:** 2 - Open the road to partners
**Depends on:** TB-001 (platform_events), TB-003 (gateway)
**Target repo:** `02-backends/core.carinaai.uk`
**Agent:** Claude Code

---

## Context

Visa sells transaction data back to banks as analytics. Carina must do the same: give
partners visibility into their AI usage so they can optimize, report to clients, and
build products on top of the data. This is not a cost centre; it deepens switching cost.

A partner whose compliance reports reference Carina's audit trail cannot migrate away
without losing their audit history. The analytics API transforms a compliance cost
(writing `platform_events`) into a revenue-generating feature.

Three endpoint groups:
1. Usage analytics: event volume, token consumption, spend by day/model/type
2. Trends: how this partner's usage compares to anonymised platform averages
3. Compliance export: audit-ready export in formats regulators accept

---

## Task

### 1. Usage analytics endpoint

This extends the `GET /api/v1/platform/usage` route added in TB-003. Replace the stub
with a full implementation.

**GET /api/v1/platform/usage**

Auth: partner API key, scope `analytics`

Query params:
- `from` (required): ISO 8601 date, e.g. `2026-06-01`
- `to` (required): ISO 8601 date, e.g. `2026-06-30`
- `groupBy`: `day` | `model` | `event_type` (default: `day`)
- `orgId`: optional, filter to one workspace within the partner's account

Response shape (groupBy=day):
```json
{
  "from": "2026-06-01",
  "to": "2026-06-30",
  "partnerId": "uuid",
  "totals": {
    "events": 12450,
    "tokensIn": 3200000,
    "tokensOut": 800000,
    "toolCalls": 2100,
    "skillCalls": 340,
    "estimatedFeePence": 1245
  },
  "series": [
    { "date": "2026-06-01", "events": 421, "tokensIn": 105000, "tokensOut": 26000 },
    ...
  ]
}
```

Implementation notes:
- Validate `from` and `to` are valid ISO dates. Reject with 400 if not.
- Maximum date range is 90 days. Reject longer ranges with 400 and explain the limit.
- `estimatedFeePence` is `totalEvents * 0.1` (0.1p per event above 50k, simplified).
  The actual invoice is calculated by Stripe. This is an estimate for the dashboard.
- Use parameterised queries. The `orgId` filter must be joined against
  `organizations WHERE partner_id = $partnerId` to prevent partner A accessing
  partner B's workspace data.

SQL for `groupBy=day`:
```sql
SELECT
  DATE_TRUNC('day', created_at) AS day,
  COUNT(*)                      AS events,
  SUM(tokens_in)                AS tokens_in,
  SUM(tokens_out)               AS tokens_out,
  SUM(tool_calls)               AS tool_calls,
  SUM(skill_calls)              AS skill_calls
FROM platform_events
WHERE partner_id = $1
  AND created_at >= $2
  AND created_at <  $3
GROUP BY 1
ORDER BY 1
```

### 2. Trends endpoint

**GET /api/v1/platform/trends**

Auth: partner API key, scope `analytics`

Query params: `from`, `to`

Returns the partner's aggregate metrics alongside anonymised platform medians.
Platform medians must never expose individual partner data. Use:
```sql
SELECT
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY daily_events) AS median_events
FROM (
  SELECT partner_id, DATE_TRUNC('day', created_at), COUNT(*) AS daily_events
  FROM platform_events
  WHERE created_at >= $from AND created_at < $to
  GROUP BY 1, 2
) sub
```

Response shape:
```json
{
  "partner": { "avgDailyEvents": 402, "avgDailyTokensIn": 103000 },
  "platform": { "medianDailyEvents": 218, "medianDailyTokensIn": 60000 },
  "interpretation": "Your usage is above the platform median."
}
```

`interpretation` is a simple string generated from the comparison. No AI generation.
Just: `"Your usage is above/below/at the platform median."` Do not add more prose.

### 3. Compliance export endpoint

**GET /api/v1/platform/export**

Auth: partner API key, scope `analytics`

Query params: `from`, `to`, `format` (`json` | `csv`, default `json`)

Returns all `platform_events` rows for the partner within the date range, in the
requested format. This is an audit-grade export.

For `format=json`, return as a streaming newline-delimited JSON response
(`Content-Type: application/x-ndjson`). Each line is one event row.

For `format=csv`, return a CSV with header row (`Content-Type: text/csv`):
```
id,event_type,org_id,model,provider,tokens_in,tokens_out,tool_calls,
skill_calls,scout_verified,fee_pence,created_at
```

Both formats use `res.setHeader('Content-Disposition', 'attachment; filename=...')`.

Enforce a maximum of 31 days per export request (longer exports should be paginated
or requested as a background job, which is out of scope for this sprint).

---

## Security requirements

- Partner A must never see partner B's data. All queries must filter by `partner_id`
  matching the authenticated key's `partnerId`. The `orgId` filter adds an additional
  join, not a replacement for the `partner_id` filter.
- The export endpoint must log to `audit_log` (if `audit_log` exists in the core DB;
  check `hosted-migrations.ts`). If it does not, add the log call to `platform_events`
  metadata instead.
- Do not include raw `metadata` JSON in CSV exports. The `metadata` column may contain
  user-visible content that is not appropriate for compliance export sharing. Strip it
  from CSV rows.

---

## Done when

- [ ] `GET /api/v1/platform/usage?groupBy=day` returns correct per-day aggregates
- [ ] `GET /api/v1/platform/usage?groupBy=model` returns correct per-model aggregates
- [ ] Date range validation rejects ranges over 90 days
- [ ] `orgId` filter only matches orgs belonging to the authenticated partner
- [ ] `GET /api/v1/platform/trends` returns platform median without leaking partner data
- [ ] `GET /api/v1/platform/export?format=csv` returns a valid CSV file download
- [ ] `GET /api/v1/platform/export?format=json` returns valid NDJSON
- [ ] Export rejects date ranges over 31 days
- [ ] `pnpm build` compiles without TypeScript errors
