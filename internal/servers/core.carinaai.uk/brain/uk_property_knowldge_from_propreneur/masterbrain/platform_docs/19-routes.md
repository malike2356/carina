# Route Structure

## Overview

**2026-05-01:** Carina tenant JSON route names are asserted in **`tests/Unit/Carina/CarinaModuleRoutesTest.php`** (no DB); human-readable tables live in **`brain/knowledge/08-carina.md`**.

**2026-04-30:** The PHP snippets in the "Tenant Routes" section below are **illustrative** and drift from the live file. Authoritative maps: `routes/web.php`, `routes/tenant.php`. **Tenant route map (billing, subscription gating, modules):** **`brain/knowledge/22-tenant-route-map.md`**. Onboarding, invitations, workspace-admin JSON: **`brain/knowledge/19-tenant-workspace-onboarding-invitations-and-admin-api.md`**.

**2026-05-02:** Tenant reporting **web** routes: `GET /reporting` (`tenant.reporting.index`), `GET /reporting/reports`, POST `reporting/definitions`, POST `reporting/definitions/{definition}/generate`, GET `reporting/executions/{execution}/download`. Gated like the JSON API (`subscription.feature:reporting_intelligence`, `feature:reporting_intelligence`). See **`brain/knowledge/34-reporting-analytics-module.md`**.

Propreneur uses two distinct route files - one for central (platform) routes and one for tenant-scoped routes. All tenant routes require subdomain-based tenancy resolution.

**Route files:**
- `routes/web.php` - Central domain routes (platform auth, admin panel, health)
- `routes/tenant.php` - Tenant-scoped routes (loaded by `TenancyServiceProvider` with stancl middleware)

## Route Naming Convention

All routes follow the pattern: `{domain}.{module}.{action}`

| Prefix | Domain | Example |
|--------|--------|---------|
| `tenant.*` | Tenant (subdomain) | `tenant.dashboard`, `tenant.properties.index` |
| `central.*` | Central (root domain) | `central.admin.dashboard` |

## Tenant Routes (`routes/tenant.php`)

### Guest Routes (no auth required)

```php
Route::middleware('guest')->group(function () {
    // Authentication
    Route::get('/login', [AuthController::class, 'showLogin'])->name('tenant.login');
    Route::post('/login', [AuthController::class, 'login']);
    
    // Password Reset
    Route::get('/password/forgot', [PasswordController::class, 'showForgot'])->name('tenant.password.request');
    Route::post('/password/email', [PasswordController::class, 'sendResetLink'])->name('tenant.password.email');
    Route::get('/password/reset/{token}', [PasswordController::class, 'showReset'])->name('tenant.password.reset');
    Route::post('/password/reset', [PasswordController::class, 'reset'])->name('tenant.password.update');
});
```

### Authenticated Routes (auth + IdentifyTenantMiddleware)

```php
Route::middleware(['auth', IdentifyTenantMiddleware::class])->group(function () {
    Route::get('/search', TenantSearchController::class)->name('tenant.search');

    // Dashboard
    Route::get('/', [DashboardController::class, 'index'])->name('tenant.dashboard');
    
    // Authentication
    Route::post('/logout', [AuthController::class, 'logout'])->name('tenant.logout');
    
    // CRUD: Properties
    Route::resource('properties', PropertyController::class)->names('tenant.properties');
    
    // CRUD: Contacts
    Route::resource('contacts', ContactController::class)->names('tenant.contacts');
    
    // CRUD: Deals
    Route::resource('deals', DealController::class)->names('tenant.deals');
    Route::get('/deals/{deal}/carina', [DealController::class, 'carina'])->name('tenant.deals.carina');
    
    // CRUD: Compliance
    Route::resource('compliance', ComplianceController::class)->names('tenant.compliance');
    
    // Pipelines (web board + deals; JSON API in routes/tenant/pipeline_api.php)
    Route::prefix('pipelines')->name('tenant.pipelines.')->group(function () {
        Route::get('/', [PipelineController::class, 'index'])->name('index');
        Route::get('/{pipeline}', [PipelineController::class, 'show'])->name('show');
        Route::post('/{pipeline}/deals', [PipelineController::class, 'storeDeal'])->name('deals.store');
        Route::patch('/{pipeline}/deals/{deal}/move', [PipelineController::class, 'moveDeal'])->name('deals.move');
        Route::delete('/{pipeline}/deals/{deal}', [PipelineController::class, 'destroyDeal'])->name('deals.destroy');
    });
    
    // Carina AI
    Route::get('/carina', [CarinaController::class, 'index'])->name('tenant.carina.index');
    Route::get('/carina/{conversation}', [CarinaController::class, 'show'])->name('tenant.carina.show');
    Route::post('/carina', [CarinaController::class, 'store'])->name('tenant.carina.store');
    Route::post('/carina/{conversation}/chat', [CarinaController::class, 'chat'])->name('tenant.carina.chat');
    
    // Settings
    Route::get('/settings', [SettingsController::class, 'index'])->name('tenant.settings.index');
    Route::put('/settings', [SettingsController::class, 'update'])->name('tenant.settings.update');
});
```

