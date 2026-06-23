# Nexio Fire Safety Logs and Awaab's Law -- Phase 2b

Builds on `brain/knowledge/157-nexio-hmo-compliance-engine.md`.

---

## Fire safety logs

### Table: `fire_safety_logs`

Discriminator `log_type`: `fire_alarm_test`, `fire_door_inspection`, `emergency_lighting`, `fra_review`.

| Log type | Next due interval |
|---|---|
| Fire alarm test (BS 5839 weekly) | 7 days |
| Fire door inspection (FD30) | 90 days |
| Emergency lighting | 30 days |
| FRA review | 365 days |

Service: `App\Services\Properties\FireSafetyService`

Overdue fire alarm tests: `createOverdueTask()` creates a `compliance_items` row (type `fire_alarm`) as follow-up. Daily command: `nexio:fire-safety-overdue`.

### Routes

| Method | Path | Name |
|---|---|---|
| GET | `/properties/{property}/fire-safety` | `tenant.properties.fire-safety.index` |
| POST | `/properties/{property}/fire-safety/alarm-test` | `tenant.properties.fire-safety.alarm-test` |
| POST | `/properties/{property}/fire-safety/door-inspection` | `tenant.properties.fire-safety.door-inspection` |
| POST | `/properties/{property}/fire-safety/emergency-lighting` | `tenant.properties.fire-safety.emergency-lighting` |
| POST | `/properties/{property}/fire-safety/fra-review` | `tenant.properties.fire-safety.fra-review` |

View: `resources/views/tenant/properties/fire-safety/index.blade.php`

### Compliance score integration

`HmoComplianceService::scoreFireSafety()` uses `FireSafetyService::getOverdueLogs()` first. Any overdue log forces score 0 / red. Otherwise uses latest fire alarm log `next_due_at`, then falls back to compliance item `fire_alarm`.

---

## Awaab's Law SLA

### Maintenance request columns

`awaabs_law_applies`, `awaabs_24h_due_at`, `awaabs_14d_due_at`, `awaabs_24h_met_at`, `awaabs_14d_met_at`

Triggered when `category` is `damp_mould` or `category_one_hazard`.

Service: `App\Services\Properties\AwaabsLawService`

- 24h: landlord response / assessment from `created_at`
- 14d: repair completion when status becomes `completed`

UI partial: `resources/views/tenant/portfolio/maintenance-requests/partials/awaabs-law-sla.blade.php` on maintenance show page.

### Notifications

`AwaabsLawSlaReminderNotification` when:
- 24h due within 2 hours and `awaabs_24h_met_at` is null
- 14d due within 48 hours and `awaabs_14d_met_at` is null

Command: `nexio:awaabs-law-reminders` (hourly).

---

## Tests

- `tests/Feature/Properties/FireSafetyLogTest.php`
- `tests/Feature/Properties/AwaabsLawTest.php`
