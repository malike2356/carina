# Cursor Prompt: Complimentary Subscriptions + Founder Plan + Promo Code System

## Project context

- Laravel 12, PHP 8.2+, PostgreSQL 16, stancl/tenancy v3
- Central DB: `propreneur_central` (all models below use `$connection = 'central'`)
- Migrations live in `database/migrations/` (central) and `database/migrations/tenant/` (tenant)
- Tests use Pest, live in `tests/Feature/` and `tests/Unit/`
- No emojis anywhere in code, views, or output
- No AI-generated em-dashes
- GUI-first: every operation must be reachable from the platform admin UI without SSH
- Controllers are thin - all logic goes in `app/Services/`
- Stripe PHP SDK is already installed. Stripe secret key is read via `config('billing.stripe_secret')`
- `config/billing.php` is the billing source of truth
- `SubscriptionPlan` model: `app/Models/Central/SubscriptionPlan.php`
- `Subscription` model: `app/Models/Central/Subscription.php`
- `RevenueAnalyticsService`: `app/Services/Admin/RevenueAnalyticsService.php`
- `TenantManagementController`: `app/Http/Controllers/Central/Admin/TenantManagementController.php`
- `RevenueController`: `app/Http/Controllers/Central/Admin/RevenueController.php`
- `RegisterController`: `app/Http/Controllers/Central/RegisterController.php`
- `SubscriptionPlanSeeder`: `database/seeders/Central/SubscriptionPlanSeeder.php`
- Routes: `routes/web.php` - platform admin routes are inside the `Route::prefix('admin')` group under `Route::middleware(['auth:platform', 'verified:platform'])` 
- The route prefix for tenant management is `admin.saas-tenancy.*`
- The route prefix for revenue is `admin.revenue.*`
- Latest migration timestamp in `database/migrations/` is `2026_06_01_100000`; use `2026_06_03_*` for new central migrations

---

## What to build - three features

---

### FEATURE 1: `is_complimentary` flag on subscriptions

**Purpose:** Mark internal or partner workspaces (e.g. Academy, internal dev tenants) so they are excluded from MRR/ARR calculations entirely. They keep their real plan and its features - they just do not inflate revenue numbers.

#### 1a. Migration

File: `database/migrations/2026_06_03_100000_add_is_complimentary_to_subscriptions_table.php`

```php
Schema::connection('central')->table('subscriptions', function (Blueprint $table): void {
    $table->boolean('is_complimentary')->default(false)->after('cancel_at_period_end');
});
```

Include a proper `down()` that drops the column.

#### 1b. Subscription model

File: `app/Models/Central/Subscription.php`

- Add `'is_complimentary'` to `$fillable`
- Add `'is_complimentary' => 'boolean'` to `casts()`

#### 1c. RevenueAnalyticsService - fix MRR

File: `app/Services/Admin/RevenueAnalyticsService.php`

In `calculateMrr()`, add a `where('is_complimentary', false)` filter to the subscription query:

```php
$subscriptions = Subscription::query()
    ->with('subscriptionPlan')
    ->where('status', 'active')
    ->where('is_complimentary', false)   // <-- add this line
    ->get();
```

Also add a new public method `complimentaryCount(): int` that returns how many active complimentary subscriptions exist:

```php
public function complimentaryCount(): int
{
    return (int) Subscription::query()
        ->where('status', 'active')
        ->where('is_complimentary', true)
        ->count();
}
```

#### 1d. Revenue dashboard view

File: `resources/views/central/admin/revenue/index.blade.php`

Find the summary stats cards section. Add a new stat card after the existing ones:

- Label: `Complimentary`
- Value: `{{ $revenue->complimentaryCount() }}`
- Sublabel: `Excluded from MRR`

Match the visual style of the existing stat cards exactly.

`$revenue` is already passed to the view from `RevenueController::index()` - no controller change needed.

#### 1e. Admin dashboard MRR cards

File: `app/Http/Controllers/Central/Admin/AdminDashboardController.php`

Find where the MRR stat cards array is built (look for `['label' => 'MRR'`). The sublabel currently reads `'Active paid plans'`. Change it to `'Paid plans (excl. complimentary)'` so admins understand what the number represents.

#### 1f. Platform admin UI - toggle on tenant edit page

File: `app/Http/Controllers/Central/Admin/TenantManagementController.php`

In `update()`, add validation for `is_complimentary`:

```php
'is_complimentary' => ['nullable', 'boolean'],
```

After updating the tenant record, also update the subscription:

