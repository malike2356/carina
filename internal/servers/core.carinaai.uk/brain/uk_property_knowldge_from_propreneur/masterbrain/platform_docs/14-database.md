# Database Schema

## Overview
Propreneur uses PostgreSQL 16.13 with a **multi-tenant** architecture. The central database (`propreneur_central`) stores platform-level data, and each tenant has an isolated database (`propreneur_t_{id}`) containing their application data.

## Central Database (`propreneur_central`)

### Schema: `public`

### `domains`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `domain` | VARCHAR(255) | UNIQUE, NOT NULL |
| `tenant_id` | VARCHAR(255) | FK → tenants(id), NOT NULL |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

### `tenants`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | VARCHAR(255) | PK |
| `slug` | VARCHAR(255) | UNIQUE, NOT NULL |
| `company_name` | VARCHAR(255) | |
| `owner_name` | VARCHAR(255) | |
| `owner_email` | VARCHAR(255) | |
| `plan` | VARCHAR(50) | DEFAULT 'starter' |
| `trial_ends_at` | TIMESTAMP | |
| `is_active` | BOOLEAN | DEFAULT true |
| `data` | JSONB | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

### Central: flags, themes, typed settings, billing (2026-04-30)

**`feature_flags`** - Catalogue rows synced from `App\Support\PlatformFeatureCatalogue` (`key` unique, `label`, `description`, `enabled`, `scope` `global|per_tenant|beta`, `tenant_overrides` JSON). Drives `feature:{key}` middleware and `FeatureFlag::isEnabled()`.

**`theme_presets`** - Named design bundles (`slug` unique, `variables` JSON, `is_default`, `is_dark_mode`, `is_high_contrast`).

**`tenant_theme_overrides`** - One row per `tenant_id` FK: chosen `preset_id`, optional `overrides` JSON, `is_active`.

**Typed settings (central)** - `setting_definitions` (schema per `key`: `type`, `category`, `default_value`, `validation_rules` JSON, `is_public`); `settings` (resolved values; global rows have `tenant_id` null with partial unique index on `key` under PostgreSQL); `setting_audit_logs` (change trail with `actor_id` FK to `platform_users`).

**Billing (central)** - `subscription_plans` (catalogue: `slug`, `price`, `currency`, `interval`, `features` JSON); `subscriptions` (tenant subscription rows; FK to plan where migrated); `subscription_usage` (metering); `invoices`. JSON API surface: `brain/knowledge/17-billing-api.md`.

**AI / BYOK (2026-05-01)** - `ai_providers` (enabled slugs aligned with `config('ai.providers')`, optional keys and `is_platform_default`); `tenant_ai_settings` (per-tenant default provider and `provider_overrides`); `ai_usage_logs` (token and cost telemetry). Migration: `2026_05_01_150000_create_ai_byok_tables.php`. Detail: `brain/knowledge/23-ai-runtime-and-provider-registry.md`.

### Other central tables
- `cache` / `cache_locks` - Laravel cache
- `failed_jobs` - Queue failed jobs
- `job_batches` - Queue batch tracking
- `jobs` - Queue jobs table
- `migrations` - Migration tracking
- `password_reset_tokens` - Central password resets
- `personal_access_tokens` - API tokens
- `sessions` - Session storage
- `platform_users` - Platform admin guard users (Spatie `roles` / `permissions` on guard `platform`; see central migrations `2026_04_30_200000_*`)
- `platform_settings` - Legacy key/value platform configuration

## Tenant Database (`propreneur_t_{id}`)

All tables below are re-created per tenant.

### `properties`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `address_line1` | VARCHAR(255) | |
| `address_line2` | VARCHAR(255) | |
| `city` | VARCHAR(100) | |
| `county` | VARCHAR(100) | |
| `postcode` | VARCHAR(20) | |
| `country` | VARCHAR(100) | DEFAULT 'UK' |
| `latitude` | DECIMAL(10,7) | |
| `longitude` | DECIMAL(10,7) | |
| `property_type` | VARCHAR(50) | |
| `bedrooms` | INTEGER | |
| `bathrooms` | INTEGER | |
| `reception_rooms` | INTEGER | |
| `sqft` | INTEGER | |
| `sqm` | DECIMAL(10,2) | |
| `tenure` | VARCHAR(50) | freehold, leasehold, share_of_freehold |
| `lease_years_remaining` | INTEGER | |
| `garden` | BOOLEAN | |
| `parking` | VARCHAR(100) | |
| `epc_rating` | VARCHAR(5) | A-G |
| `epc_potential_rating` | VARCHAR(5) | |
| `epc_expiry` | DATE | |
| `status` | VARCHAR(50) | |
| `strategy` | VARCHAR(50) | btl, brr, hmo, sa, r2r, flip, commercial, development, land |
| `purchase_price` | DECIMAL(12,2) | |
| `current_value` | DECIMAL(12,2) | |
| `mortgage_balance` | DECIMAL(12,2) | |
| `monthly_mortgage` | DECIMAL(10,2) | |
| `monthly_rent` | DECIMAL(10,2) | |
| `gross_yield` | DECIMAL(6,4) | Calculated |
| `net_yield` | DECIMAL(6,4) | Calculated |
| `roi_percentage` | DECIMAL(6,4) | |
| `monthly_cashflow` | DECIMAL(10,2) | |
| `annual_cashflow` | DECIMAL(12,2) | |
| `rooms_count` | INTEGER | HMO rooms |
| `hmo_license_required` | BOOLEAN | |
| `hmo_license_number` | VARCHAR(100) | |
| `hmo_license_expiry` | DATE | |
| `land_registry_id` | VARCHAR(100) | |
| `last_sold_price` | DECIMAL(12,2) | |
| `last_sold_date` | DATE | |
| `source` | VARCHAR(100) | |
| `source_url` | TEXT | |
| `notes` | TEXT | |
| `carina_summary` | TEXT | |
| `created_by` | UUID | FK → users |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |
| `deleted_at` | TIMESTAMP | Soft delete |

