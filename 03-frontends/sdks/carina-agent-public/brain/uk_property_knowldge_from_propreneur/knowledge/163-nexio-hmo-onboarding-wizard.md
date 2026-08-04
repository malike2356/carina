# Nexio HMO onboarding wizard (Phase 4)

Six-step wizard for workspaces with central `tenants.persona = hmo`. Replaces the generic workspace onboarding flow for those tenants.

## Routes

| Method | Path | Name |
|--------|------|------|
| GET | `/onboarding/hmo/start` | `tenant.onboarding.hmo.start` |
| GET | `/onboarding/hmo/step/{step}` | `tenant.onboarding.hmo.step` |
| POST | `/onboarding/hmo/step/{step}` | `tenant.onboarding.hmo.step.submit` |
| POST | `/onboarding/hmo/complete` | `tenant.onboarding.hmo.complete` |

Middleware: `auth`, tenant context. `EnsureWorkspaceOnboardingCompleted` redirects `hmo` personas to this wizard until `hmo_onboarding` settings JSON has `completed_at`.

## Services

- `HmoOnboardingService` - step state in `tenant_settings` key `hmo_onboarding`, persists property/rooms/tenancies/compliance/fire log per step
- `HmoOnboardingCompletionService` - compliance items, weekly fire alarm reminder, compliance score, persona dashboard widgets, `OnboardingJourney` complete, analytics events

## Steps

1. HMO property + licence fields on `properties`
2. Rooms (or skip)
3. Tenancies with `room_id` (or skip)
4. Gas / EICR / EPC expiry → first `calculateScore()`
5. Fire alarm test date → `fire_safety_logs` + overdue task if due
6. Launch → completion service + workspace onboarding timestamp sync

## Tests

`tests/Feature/Onboarding/HmoOnboardingWizardTest.php`
