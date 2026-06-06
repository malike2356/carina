# Multi-Tenancy System

## Overview
Propreneur uses **database-per-tenant** multi-tenancy via the `stancl/tenancy` v3.10 package. Each tenant gets their own PostgreSQL database, ensuring complete data isolation and security.

**Package:** `stancl/tenancy` v3.10  
**Config:** `config/tenancy.php`  
**Central Tenant Model:** `App\Models\Central\Tenant`  
**Domain Model:** `App\Models\Central\Domain`  

## Architecture

```
┌─────────────────────┐     ┌──────────────────────────┐
│  Central DB         │     │  Tenant DB (propreneur_t_1) │
│  (propreneur_central) │     │                          │
│                     │     │  - properties             │
│  - tenants          │     │  - contacts               │
│  - domains          │     │  - deals                  │
│  - subscriptions    │     │  - compliance_items       │
│  - users (platform) │     │  - users                  │
└─────────────────────┘     │  - pipeline_*              │
                            │  - carina_conversations    │
                            └──────────────────────────┘
```

## Central Database

**Connection name:** `central`  
**Database name:** `propreneur_central`

### Central Tables

| Table | Purpose |
|-------|---------|
| `tenants` | Tenant records (id, slug, company_name, plan, etc.) |
| `domains` | Domain/subdomain records linked to tenants |
| `subscriptions` | Tenant subscription/plan data (Stripe) |
| `users` | Platform-level admin users (for central admin panel) |
| `sessions` | Central login sessions |

### Tenant Model

```php
class Tenant extends BaseTenant implements TenantWithDatabase
{
    use HasDatabase, HasDomains;

    protected $connection = 'central';

    public static function getCustomColumns(): array
    {
        return [
            'id',
            'slug',           // Required - used for domain resolution
            'company_name',
            'owner_name',
            'owner_email',
            'plan',           // starter | professional | enterprise
            'trial_ends_at',
            'is_active',
        ];
    }
}
```

### Domain Model

```php
class Domain extends Model
{
    protected $connection = 'central';
    protected $fillable = ['domain', 'tenant_id'];
    
    public function tenant()  // belongsTo(Tenant::class)
}
```

The `domain` column stores the hostname portion used for resolution. For subdomain-based tenancy, this is just the subdomain (e.g., `test`), not the full hostname. The central_domains list in config `tenancy.php` excludes these.

## Tenant Database

**Naming convention:** `propreneur_t_{tenant_id}`  
**Connection:** Dynamic - switched at runtime when tenant is resolved

Each tenant database contains ALL application tables: `properties`, `contacts`, `deals`, `compliance_items`, `pipeline_*`, `users`, `carina_*`, `settings`, `activities`, etc.

### Database Bootstrappers

When tenancy is initialised, these bootstrappers run (configured in `config/tenancy.php`):

```php
'bootstrappers' => [
    \Stancl\Tenancy\Bootstrappers\DatabaseTenancyBootstrapper::class,  // DB connection switch
    \Stancl\Tenancy\Bootstrappers\CacheTenancyBootstrapper::class,    // Cache prefix
    \Stancl\Tenancy\Bootstrappers\FilesystemTenancyBootstrapper::class, // File isolation
    \Stancl\Tenancy\Bootstrappers\QueueTenancyBootstrapper::class,    // Queue isolation
],
```

## Domain Resolution

**Resolver:** `Stancl\Tenancy\Middleware\InitializeTenancyBySubdomain`

### Flow

1. Request arrives at `test.propreneur.test:8000`
2. Middleware extracts `test` from hostname (first segment before first dot)
3. Queries `domains` table: `SELECT * FROM domains WHERE domain = 'test'`
4. Resolves tenant via `domain.tenant_id`
5. Initialises tenant database connection
6. Bootstrappers run (DB, cache, filesystem, queue)
7. Request continues to controller

### Central Domains (excluded from tenant resolution)