### `deal_analyses`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `property_id` | UUID | FK → properties(id) |
| `title` | VARCHAR(255) | |
| `strategy` | VARCHAR(50) | |
| `status` | VARCHAR(50) | potential, analysing, live, closed_won, closed_lost |
| `metrics` | JSONB | |
| `notes` | TEXT | |
| `carina_summary` | TEXT | |
| `created_by` | UUID | FK → users |
| `timestamps` | | |
| `deleted_at` | TIMESTAMP | Soft delete |

### `contacts`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `first_name` | VARCHAR(100) | NOT NULL |
| `last_name` | VARCHAR(100) | NOT NULL |
| `email` | VARCHAR(150) | |
| `phone` | VARCHAR(30) | |
| `mobile` | VARCHAR(30) | |
| `company` | VARCHAR(150) | |
| `type` | VARCHAR(50) | |
| `address_line1` | VARCHAR(200) | |
| `city` | VARCHAR(100) | |
| `postcode` | VARCHAR(10) | |
| `source` | VARCHAR(100) | |
| `notes` | TEXT | |
| `assigned_to` | UUID | FK → users |
| `created_by` | UUID | FK → users |
| `tags` | JSONB | |
| `custom_fields` | JSONB | |
| `timestamps` | | |
| `deleted_at` | TIMESTAMP | Soft delete |

### `compliance_items`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `property_id` | UUID | FK → properties(id) |
| `title` | VARCHAR(255) | NOT NULL |
| `category` | VARCHAR(50) | |
| `status` | VARCHAR(50) | active, expiring_soon, expired, pending, not_required |
| `issued_at` | DATE | |
| `expires_at` | DATE | |
| `reminder_days` | INTEGER | DEFAULT 30 |
| `notes` | TEXT | |
| `file_path` | VARCHAR(255) | |
| `created_by` | UUID | FK → users |
| `timestamps` | | |
| `deleted_at` | TIMESTAMP | Soft delete |

### `pipelines` / `pipeline_stages` / `pipeline_deals` / `pipeline_activities` (2026-05-02)

- `pipelines`: id, name, description, type, is_default, created_by, soft deletes
- `pipeline_stages`: id, tenant_id (nullable string), pipeline_id, name, position, color, required_fields (JSON), is_default, is_won, is_lost
- `pipeline_deals` (renamed from `pipeline_items`): id, tenant_id, pipeline_id, stage_id, property_id, contact_id, title, description, deal_value, priority, expected_completion, closed_at, lost_reason, position, created_by, notes (JSONB), entered_stage_at, soft deletes
- `pipeline_activities`: id, deal_id, action, from_stage, to_stage, metadata (JSON), user_id, created_at

### `users`

| Column | Type |
|--------|------|
| `id` | UUID |
| `name` | VARCHAR(255) |
| `email` | VARCHAR(255) UNIQUE |
| `password` | VARCHAR(255) |
| `role` | VARCHAR(50) |
| `is_active` | BOOLEAN |
| `phone` | VARCHAR(30) |
| `avatar_url` | TEXT |
| `settings` | JSONB |
| `remember_token` | VARCHAR(100) |
| `timestamps` | |
| `deleted_at` | TIMESTAMP |

### `tenant_settings` (2026-04-30)

| Column | Type | Notes |
|--------|------|--------|
| `id` | BIGINT | PK |
| `key` | VARCHAR | UNIQUE per tenant DB |
| `value` | TEXT | Nullable |
| `group` | VARCHAR | Default `general` |
| `is_encrypted` | BOOLEAN | Default false |
| `timestamps` | | |

Used for workspace onboarding state and other tenant-scoped JSON or scalar settings (see `WorkspaceOnboardingService`).

## Migration Directory Structure

```
database/
├── migrations/              # Central DB migrations
│   ├── 2019_09_15_000001_create_tenants_table.php
│   ├── 2019_09_15_000002_create_domains_table.php
│   ├── 2019_09_15_000003_create_subscriptions_table.php
│   └── ...
└── migrations/
    └── tenant/              # Tenant DB migrations
        ├── 2024_01_01_000001_create_users_table.php
        ├── 2024_01_01_000002_create_properties_table.php
        ├── 2024_01_01_000003_create_contacts_table.php
        ├── 2024_01_01_000004_create_deal_analyses_table.php
        ├── 2024_01_01_000005_create_compliance_items_table.php
        ├── 2024_01_01_000006_create_pipelines_tables.php
        └── ...
```

## Migration Commands

```bash
# Central migrations
php artisan migrate

# Tenant migrations (specific tenant)
php artisan tenants:migrate --tenants=test

# Tenant migrations (all tenants)
php artisan tenants:migrate

# Create a new tenant migration
php artisan make:migration create_new_tenant_table --path=database/migrations/tenant
```

## Relationships Diagram (Tenant DB)

```
users ──┬── creator → properties
        ├── creator → deal_analyses
        ├── creator → compliance_items
        ├── assignee → contacts
        └── owner → carina_conversations

properties ──┬── deals → deal_analyses
             ├── compliance_items → compliance_items
             ├── pipelineDeals → pipeline_deals
             └── creator → users

deal_analyses ──┬── property → properties
                ├── pipelineDeals → pipeline_deals
                └── creator → users

contacts ──┬── pipelineDeals → pipeline_deals
           ├── activities → activities
           ├── assignee → users
           └── creator → users

pipelines ──── stages → pipeline_stages ──── deals → pipeline_deals ──── activities → pipeline_activities
```