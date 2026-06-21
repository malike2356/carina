# Role access matrix and personas

**Purpose:** Envisage who uses Propreneur (central vs tenant), how access should layer by persona, and how named roles map to permissions as modules grow.

**Last updated:** 2026-05-01

## 1. Enforcement model (today)

| Layer | Guard | Model | Entry |
|-------|--------|--------|--------|
| Platform (VERLOX) | `platform` | `PlatformUser` | `/platform/login`, `/admin/*` |
| Workspace (customer) | `web` | `User` (tenant DB) | `{slug}.{TENANT_BASE_DOMAIN}/login` |

**Central `/admin` gate:** `EnsurePlatformAdmin` calls `PlatformUser::canAccessPlatformAdmin()`, which allows active **super_admin**, **admin**, **`support`**, or any platform user with **at least one Spatie permission** on guard `platform`. Individual `/admin/*` routes still use **`platform.grant`** or controller `abort_unless` checks. The **`support`** Spatie role is synced to **`view-saas-tenants`**, **`view-feature-flags`**, **`use-admin-search`** (fresh installs via `2026_04_30_220010_expand_platform_permission_matrix`; existing DBs aligned by **`2026_05_01_190000_align_platform_support_role_without_typed_settings`**, which removes legacy **`view-typed-settings`** from support).

**Filament `/filament`:** `canAccessPanel` maps to `canAccessFilamentPanel()` (super_admin, admin, or **`manage-platform-ai-keys`** only). Support staff without AI‑keys permission cannot open Filament even though they may use Blade `/admin`.

**Within `/admin`:** `EnsureSuperAdmin` restricts selected routes (e.g. cross-tenant analytics). `EnsurePlatformGrant` allows **super_admin** **or** any of the pipe-separated permissions (`platform.grant:*` in routes). Catalogue: `config/platform_permissions.php`.

**Tenant workspace admin API:** `EnsureWorkspaceAdmin` requires Spatie role **`tenant_admin`** on the tenant `User`.

**Feature flags:** Many surfaces also require `feature:*` middleware; roles never bypass disabled modules.

## 2. Personas (who uses what)

| Persona | Primary surface | Goals |
|---------|-----------------|--------|
| Platform super operator | Central `/admin` | Full tenancy lifecycle, security, flags, AI keys, irreversible actions |
| Platform operations | Central `/admin` | Day‑to‑day tenants, support tooling, read‑only or scoped writes |
| Platform billing / finance | Central `/admin` | Plans, invoices, revenue ops (as billing UI hardens) |
| Platform design / product | Central `/admin` | Theme presets, UI lab, rollout experiments |
| Workspace owner | Tenant app | Strategy, billing seat, branding, sensitive settings |
| Workspace administrator | Tenant app + `/api/*` admin | Users, invitations, roles (where exposed), onboarding |
| Deal / acquisitions lead | Tenant app | Deals, pipeline, properties, Carina for analysis |
| Operations / coordinator | Tenant app | Tasks, compliance reminders, comms (future Communications hub) |
| Portfolio analyst | Tenant app | Read‑heavy dashboards, exports |
| Compliance officer | Tenant app | Compliance module, evidence (future Document vault read/write split) |
| External accountant | Tenant app | Accounting module read or journal posting (future; strongly scoped) |
| Mentor / coach | Tenant app | Mentoring OS cohorts (future) |
| Investor / LP (read‑only) | Tenant app | Selected metrics only (future gated dashboards) |

## 3. Platform roles (envisaged bundles)

**Principle:** Keep **permissions** in `config/platform_permissions.php` as the source of truth. **Roles** are bundles assigned to staff; **super_admin** remains full bypass inside `EnsurePlatformGrant`.

| Role slug (proposed) | Intent | Permission bundle (from existing catalogue) | Notes |
|----------------------|--------|-----------------------------------------------|--------|
| `super_admin` | Full platform | All capabilities; bypasses grant checks | Already implemented |
| `platform_admin` | Senior ops | Align with today’s `admin`: manage tenants, flags, settings, AI keys as granted | Map from legacy `admin` |
| `saas_operator` | Tenant lifecycle | `view-saas-tenants`, optionally `manage-saas-tenants` | No AI keys |
| `support_agent` | Customer support | Same bundle as **`support`** role: `view-saas-tenants`, `view-feature-flags`, `use-admin-search`; optional **`impersonate-platform-users`** granted only when needed | Enters Blade `/admin`; not Filament unless **`manage-platform-ai-keys`** |
| `billing_operator` | Revenue | Future: dedicated billing permissions when central billing UI exists | Add permissions when module ships |
| `feature_manager` | Rollouts | `view-feature-flags`, `manage-feature-flags` | |
| `settings_auditor` | Read‑only config | `view-typed-settings`, `view-feature-flags` | |
| `integrations_engineer` | AI / keys | `manage-platform-ai-keys`, typed settings as needed | Narrow production access |
| `design_ops` | Brand / UI lab | `access-admin-ui-lab`, `manage-central-theme-presets` | |

