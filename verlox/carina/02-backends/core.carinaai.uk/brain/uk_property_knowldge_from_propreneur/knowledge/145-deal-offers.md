# Deal Offers

**Last updated:** 2026-05-20

## Overview

Deal Offers is a sub-feature of the Deal Engine that tracks the negotiation history for a deal analysis. When pursuing a property, multiple prices change hands - the asking price, an offer you make, counter-offers from the vendor, and ultimately acceptance or rejection. Each price event is logged as a `DealOffer` row tied to a `DealAnalysis`.

## Key tables

| Table | Key columns |
|---|---|
| `deal_offers` | `id`, `deal_analysis_id` (FK to `deal_analyses`), `property_id` (nullable, FK to `properties`), `offer_type`, `amount_minor` (pence), `from_party` (max 100 chars, nullable), `notes` (max 2000 chars, nullable), `offered_at` (timestamp), `created_by` (FK to `users`); indexed on `(deal_analysis_id, offered_at)` |

### `offer_type` values

| Value | Label |
|---|---|
| `asking_price` | Asking price |
| `offer_made` | Offer made |
| `counter_offer` | Counter-offer |
| `accepted` | Accepted |
| `rejected` | Rejected |

## Routes / entry points

Routes are nested under deals, scoped per tenant.

| Route | Controller action | Description |
|---|---|---|
| `POST /deals/{deal}/offers` | `DealOfferController::store` | Log a new offer event |
| `DELETE /deals/{deal}/offers/{offer}` | `DealOfferController::destroy` | Remove an offer record |

## How it works

### Logging an offer

1. From the deal workspace or deal show page, the user fills in the offer form with `offer_type`, `amount` (in pounds, decimal), `from_party` (optional - who made the offer), `notes`, and `offered_at` date.
2. `DealOfferController::store` validates the input and creates a `DealOffer` record. The amount is stored as pence: `(float) amount * 100` rounded to integer.
3. `property_id` is copied from the parent `DealAnalysis::property_id` automatically.

### Deleting an offer

`DealOfferController::destroy` checks that the offer's `deal_analysis_id` matches the URL parameter before deleting. No soft delete - the row is permanently removed.

### Displaying offers

`DealOffer::typeLabel()` returns a human-readable label for the `offer_type`. `DealOffer::amountFormatted()` returns a formatted GBP string (e.g. `£185,000`).

### Relationships

- `DealOffer::deal()` - belongs to `DealAnalysis` via `deal_analysis_id`
- `DealOffer::creator()` - belongs to `User` via `created_by`
- `DealAnalysis` has many `DealOffer` (relationship defined on the `DealAnalysis` model)

## Carina context

Carina has access to deal offers via the `DealsToolHandler`. Carina can answer questions like:
- "What offers have been made on this deal?"
- "What is the latest offer status?"
- "Has the vendor accepted our offer on [property]?"
- "What was the original asking price vs our offer?"
- "Show me the negotiation history for [deal]"

Carina should know: amounts are stored in pence but displayed in pounds; `offered_at` is the date the event occurred (not necessarily when it was logged); `from_party` identifies who made the offer (e.g. `Vendor`, `Agent`, or a person's name).
