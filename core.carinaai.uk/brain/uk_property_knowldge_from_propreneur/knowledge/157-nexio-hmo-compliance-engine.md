# Nexio HMO Compliance Engine -- Phase 2

## What This Is

Phase 2 of Propreneur Nexio adds a compliance score, HMO licence tracking fields, renewal reminders, and a dashboard widget for HMO operators. It builds on the Room model (Phase 1, `brain/knowledge/156-nexio-room-model.md`).

---

## Database

### `properties` (extended)

| Column | Type | Notes |
|---|---|---|
| `hmo_license_type` | varchar(30) | mandatory / additional / selective |
| `hmo_license_authority` | varchar(100) | issuing council |
| `hmo_license_issued_at` | date | nullable |
| `hmo_license_conditions` | text | nullable |
| `hmo_article4_area` | boolean | Article 4 direction |

Existing columns reused: `hmo_license_number`, `hmo_license_expiry`, `hmo_license_required`.

### `compliance_scores`

| Column | Type | Notes |
|---|---|---|
| `property_id` | FK | cascade delete |
| `score` | tinyint | 0-100 weighted average |
| `status` | varchar(10) | red / amber / green |
| `breakdown` | jsonb | per-area scores |
| `scored_at` | timestamp | snapshot time |

---

## Scoring

Service: `App\Services\Properties\HmoComplianceService`

Areas: `gas_safety`, `eicr`, `epc`, `hmo_licence`, `fire_safety`, `deposit`.

| Condition | Score | Status |
|---|---|---|
| Missing or expired | 0 | red |
| Expires in under 30 days | 50 | red |
| Expires in 30-90 days | 80 | amber |
| Expires in more than 90 days | 100 | green |

HMO properties weight `hmo_licence` and `fire_safety` at 2x.

Overall status: green >= 80, amber >= 50, red < 50.

`fire_safety` reads `compliance_items.type = fire_alarm`. `hmo_licence` uses `properties.hmo_license_expiry` with fallback to compliance item `hmo_license`.

---

## Commands and schedule

| Command | Schedule |
|---|---|
| `nexio:hmo-compliance-score` | Daily 05:30 |
| `nexio:hmo-licence-renewal-reminders` | Daily 08:15 |

Renewal reminders at 90, 30, 14, 7 days before `hmo_license_expiry`. Uses `HmoLicenceRenewalNotification` (mail + database). Deduped via cache key per property, threshold, and expiry date.

---

## Routes

Under `tenant.properties.nexio.compliance.*`:

| Method | Path | Action |
|---|---|---|
| GET | `/properties/{property}/hmo-compliance` | `HmoComplianceController@show` |
| POST | `/properties/{property}/hmo-compliance/rescore` | `HmoComplianceController@rescore` |

Gated by `$property->isHmo()`.

---

## Dashboard widget

Type: `hmo-compliance-overview` in `DashboardWidgetService`.

Blade: `resources/views/tenant/dashboard/widgets/hmo-compliance-overview.blade.php`

Included on workspace dashboard when HMO properties exist. Shows portfolio average score, void rooms, upcoming licence renewals, and flagged areas.

---

## Tests

`tests/Feature/Properties/HmoComplianceScoreTest.php`

---

## Related (prompt 206)

Fire safety logs and Awaab's Law SLA: `brain/knowledge/158-nexio-fire-safety-and-awaabs-law.md`

## Not in this phase

- Room size compliance (prompt 207)
