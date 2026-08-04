# HMO Fire Safety - UK (Carina / Nexio)

Tags: `hmo`, `fire_safety`, `compliance`

## Regulatory basis

- **Regulatory Reform (Fire Safety) Order 2005** - responsible person must assess and manage fire risk.
- **Fire Safety Act 2021** - clarifies that external walls and fire doors are within scope of the FRA for multi-occupied residential buildings.

## Routine testing (typical HMO operator schedule)

| Activity | Frequency | Nexio log type |
|---|---|---|
| Fire alarm test | Weekly | `fire_alarm_test` |
| Fire door inspection (FD30) | Quarterly | `fire_door_inspection` |
| Emergency lighting | Monthly | `emergency_lighting` |
| Fire risk assessment review | Annual (or after material change) | `fra_review` |

BS 5839 provides guidance on fire detection systems; document pass/fail and remedial actions.

## Propreneur

- `fire_safety_logs` table per property with `next_due_at`
- Overdue logs feed compliance score and dashboard widgets
- Carina tool: `get_fire_log_status`

When advising operators, emphasise documented evidence for council inspections and insurance.