```php
if ($tenant->subscription) {
    $tenant->subscription->update([
        'is_complimentary' => $request->boolean('is_complimentary'),
    ]);
}
```

File: `resources/views/central/admin/tenants/edit.blade.php`

In the subscription/billing section of the edit form, add a checkbox:

```html
<label class="inline-flex items-center gap-2 text-sm">
    <input type="hidden" name="is_complimentary" value="0">
    <input type="checkbox" name="is_complimentary" value="1"
           {{ $tenant->subscription?->is_complimentary ? 'checked' : '' }}
           class="rounded border-[rgb(var(--border-subtle))]">
    Complimentary (excluded from MRR and revenue reporting)
</label>
```

Also show a badge in the tenant index table
(`resources/views/central/admin/tenants/index.blade.php`) next to the plan name when `$tenant->subscription?->is_complimentary` is true. Badge text: `Compl.`. Match the style of existing badges in that view.

---

### FEATURE 2: Founder / Beta plan at £0

**Purpose:** A real plan with £0/month that can be assigned to beta testers. MRR contribution is automatically £0 because `monthlyPriceForPlan()` returns `0.0`. No `is_complimentary` flag needed for these - they show in revenue as £0, which is honest.

#### 2a. Add to `config/billing.php`

In the `plans` array, add a new entry **before** the `investor` entry:

```php
[
    'slug' => 'founder',
    'name' => 'Founder',
    'display_name' => 'Founder (Beta)',
    'price' => '0.00',
    'currency' => 'GBP',
    'interval' => 'month',
    'sort_order' => 1,
    'stripe_price_key' => null,   // no Stripe price - billing handled manually
    'module_set' => 'operator',   // full Operator feature set while in beta
    'limits' => [
        'properties' => 50,
        'team_seats' => 5,
    ],
],
```

Also add `'module_sets'` key `'founder'` that is an alias to `'operator'` - or just reuse `'operator'` in the plan row above (the `module_set` key already points to `'operator'`).

#### 2b. SubscriptionPlanSeeder

The existing seeder in `database/seeders/Central/SubscriptionPlanSeeder.php` already reads from `config('billing.plans')` and calls `SubscriptionPlan::updateOrCreate()`. No changes needed - running the seeder after adding the config entry will create the plan row. Add a note in the seeder docblock that `founder` is a £0 beta plan.

#### 2c. Run the seeder

After this prompt is implemented, run on both local and production:

```bash
php artisan db:seed --class=Database\\Seeders\\Central\\SubscriptionPlanSeeder --force
```

No migration needed - `subscription_plans` table already exists.

---

### FEATURE 3: Promo Code System

**Purpose:** Platform admin creates promo codes (e.g. `IPN30FREE`). A tenant entering the code at signup gets a discount applied. Three discount types are supported: `free_trial_days` (extend the trial period), `percent` (percentage off, applied via Stripe coupon), `fixed_gbp` (fixed amount off per month, applied via Stripe coupon). Platform admin can see redemption count and deactivate codes.

#### 3a. Migration - `promo_codes` table

File: `database/migrations/2026_06_03_110000_create_promo_codes_table.php`

```
id (bigint, pk)
code (string 32, unique, not null) - always stored uppercase
name (string 120, not null) - internal label e.g. "IPN June 2026 batch"
discount_type (enum: free_trial_days, percent, fixed_gbp, not null)
discount_value (unsignedInteger, not null) - days for trial, integer percent (0-100), or pence for fixed
max_uses (unsignedInteger, nullable) - null = unlimited
used_count (unsignedInteger, default 0)
expires_at (timestamp, nullable)
is_active (boolean, default true)
stripe_coupon_id (string 120, nullable) - Stripe coupon ID once created
created_by (unsignedBigInteger, nullable, FK platform_users.id on delete set null)
timestamps
```

Use `Schema::connection('central')` in both `up()` and `down()`.

#### 3b. Migration - `promo_code_redemptions` table

File: `database/migrations/2026_06_03_120000_create_promo_code_redemptions_table.php`

```
id (bigint, pk)
promo_code_id (unsignedBigInteger, FK promo_codes.id on delete cascade)
tenant_id (string, FK tenants.id on delete cascade)
redeemed_at (timestamp, default now)
timestamps
```

Use `Schema::connection('central')`.

#### 3c. PromoCode model

File: `app/Models/Central/PromoCode.php`

