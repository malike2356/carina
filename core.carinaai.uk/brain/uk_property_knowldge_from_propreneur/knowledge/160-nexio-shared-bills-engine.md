# Nexio Shared Bills Engine - Phase 3a

Builds on Phase 2 compliance (`157`-`159`). Addresses bills-inclusive HMO rent and utility allocation.

## Bills-inclusive setup

**`rooms`:** `bills_inclusive` (bool), `included_utilities` (jsonb: gas, electricity, water, broadband).

**`property_tenancies`:** `bills_inclusive` (overrides room default), `utility_allowance_pcm` (fair-usage cap).

## Bill allocations

Table `bill_allocations`: period, utility type, total cost, method (`equal`, `proportional_sqm`, `custom`), `allocation_shares` jsonb, optional `journal_entry_id`, status `draft` | `posted`.

**`SharedBillsService`:**

| Method | Purpose |
|--------|---------|
| `createAllocation` | Compute shares, save draft |
| `updateAllocation` | Update draft only |
| `postAllocation` | GL journal: debit utilities (5500) per room share, credit trade creditors (2000) |
| `reconcile` | True-up variance journal if actual ≠ allocated |
| `getFairUsageSurplus` | Tenancy spend over `utility_allowance_pcm` for period `YYYY-MM` |
| `councilTaxAsPropertyExpense` | Single property-level expense - **not** room split |

### Council tax

Mandatory HMO (5+): landlord-liable (Local Government Finance Act 1992). UI records property expense with statutory guidance in journal description/metadata. Non-mandatory HMOs: UI explains nuanced treatment.

## HMO rent bank matching

**HMO rent bank matching:** see `188-nexio-room-rent-bank-matching.md` (`HmoRentMatchingService`, scored suggestions, `bank_transaction_room_matches`).

Bank reconciliation index shows “Confirm room rent” for suggestions.

## Routes

`tenant.properties.shared-bills.*` - index, store, update, post.

## Tests

`tests/Feature/Properties/SharedBillsAllocationTest.php`

## Related

Legal notices toolkit: `161-nexio-legal-toolkit-notices.md`.
