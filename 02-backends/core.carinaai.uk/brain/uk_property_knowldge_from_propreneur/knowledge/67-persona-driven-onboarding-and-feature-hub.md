# Persona-driven onboarding and Feature Hub

## Two-layer model

1. **Subscription gate** - `BillingModule` + feature flags + Stripe plan (`TenantNavModuleAccess::mapForTenant()`). Controls what the tenant has paid for.
2. **Persona gate** - `UserFeatureProfileService` on `users.feature_preferences`. Controls what each user chooses to show.

Nav and dashboard modules appear only when **both** gates pass. Never merge these concerns.

## Personas

| Slug | Label |
|------|--------|
| `property_investor` | Property Investor |
| `portfolio_manager` | Portfolio and Wealth Manager |
| `mentor_educator` | Property Mentor or Educator |
| `sourcer_packager` | Property Sourcer or Deal Packager |

Default module sets live in `UserFeatureProfileService::personaDefaults()`. Carina AI and Document Vault are always on for every persona.

## Onboarding wizard

- Six steps; step 1 is persona (required).
- `WorkspaceOnboardingService::TOTAL_STEPS = 6`, `onboarding_version = 3`.
- `complete()` calls `UserFeatureProfileService::setPersona()` for the launching user.
- In-progress v2 state migrates to v3 (adds empty `persona.slug`, bumps step indices).

## Legacy users

`feature_preferences = null` → `isActive()` returns true for all modules (no regression).

## Feature Hub

- Route: `/settings/features` (`tenant.settings.feature-hub`).
- Toggle modules; change persona (resets to that persona’s defaults).
- Linked from Settings hub and sidebar Help group (“Manage features”).

## Carina

`CarinaBaselineContextService::appendixForUser()` appends persona label and active module list.

## Extending

- New persona: add to `UserFeatureProfileService::PERSONAS`, labels/descriptions/icons, `personaDefaults()`, onboarding persona cards, strategy step branch.
- New module in defaults: update `personaDefaults()` match arms only (subscription gate unchanged).