- `$connection = 'central'`
- `$fillable`: all columns except `id`, `used_count`, timestamps
- `casts()`: `expires_at => datetime`, `is_active => boolean`
- `DISCOUNT_TYPES` constant: `['free_trial_days', 'percent', 'fixed_gbp']`
- `redemptions()` HasMany to `PromoCodeRedemption`
- `createdBy()` BelongsTo `PlatformUser`
- Scope `active()`: `where('is_active', true)->where(fn($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))`
- Method `isExhausted(): bool` - returns true if `max_uses !== null && used_count >= max_uses`
- Method `isValid(): bool` - `is_active && !isExhausted() && (expires_at === null || expires_at > now())`

#### 3d. PromoCodeRedemption model

File: `app/Models/Central/PromoCodeRedemption.php`

- `$connection = 'central'`
- `$fillable`: `promo_code_id`, `tenant_id`, `redeemed_at`
- `casts()`: `redeemed_at => datetime`
- `promoCode()` BelongsTo `PromoCode`
- `tenant()` BelongsTo `Tenant`

#### 3e. PromoCodeService

File: `app/Services/Billing/PromoCodeService.php`

Methods:

```php
public function findValid(string $code): ?PromoCode
```
Looks up by `strtoupper($code)`, returns the model if valid, null otherwise.

```php
public function redeem(PromoCode $code, Tenant $tenant, ?string $stripeCustomerId = null): void
```
- Wraps everything in `DB::connection('central')->transaction()`
- Increments `used_count` on the promo code
- Creates a `PromoCodeRedemption` record for this tenant
- If `discount_type === 'free_trial_days'`: extend the tenant's subscription `trial_ends_at` by `discount_value` days (if no existing trial, set from now; if existing trial in the future, extend from that date)
- If `discount_type === 'percent'` or `'fixed_gbp'` AND a Stripe secret key is configured AND `$stripeCustomerId` is not null: create a Stripe coupon via `\Stripe\Coupon::create()` and apply it to the customer via `\Stripe\Customer::update()` with `coupon` param. If Stripe is not configured, log a warning and skip (do not throw - the redemption still counts)
- If the promo code was already redeemed by this tenant (check `PromoCodeRedemption`), throw `\RuntimeException('This code has already been used by this workspace.')`

```php
public function createStripeBackedCoupon(PromoCode $code): string
```
Creates the Stripe coupon if not already created (checks `stripe_coupon_id`), stores the ID back, returns it. Called lazily when first needed. Uses `\Stripe\StripeClient` initialised with `config('billing.stripe_secret')`.

#### 3f. Platform admin - promo code CRUD

Controller: `app/Http/Controllers/Central/Admin/PromoCodeController.php`

Routes to add in `routes/web.php` inside the existing `Route::prefix('admin')` middleware group, after the revenue routes:

```php
Route::prefix('promo-codes')->name('promo-codes.')->middleware(['platform.grant:manage-saas-tenants'])->group(function (): void {
    Route::get('/', [PromoCodeController::class, 'index'])->name('index');
    Route::get('/create', [PromoCodeController::class, 'create'])->name('create');
    Route::post('/', [PromoCodeController::class, 'store'])->name('store');
    Route::patch('/{promoCode}/deactivate', [PromoCodeController::class, 'deactivate'])->name('deactivate');
    Route::patch('/{promoCode}/activate', [PromoCodeController::class, 'activate'])->name('activate');
    Route::delete('/{promoCode}', [PromoCodeController::class, 'destroy'])->name('destroy');
});
```

Controller methods:

- `index()`: list all codes ordered by `created_at desc`, eager-load `redemptions` count, paginate 25. Pass to `central.admin.promo-codes.index` view.
- `create()`: return `central.admin.promo-codes.create` view with `DISCOUNT_TYPES`.
- `store(Request $request)`: validate (`code` required string max:32 uppercase-coerced unique in `promo_codes`, `name` required string max:120, `discount_type` required in `DISCOUNT_TYPES`, `discount_value` required integer min:1, `max_uses` nullable integer min:1, `expires_at` nullable date after:today, `is_active` boolean). Save, redirect to index with success flash.
- `deactivate(PromoCode $promoCode)`: set `is_active = false`, redirect back.
- `activate(PromoCode $promoCode)`: set `is_active = true`, redirect back.
- `destroy(PromoCode $promoCode)`: only allow if `used_count === 0`, delete, redirect to index.

Views needed:

`resources/views/central/admin/promo-codes/index.blade.php`
- Table columns: Code, Name, Type, Value, Used / Max, Expires, Status, Actions
- Actions: Activate/Deactivate toggle button, Delete (only if used_count === 0)
- "Create promo code" button at top right

