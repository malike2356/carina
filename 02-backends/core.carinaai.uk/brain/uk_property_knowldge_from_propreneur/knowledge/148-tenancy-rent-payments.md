# Tenancy Rent Payments

**Last updated:** 2026-05-20

## Overview

Tenancy Rent Payments is a sub-feature of the Property module that tracks rent due and payment events for each active tenancy. When a landlord has a `property_tenancy` record for a tenant, they can log individual rent payment entries against it - recording the due date, the actual paid date, the amount, and the payment status. This creates a rent ledger per property per tenancy.

## Key tables

| Table | Key columns |
|---|---|
| `tenancy_rent_payments` | `id`, `tenancy_id` (FK to `property_tenancies`), `property_id` (FK to `properties`), `amount_minor` (unsigned bigint, pence), `due_date` (date), `paid_date` (date, nullable), `status` (`pending`/`paid`/`late`/`partial`), `notes` (nullable, max 1000 chars), `created_by` (FK to `users`); indexed on `(tenancy_id, due_date)` and `(property_id, status)` |

### Status values

| Status | Meaning |
|---|---|
| `pending` | Due but not yet paid |
| `paid` | Fully paid |
| `late` | Overdue - due date has passed without payment |
| `partial` | Partial payment received |

## Routes / entry points

Routes are nested under properties and their tenancies.

| Route | Method | Controller action | Description |
|---|---|---|---|
| `POST /properties/{property}/tenancies/{tenancy}/payments` | POST | `PropertyTenancyController::storePayment` | Log a new rent payment |
| `POST /properties/{property}/tenancies/{tenancy}/payments/{payment}/mark-paid` | POST | `PropertyTenancyController::markPaymentPaid` | Mark a pending or late payment as paid today |

## How it works

### Logging a rent payment

1. From the property page under the Tenancies section, the user opens a tenancy and clicks "Log payment".
2. The form requires `amount` (decimal pounds), `due_date`, `status`, and optionally `paid_date` and `notes`.
3. `PropertyTenancyController::storePayment` validates the data, confirms the tenancy belongs to the property (`tenancy.property_id === property.id`), and creates a `TenancyRentPayment` row. Amount is converted to pence: `round(amount * 100)`.
4. Both `tenancy_id` and `property_id` are stored on the row for efficient querying at the property level without joining through tenancies.

### Marking a payment as paid

`PropertyTenancyController::markPaymentPaid` sets `status = paid` and `paid_date = today` on an existing payment record. It validates that the payment belongs to the correct tenancy before updating.

### Relationships

- `TenancyRentPayment::tenancy()` - belongs to `PropertyTenancy`
- `TenancyRentPayment::property()` - belongs to `Property`
- `TenancyRentPayment::creator()` - belongs to `User` via `created_by`
- `PropertyTenancy` has many `TenancyRentPayment` (via `payments` relationship used in the Asset Manager service)

### Amount formatting

`TenancyRentPayment::amountFormatted()` returns a GBP-formatted string (e.g. `£1,250.00`). Note: amounts are stored as unsigned pence.

## Integration with Asset Manager

`AssetManagerService::tenancyOverview()` uses the `payments` relationship on `PropertyTenancy` to count overdue payments workspace-wide. The `overdue_count` aggregation counts payments with `status = overdue` per active tenancy. Note: `late` is the status stored by the payment record; `overdue` in the aggregate query refers to the same concept.

## Carina context

Relevant questions:

- "Has the rent been paid for [property] this month?"
- "Show me late rent payments"
- "Which tenants are behind on rent?"
- "How much rent am I expecting this month?"
- "Log that the rent was paid for [address]"

Carina should know:
- Each payment row is an individual event, not a recurring schedule - users manually log each payment
- `due_date` is when rent was due; `paid_date` is when it was actually received
- `status = late` must be set manually or by a scheduled job (no automatic late-flagging in the current code)
- Amounts are in pence internally but always displayed in pounds
- Multiple payment rows can exist per tenancy (one per rent period)
