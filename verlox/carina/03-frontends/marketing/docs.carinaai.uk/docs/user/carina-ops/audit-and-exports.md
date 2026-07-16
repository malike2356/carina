# Audit log and CSV exports

Carina Ops records org-scoped **product audit** events for vault, workbench, billing, membership, usage, and exports.

## View the audit log

Open `/ops/audit`. Events show time, action, actor email (when available), and redacted details JSON.

## Retention by plan

| Plan | Audit retention |
|---|---|
| Starter | 14 days |
| Team | 90 days |
| Free (no ops console) | Not available |

Events older than your retention window are excluded from the UI and exports.

## Common actions

| Action | Meaning |
|---|---|
| `vault.key_saved` | Provider key added or updated |
| `workbench.run_completed` | Workbench run finished |
| `billing.plan_changed` | Stripe or manual plan change |
| `org.member_invited` | Teammate invite created |
| `exports.audit_downloaded` | Team CSV audit export |
| `exports.usage_downloaded` | Team CSV usage export |

Details never include raw API keys or tokens.

## CSV exports (Team only)

Team plan (including active Team trial) can download:

- **Audit:** `/api/carina-ops/audit/export?format=csv`
- **Usage:** `/api/carina-ops/usage/export?format=csv&days=30`

Use the **Export CSV (Team)** buttons on the Audit and Usage pages. Starter plans receive `402 upgrade_required`.

Export downloads are logged in the audit trail.

## Compliance tip

For long-term compliance archives, schedule periodic Team exports and store them in your own retention system. Carina Ops retention is plan-bound by design.

## Billing note

Audit and usage exports are part of the commercial control plane. They should be driven by the same ledger that records credits and model costs, not by a separate manual report. That keeps billing, audit, and support aligned when model pricing changes.
