# Nexio: Per-room bank rent matching (Prompt 221)

## Service

`App\Services\Properties\HmoRentMatchingService` - scores incoming credits against occupied HMO rooms (active tenancies).

| Signal | Points |
|--------|--------|
| Amount exact vs `rent_amount` | +50 |
| Amount within £5 | +30 |
| Tx date within ±3 days of `rent_due_day` in month | +30 |
| Description contains tenant first/last name | +20 |
| Same amount matched this tenancy last month | +20 |
| Amount ≈ rent/10 (partial payment) | −20 |

Returns top 3 suggestions with score ≥ 40.

Legacy shim: `App\Services\Accounting\HmoRentMatchingService` extends the Properties service.

## Persistence

- `bank_transaction_room_matches` - confirmed matches (`matched_at`, `matched_by`, `auto_suggested`, `match_score`)
- `bank_transactions.room_match_dismissed_at` - operator dismissed suggestions
- `tenant_settings.auto_match_room_rents` (group `banking`) - auto-confirm when score ≥ 85 (default off)

## UI

Bank reconciliation index: possible room matches panel (top 3, score bar), confirm per row, “Not a room rent”, auto-match opt-in checkbox.

Routes: `tenant.accounting.reconciliation.transactions.confirm-room-match`, `.dismiss-room-match`, `.auto-match-settings`.

## Rent due day

`property_tenancies.rent_due_day` (1-28, default 1 on create). Fields on property tenancy forms and HMO onboarding step 3.

## Tests

`tests/Feature/Banking/RoomRentMatchingTest.php`