## Route Registration (actual layout)

- **Central and platform admin:** defined in `routes/web.php` (health, theme CSS endpoints, `/platform/*` auth, `/admin/*` panel). Registered via `bootstrap/app.php` `withRouting(web: routes/web.php)`.
- **Platform backups:** `routes/admin_backup.php` (included under `/admin`), feature **`platform_backup_dr`**, grants **`view-backups`** / **`manage-backups`**; route names `admin.backups.*` (jobs, destinations, schedules, download, restore, delete).
- **Platform UI hub:** **`admin.ui.theme`**, **`admin.ui.components`**, **`admin.ui.accessibility`** (middleware: **`platform.grant:access-admin-ui-lab`**, feature **`admin_design_system_lab`**); workspace presets **`admin.theme.presets.*`** (**`ThemePresetController`**, feature **`central_theme_presets`**). When both labs apply, **`GET /admin/theme/presets`** may redirect to the theme hub with `#workspace-presets`.
- **Filament:** auto-registered under **`/filament`** (`AdminPanelProvider`), `platform` guard - tenant DB tooling for RAG/Carina resources; see **`brain/knowledge/26-filament-carina-rag-admin.md`**.
- **Tenant application:** defined in `routes/tenant.php`. The file is loaded inside `App\Providers\TenancyServiceProvider` with stancl middleware (`InitializeTenancyBySubdomain`, `PreventAccessFromCentralDomains`, `web`). There is no `routes/central.php` in this project.

Guest paths on tenants include `/login` and password reset; authenticated groups add `IdentifyTenantMiddleware` (see `routes/tenant.php`).

## Middleware Pipeline

### Tenant Route Middleware

```php
[
    'web',                                                  // Sessions, CSRF, cookies
    InitializeTenancyBySubdomain::class,                    // Resolve tenant from subdomain
    PreventAccessFromCentralDomains::class,                 // Reject central domain access
    'guest' / 'auth',                                       // Authentication gate
]
```

### Route Model Binding

Many routes use **implicit route model binding** (where type-hinted on the action):
- `{property}` → `App\Models\Tenant\Property` instance
- `{contact}` → `App\Models\Tenant\Contact` instance
- `{deal}` on **`/deals/*`** → `App\Models\Tenant\DealAnalysis` (Deal Engine)
- `{deal}` on **`/pipelines/{pipeline}/deals/*`** → `App\Models\Tenant\PipelineDeal` (Kanban card)
- `{item}` on **`/compliance/*`** → `App\Models\Tenant\ComplianceItem` instance
- `{pipeline}` → `App\Models\Tenant\Pipeline` instance
- `{stage}` on **`/api/pipeline/stages/{stage}`** → `App\Models\Tenant\PipelineStage` instance

These are scoped to the current tenant's database automatically.

## Route List Reference

To see all routes:
```bash
php artisan route:list
```

To see only tenant routes:
```bash
php artisan route:list --path=tenant
```

## Route Model Binding Notes

- All tenant models use **UUID primary keys**
- Route model binding is **tenant-aware** - it queries within the current tenant's database
- Soft-deleted models are excluded by default (use `->withTrashed()` in controller if needed)

## Named Route Usage Examples

```blade+php
{{-- In views --}}
<a href="{{ route('tenant.properties.show', $property) }}">View</a>
<form action="{{ route('tenant.contacts.store') }}" method="POST">

{{-- In controllers --}}
return redirect()->route('tenant.dashboard');
return redirect()->route('tenant.compliance.show', $item);

{{-- Resourceful shortcuts --}}
route('tenant.deals.index')
route('tenant.deals.create')
route('tenant.deals.store')
route('tenant.deals.show', $deal)
route('tenant.deals.edit', $deal)
route('tenant.deals.update', $deal)
route('tenant.deals.destroy', $deal)
```

## Important Implementation Details

1. The `tenant.deals.carina` route is NOT a standard resource method - it's a custom route `GET /deals/{deal}/carina`
2. Pipeline item move uses `PATCH` method, not `PUT`, since it's a partial update
3. All POST/PUT/DELETE routes require `@csrf` in Blade forms
4. Route model binding expects model class to be registered - all tenant models use `App\Models\Tenant\` namespace
5. The `guest` and `auth` middleware are applied within the tenant route group, so they operate on the tenant's session, not the central session