`resources/views/central/admin/promo-codes/create.blade.php`
- Form fields matching validation above
- `discount_value` label changes based on type: "Days" for `free_trial_days`, "Percent (%)" for `percent`, "Amount (pence)" for `fixed_gbp`
- Use Alpine.js `x-data` / `x-show` to toggle the label dynamically - Alpine is already loaded in the admin layout

Both views extend `layouts.admin` and use `<x-admin.platform-configuration-tabs />` at the top for nav consistency. Match the card/form style of existing admin views (e.g. `resources/views/central/admin/ai/providers/create.blade.php`).

#### 3g. Add navigation link

File: `app/Support/Navigation/PlatformFilamentCrossLinks.php` or wherever the platform admin sidebar nav items are defined.

Search the codebase for where "Revenue" or "Billing" nav links are added to the platform admin sidebar. Add a "Promo codes" link pointing to `route('admin.promo-codes.index')` in the same group.

If nav is defined in a Blade partial, add it there. If in a PHP array/class, add it there. Match the icon style of surrounding items (heroicons).

#### 3h. Registration flow - accept promo code

File: `app/Http/Controllers/Central/RegisterController.php`

In `showForm()`: pass `$trialDays` and also pass nothing extra (the promo field is just a text input on the form).

In `store()`: add validation:

```php
'promo_code' => ['nullable', 'string', 'max:32'],
```

After the tenant is created (after `$this->tenantCreationService->createTenant($data)`), if `$data['promo_code']` is not empty:

```php
$promoCodeService = app(PromoCodeService::class);
$promo = $promoCodeService->findValid($data['promo_code']);
if ($promo !== null) {
    try {
        $promoCodeService->redeem($promo, $tenant, $tenant->subscription?->stripe_customer_id);
    } catch (\RuntimeException $e) {
        // already redeemed or invalid - log, do not block registration
        \Illuminate\Support\Facades\Log::warning('Promo code redemption failed at registration', [
            'code' => $data['promo_code'],
            'error' => $e->getMessage(),
        ]);
    }
} else {
    // invalid or exhausted code - silently continue; do not expose code status to the user
}
```

File: `resources/views/central/auth/register.blade.php`

Add an optional "Promo / referral code" text input field below the existing form fields, before the submit button:

```html
<div>
    <label class="form-label" for="promo_code">Promo or referral code (optional)</label>
    <input id="promo_code" type="text" name="promo_code" value="{{ old('promo_code') }}"
           class="form-input uppercase" autocomplete="off" placeholder="e.g. IPN30FREE"
           maxlength="32">
</div>
```

The `uppercase` CSS class on the input is a Tailwind utility (use `class="form-input" style="text-transform:uppercase"` if Tailwind `uppercase` does not apply to inputs in this project).

---

## Coding rules (do not deviate)

- No emojis anywhere
- No AI-generated em-dashes (use plain hyphens)
- No raw SQL - use Eloquent query builder
- No closures in route files - use named controller methods
- Every migration must have a `down()` method
- Stripe calls only in `app/Services/` - never in controllers or models
- Use `DB::connection('central')->transaction()` for multi-table writes
- Follow existing Pest test conventions if adding tests (`tests/Feature/Billing/`)
- `declare(strict_types=1)` at the top of every PHP file
- Do not run `migrate:fresh`, `db:wipe`, or `migrate:reset`
- Do not modify `database/migrations/tenant/` - everything here is central-only
- Do not touch `app/Support/Academy/` - unrelated to this build
- After implementation, run `php artisan migrate` (not fresh) and `php artisan db:seed --class=Database\\Seeders\\Central\\SubscriptionPlanSeeder --force`

---

## Acceptance checklist

- [ ] `php artisan migrate` runs without errors
- [ ] `SubscriptionPlanSeeder` creates the `founder` plan at £0
- [ ] MRR on the revenue dashboard excludes complimentary subscriptions
- [ ] Revenue dashboard shows a "Complimentary: N" stat card
- [ ] Tenant edit page has the complimentary toggle and saving it updates `subscriptions.is_complimentary`
- [ ] Tenant index page shows a "Compl." badge when applicable
- [ ] Platform admin can create, deactivate, and delete promo codes at `/admin/promo-codes`
- [ ] Registration form has an optional promo code field
- [ ] Submitting a valid `free_trial_days` code at registration extends `trial_ends_at` correctly
- [ ] `PromoCode::isValid()` returns false for expired, exhausted, or inactive codes
- [ ] A code cannot be redeemed twice by the same tenant
- [ ] `php artisan test` passes
