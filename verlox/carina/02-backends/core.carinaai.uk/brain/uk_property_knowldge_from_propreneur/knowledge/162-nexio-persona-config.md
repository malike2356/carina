# Nexio persona config (Phase 4)

Config-driven workspace modes on the central `tenants.persona` column. Modes filter sidebar navigation, dashboard reporting widgets, and Carina baseline context without deleting data.

## Config

`config/personas.php` - slugs: `mixed` (**Propreneur Ultimo**, description: Full platform), `hmo`, `btl`, `sourcer`, `mentor`, plus Phase 7 modes. Each defines:

- `hidden_modules` - persona feature keys (second layer on top of plan `@can` / `$canNav`)
- `carina_persona` - appended in `CarinaBaselineContextService`
- `dashboard_widgets` - optional filter in `DashboardWidgetService`
- `knowledge_tags` - Carina context tags
- `min_billing_modules` - plan gate for mode switch UI
- `description` - optional short tagline (e.g. Ultimo: **Full platform**)

**Propreneur Ultimo** (`mixed`): persona filter off; plan gates still apply. Not a separate product or tier - toggle in Settings → Workspace mode (tenant admin).

## Services

- `App\Services\Persona\PersonaService` - visibility, mode switch eligibility (delegates to `PersonaWorkspaceModeSwitchPolicy`), analytics (`workspace.persona_set`, `workspace.mode_switch`, `feature.first_use`)
- `App\Services\Persona\PersonaWorkspaceModeSwitchPolicy` - minimum workspace age before **Settings → Workspace mode** appears
- `config/persona_workspace.php` - default `mode_switch_min_workspace_age_days` (env `PERSONA_MODE_SWITCH_MIN_DAYS`, default **0** = rule off)
- Platform admin → **System settings** → **Workspace personas** (`#sec-workspace-persona`); link also on **Feature flags** header. Persists `persona.mode_switch_min_workspace_age_days`. Set **0** to disable; **30** restores legacy behaviour.
- `App\Support\Persona\PersonaModuleMap` - maps hidden keys ↔ billing modules ↔ widget types

## UI

Settings → Workspace → **Workspace mode** (`tenant.settings.workspace.mode`) - tenant admin only. Locked modes show upgrade message when `min_billing_modules` are missing from the plan.

**Platform admin override:** **Tenant management** → edit workspace → **Workspace mode** dropdown (ignores plan locks; same `tenants.persona` column).

## Tests

- `tests/Feature/PersonaConfig/PersonaNavigationFilterTest.php`
- `tests/Feature/PersonaConfig/PersonaColumnMigrationTest.php`

## Apply locally

```bash
cd propreneur-v2
php artisan config:clear
php artisan migrate
php artisan test tests/Feature/PersonaConfig/
```
