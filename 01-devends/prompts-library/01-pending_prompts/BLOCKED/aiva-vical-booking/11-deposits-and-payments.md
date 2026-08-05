# 11: Deposits and payments (optional owner gate)

**Status:** PENDING
**Priority:** P2 (do not start without explicit owner approval)
**Depends on:** 03, 05, Stripe access file
**Unlocks:** paid sessions / deposits on public book

## Goal

Optional parity with Propreneur deposit Checkout: event types requiring payment create `pending_payment` bookings, Stripe Checkout collects using **existing** price IDs only, then `pending_payment` → `confirmed` (or `pending_review` if both flags).

## Reuse first

- Propreneur: `VcalDepositCheckoutService`, `VcalDepositPaymentCompletionService`, `VcalRefundService`, help `07-booking-payments.md`.
- Stripe SoT: `/opt/lampp/htdocs/verlox/.access/.stripe-credentials-and-price-id.md` (labels/IDs only; never paste secrets into chat/commits).
- Existing Carina/Aiva billing plumbing; do not invent prices.

## Requirements

1. Owner must explicitly approve this prompt before build; if not, leave status PENDING and skip archive.
2. Flag on event type: requires_deposit + price reference (Stripe price id from access file mapping / workspace entitlement).
3. Public book: redirect to Checkout; return/cancel URLs; webhook or return handler completes booking.
4. Hold slot while `pending_payment` with expiry; release if abandoned (job).
5. Refunds only via existing Stripe refund patterns; host "refund" action if product needs it.
6. Never create new Stripe prices from code/tests/admin unless owner asks in session.
7. Tests with Stripe test mode / mocked Checkout session.

## Acceptance criteria

- [ ] Unpaid booking does not become confirmed.
- [ ] Successful test payment confirms and triggers conferencing/sync hooks.
- [ ] Abandoned payment expires and frees slot.
- [ ] No new Stripe prices created by implementation.

## Integration

- Outreach discovery remains free by default (`collectDeposit=false` internal create), matching Propreneur internal booking behaviour.
