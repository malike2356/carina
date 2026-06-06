# Nexio HMO dashboard widgets (Phase 4)

Persona-driven dashboard widgets for HMO operators. Wired via `config/personas.php` and `DashboardWidgetService::visibleWidgetsQuery()`.

## Widget types

| Type | Service method | Blade partial |
|------|----------------|---------------|
| `occupancy_board` | `HmoDashboardWidgetService::occupancyBoard()` | `widgets/occupancy_board.blade.php` |
| `hmo_compliance_overview` | `complianceOverview()` | `widgets/hmo_compliance_overview.blade.php` |
| `rent_overdue_by_room` | `rentOverdueByRoom()` | `widgets/rent_overdue_by_room.blade.php` |
| `upcoming_renewals_hmo` | `upcomingRenewals()` | `widgets/upcoming_renewals_hmo.blade.php` |
| `quick_actions_hmo` | `quickActions()` | `widgets/quick_actions_hmo.blade.php` |

## Persona rules

- **`hmo` persona:** only widgets listed in `personas.hmo.dashboard_widgets` (auto-created in `dashboard_widgets` table on first load).
- **`mixed` persona:** default widgets; HMO-only types hidden unless the workspace has HMO properties (`strategy` or `property_type` = hmo).

## Tests

`tests/Feature/Dashboard/HmoDashboardWidgetsTest.php`
