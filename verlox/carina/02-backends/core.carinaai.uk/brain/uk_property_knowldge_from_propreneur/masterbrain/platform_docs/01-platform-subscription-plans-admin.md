# Platform subscription plan catalogue (admin)

**Last updated:** 2026-05-03  
**Status:** Shipped  
**Scope:** Central admin CRUD for `subscription_plans` (not tenant checkout UI)

---

## Purpose

Super admins and authorised platform staff maintain the **subscription plan catalogue** in the central database: names, slugs, prices, Stripe price IDs, enabled **billing modules** (`App\Billing\BillingModule`), JSON **limits**, sort order, and active flag. Tenant billing and feature gating read these rows through subscriptions and `SubscriptionService` entitlements.

---

## URLs and gates

All routes sit under the **`/admin`** prefix with **`auth:platform`** and **`EnsurePlatformAdmin`**. Users who are signed in on the platform guard but **fail** `PlatformUser::canAccessPlatformAdmin()` are **redirected** to **`central.login`** (they never reach plan-specific grants).

| Surface | Path | Notes |
|--------|------|--------|
| Index | `GET /admin/subscription-plans` | Lists plans; **Plans** sidebar link |
| Create | `GET /admin/subscription-plans/create`, `POST /admin/subscription-plans` | Manage permission |
| Edit | `GET /admin/subscription-plans/{plan}/edit`, `PUT /admin/subscription-plans/{plan}` | Manage permission |
| Delete | `DELETE /admin/subscription-plans/{plan}` | Blocked when an **active or trialing** `subscriptions` row references the plan |

**Feature flag:** `saas_tenant_management` must be on (same family as SaaS workspace admin).

**Permissions:** `view-subscription-plans` (read index), `manage-subscription-plans` (create, update, delete). Super admin bypasses permission checks where the controller uses the usual platform patterns.

**Note:** The migration seeds `view-subscription-plans` onto the **`support`** Spatie role by default. Users who can open **`/admin`** via some other platform permission (for example **`manage-platform-users`**) still receive **403** on plan routes until they are granted **`view-subscription-plans`** or **`manage-subscription-plans`** (`EnsurePlatformGrant`).

**Routes:** `routes/web.php` group `admin.subscription-plans.*`; controller `App\Http\Controllers\Central\Admin\SubscriptionPlanController`.

**Migration:** `2026_05_03_220000_add_subscription_plan_admin_permissions` (platform permissions and role wiring in `config/platform_permissions.php`).

---

## Service layer

`App\Services\Billing\SubscriptionPlanCatalogService`:

- Validates **module** keys against `BillingModule::cases()`.
- Persists `features` JSON (display name, modules array, limits).
- On create, update, or delete: flushes **billing entitlements cache** for every tenant whose `subscriptions.plan_id` points at the affected plan (via `SubscriptionServiceInterface::forgetBillingEntitlementsCache`).

---

## Model and connection

- **Model:** `App\Models\Central\SubscriptionPlan`  
- **Connection:** `central`  
- **Related:** `Subscription` rows carry `plan_id`; do not delete a plan that still has active subscriptions.

---

## Tests

`tests/Feature/Central/SubscriptionPlanAdminTest.php` covers permission denials, index visibility, create/update/delete behaviour, and delete blocking when an active subscription exists.

---

## Related docs

- `15-platform-admin.md` - URL map and sidebar behaviour  
- `17-billing-api.md` - Tenant Stripe billing API vs central catalogue  
- `22-tenant-route-map.md` - Tenant subscription feature checks  
- `35-documenting-new-features.md` - Rule: new shipped surface gets its own knowledge file
