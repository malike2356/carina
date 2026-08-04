# Nexio per-room pricing (Prompt 218)

## Decision: Option A - base + per-room (implemented)

Competitor benchmark: COHO ~£3-6/room/month. We use **included rooms on the plan** plus **£/room/mo** for additional rooms (not a separate base SKU in v1 - surcharge stacks on the plan’s listed base price).

**Operator plan defaults** (`config/billing.php`):

| Field | Value |
|-------|--------|
| Plan base | £99/mo (existing Operator price) |
| `included_rooms` | 5 |
| `price_per_additional_room` | £3.00 |
| Example | 10 rooms → £99 + (5 × £3) = **£114/mo** |

Option B (tiered room caps only) was not implemented.

## Data model

- `subscription_plans.included_rooms`, `price_per_additional_room`, `stripe_price_per_room_id`
- `tenants.room_count`, `tenants.room_count_synced_at` (central cache)

## Calculation

`RoomPricingService::calculateRoomSurcharge()` / `SubscriptionService::calculateRoomSurcharge()`:

```
additional = max(0, room_count - included_rooms)
surcharge = additional * price_per_additional_room
```

## Sync

`php artisan billing:sync-tenant-room-count` - daily via platform scheduler (`billing-sync-tenant-room-count`).

Counts non-deleted `rooms` per tenant DB, writes central `tenants.room_count`, then updates Stripe subscription item quantity for `STRIPE_PRICE_OPERATOR_PER_ROOM` when configured.

## Stripe

- Checkout: base plan line item + per-room line item (`quantity` = additional rooms)
- Active subs: `StripeService::syncSubscriptionPerRoomQuantity()` add/update/delete per-room subscription item

Env: `STRIPE_PRICE_OPERATOR_PER_ROOM` (maps to `config('billing.price_operator_per_room')`).

## UI

- Tenant: billing card shows room count, surcharge, projected monthly (`lang/en/billing.php`)
- Admin: revenue workspace table + tenant workspace insights

## Tests

`tests/Feature/Billing/RoomPricingTest.php`