```php
'central_domains' => [
    'propreneur.test',
    'propreneur.co.uk',
    'v2.propreneur.co.uk',
    '127.0.0.1',
    'localhost',
],
```

Any hostname matching these (exactly) will NOT be treated as a tenant subdomain. Only subdomains like `test.propreneur.test` will trigger tenant resolution.

## Config: `config/tenancy.php`

```php
return [
    'tenant_model' => App\Models\Central\Tenant::class,
    'id_generator' => \Stancl\Tenancy\UUIDGenerator::class,  // UUID v4
    'domain_model' => App\Models\Central\Domain::class,
    
    'central_domains' => [
        'propreneur.test',
        'propreneur.co.uk',
        'v2.propreneur.co.uk',
        '127.0.0.1',
        'localhost',
    ],
    
    'bootstrappers' => [ ... ],  // As above
];
```

## Artisan Commands

| Command | Purpose |
|---------|---------|
| `php artisan tenants:migrate --tenants=test` | Run tenant migrations for specific tenant |
| `php artisan tenants:migrate` | Run migrations for ALL tenants |
| `php artisan tenants:list` | List all tenants with domains |
| `php artisan tenants:seed --tenants=test` | Run tenant seeder |

## Creating a New Tenant

```php
$tenant = Tenant::create([
    'id' => 'test',
    'slug' => 'test',
    'company_name' => 'Test Company',
    'plan' => 'starter',
    'is_active' => true,
]);

$tenant->domains()->create(['domain' => 'test']);

// Create database and run migrations
Artisan::call('tenants:migrate', ['--tenants' => ['test']]);
```

## Known Issues & Fixes

### Missing `getTenantMigrationPaths` Method

In v3.10, the `Tenancy` facade does NOT have a `getTenantMigrationPaths()` method (it was present in older versions). The AppServiceProvider previously called:

```php
Tenancy::getTenantMigrationPaths()->prepend(database_path('migrations/tenant'));
```

**Fix:** Removed this call. The package automatically discovers tenant migrations from `database/migrations/tenant/` via the `DealsWithMigrations` trait.

### Slug Column

The `tenants` table has a non-nullable `slug` column. When creating tenants, you MUST provide a `slug` value. The slug is used for the tenant identifier in URLs and must be unique.

### Tenant Database Name

By default, stancl/tenancy uses the tenant ID as the database name with a prefix. The `tenancy_db_name` in the `data` JSON column can override this. However, in v3.10, the database name is auto-generated, so the `data` field doesn't need to include `tenancy_db_name` explicitly - but if set, it takes precedence.

## Application tenant guards (2026-04-30)

Stancl middleware switches the database context early in the tenant lifecycle. Additional behaviour runs **after** resolution:

- **`App\Http\Middleware\IdentifyTenantMiddleware`** is attached only to **authenticated** tenant routes in `routes/tenant.php`. It confirms the tenant is active, enforces trial vs subscription (redirect to `tenant.trial-expired` when appropriate), and logs `tenant_request`. Guest auth routes omit this middleware so login remains reachable when the workspace is expired.
- **`App\Services\Tenancy\TenantResolutionService`** returns the current central tenant row for guards and services.
- **`App\Services\Tenancy\TenantCreationService`** provisions a new tenant: central record, domain, isolated PostgreSQL database, tenant migrations, and bootstrap seed (roles via tenant permission migration).

**Tenant settings:** generic key-value storage per tenant lives in `tenant_settings` (tenant migration `2026_04_30_000001_create_tenant_settings_table`), separate from central platform settings.

See also `brain/knowledge/16-global-search-and-ui-runtime.md`.

Self-service **workspace signup** on the central host: `brain/knowledge/21-central-workspace-self-registration.md`.

## Related

- Tenant migrations: `database/migrations/tenant/`
- Models: `App\Models\Central\Tenant`, `App\Models\Central\Domain`
- Seeders: `database/seeders/Tenant/TenantBootstrapSeeder.php`