Legacy column **`support`** should either map to **`support_agent`** (after gate fix) or be deprecated in favour of Spatie‑only roles.

## 4. Tenant roles (envisaged bundles)

**Principle:** Tenant users use Spatie on guard **`web`**. Today **`tenant_admin`** is enforced for workspace admin JSON routes; other roles are not yet wired module‑by‑module.

| Role slug (proposed) | Intent | Typical abilities (to enforce as permissions grow) |
|----------------------|--------|-----------------------------------------------------|
| `tenant_admin` | Workspace admin | Users, invitations, roles, billing hooks, settings, all modules allowed by plan |
| `workspace_manager` | Delegated admin | Same as admin minus destructive actions (delete workspace, billing) |
| `deal_lead` | Acquisitions | Deals, pipeline, properties CRUD; Carina; no user admin |
| `analyst` | Read + export | Read modules; export reports; no deletes |
| `contributor` | Mixed ops | CRUD on assigned records (contacts, pipeline items) |
| `viewer` | Read‑only | Dashboards and lists; no writes |
| `compliance_owner` | Compliance | Compliance module write; optional vault upload |
| `finance_clerk` | Books | **`view-accounting`** + **`manage-accounting`** (seeded 2026-05-02); post journals and custom GL accounts |
| `external_accountant` | Outsourced finance | **`view-accounting`** only; CSV exports and P&L reads; no journal write routes |
| `mentor` | Programmes (future) | Mentoring OS scoped to cohorts |

**Invitation default:** Continue to assign **`tenant_admin`** to first user; invitations should attach **`contributor`** / **`viewer`** as the common join paths.

## 5. Module access matrix (high level)

Legend: **-** not planned in persona; **R** read; **W** write; **A** admin within module; **\*** phased.

| Module | tenant_admin | workspace_manager | deal_lead | analyst | contributor | viewer | compliance_owner | finance_* | mentor |
|--------|--------------|-------------------|-----------|---------|-------------|--------|------------------|-----------|--------|
| Dashboard | A | R/W | R/W | R | R | R | R | R | R* |
| Properties | A | W | W | R | W* | R | R | R | - |
| Deals | A | W | W | R | W* | R | R | R | - |
| CRM | A | W | W | R | W | R | - | - | - |
| Pipeline | A | W | W | R | W | R | - | - | - |
| Compliance | A | W | R | R | R | R | W | R | - |
| Carina | A | W | W | R | W | R* | R | R | R* |
| Billing (tenant) | A | R | - | R | - | - | - | W* | - |
| Accounting (phase 1-2) | A (view+manage) | R* | - | R (view) | - | R (view) | - | W (`finance_clerk`) | R* (`external_accountant` view) |
| Document vault (future) | A | W | R | R | W* | R* | W | R | - |
| Communications (future) | A | W | W | R | W | R | - | - | - |
| Mentoring OS (future) | A | R* | - | R | - | R | - | - | W |

Fine‑grained rules (row‑level, assigned‑only, BYOK) belong in services + policies when each module matures.

## 6. Implementation backlog (recommended order)

1. **Platform gate:** **Done (2026-05-01):** `EnsurePlatformAdmin` uses `canAccessPlatformAdmin()` (includes **`support`** and permission-only staff). Filament uses `canAccessFilamentPanel()` (super_admin / admin / **`manage-platform-ai-keys`**). Optionally rename legacy roles or add **`support_agent`** as an alias in seeds only.
2. **Central:** **Done (2026-05-01):** migration **`2026_05_01_200000_seed_preset_platform_staff_roles`** seeds **`saas_operator`**, **`feature_manager`**, **`integrations_engineer`**, **`design_ops`**, **`settings_auditor`**, **`billing_operator`** (preset bundles; editable in `/admin/roles`). Use **Create role** for anything else.
3. **Tenant:** Add `config/tenant_permissions.php` (mirror of platform catalogue) and seed baseline permissions + roles **`workspace_manager`**, **`deal_lead`**, **`viewer`**, **`contributor`**.
4. **Routes:** Replace coarse middleware with `permission:*` or policy checks per route group as modules ship (starting with Deal Engine + CRM).
5. **UI:** User Manager surfaces role assignment for both guards; hide irrelevant roles per feature flags.
6. **Audit:** Log sensitive actions (role change, impersonation, tenant delete) for platform and tenant admins.

## 7. Related docs

- `09-auth.md` - guards, login URLs, password reset
- `15-platform-admin.md` - `/admin` map, User Manager
- `19-tenant-workspace-onboarding-invitations-and-admin-api.md` - invitations, workspace admin API
- `brain/prompts/03-user-manager.md` - generator spec (tenant_admin, team_member, viewer naming)
- `config/platform_permissions.php` - live platform permission catalogue
