# Nexio Phase 7 - Remaining persona modes

Six lightweight modes wired via `config/personas.php` + marketing landings + Carina knowledge.

| Slug | Label | Landing | Knowledge |
|------|-------|---------|-----------|
| `lodge` | Lodge (SA) | `/lodge.html` | `178-propreneur-lodge-sa-guide.md` |
| `steward` | Steward (block) | `/steward.html` | `179-propreneur-steward-block-guide.md` |
| `agency` | Agency | `/agency.html` | `180-propreneur-agency-letting-agent-guide.md` |
| `forge` | Forge (dev/refurb) | `/forge.html` | `181-propreneur-forge-developer-guide.md` |
| `bridge` | Bridge (R2R) | `/bridge.html` | `182-propreneur-bridge-r2r-guide.md` |
| `hall` | Hall (student) | `/hall.html` | `183-propreneur-hall-student-lettings-guide.md` |

Signup: `/start?persona={slug}` or `LANDING_PERSONA_MAP` in `SignupPersonaService`.

## Harvest (90 days)

| Signal | Action |
|--------|--------|
| Retention > 40% + growing signups | Invest |
| Good signups, retention < 20% | Interview churn, fix once |
| Signups < 5 after 90 days | Remove config key; migrate tenants to `mixed` |

## Tests

`tests/Feature/PersonaConfig/RemainingModesTest.php` (config + nav)

`tests/Feature/PersonaConfig/PersonaDashboardWidgetsTest.php` (dashboard widgets + Carina context for all eight Nexio personas: `btl`, `sourcer`, `lodge`, `steward`, `agency`, `forge`, `bridge`, `hall`)

## Dashboard widgets and Carina (shipped)

- `app/Services/Reporting/PersonaDashboardWidgetService.php` - payload resolvers for persona widget types
- `app/Services/Reporting/DashboardWidgetService.php` - delegates to persona service; `ensurePersonaWidgetRecords()` titles
- Blade partials under `resources/views/tenant/dashboard/widgets/`
- Carina context: `BtlCarinaContextService`, `SourcerCarinaContextService`, `LodgeCarinaContextService`, `StewardCarinaContextService`, `AgencyCarinaContextService`, `ForgeCarinaContextService`, `BridgeCarinaContextService`, `HallCarinaContextService` wired in `CarinaBaselineContextService`
- Lodge tool: `GetSaNightCountTool` (`get_sa_night_count`) registered in `AppServiceProvider`

## Not in scope (Phase 7)

Hall group-tenancy cohort DB field - use standard tenancies + academic dates for now.
