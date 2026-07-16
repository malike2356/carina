# Deal Market Intelligence (Market Timing + AirDNA)

**Last updated:** 2026-05-20

## Overview

Two sets of market intelligence fields extend `deal_analyses` to help investors assess whether the timing and short-term rental potential of a deal are favourable. Market timing fields track when a property was listed and any price reductions during negotiation. AirDNA fields store a short-term rental market snapshot for the property's location, used primarily for Serviced Accommodation (SA) and HMO strategy analysis.

## Key columns added to `deal_analyses`

| Column | Type | Description |
|---|---|---|
| `listed_at` | `date`, nullable | Date the property was first listed for sale |
| `price_reductions` | `jsonb`, nullable | Array of price reduction events (see structure below) |
| `airdna_snapshot` | `jsonb`, nullable | AirDNA market data payload for the property's location |
| `airdna_snapshot_at` | `timestamptz`, nullable | When the AirDNA snapshot was last fetched |

These columns join the existing `propertydata_market_snapshot` and `propertydata_market_snapshot_at` columns already on `deal_analyses`.

### `price_reductions` structure

Each element in the JSONB array is an object:

```json
{
  "date": "2025-11-15",
  "from": 275000,
  "to": 260000,
  "note": "Vendor motivated to sell before Christmas"
}
```

`from` and `to` are integers in pounds (not pence).

### `airdna_snapshot` structure

Populated by the AirDNA API (`api.airdna.co/api/v1/market/search`):

```json
{
  "location": "E1 6RF",
  "occupancy_rate": 0.78,
  "avg_daily_rate": 95.50,
  "median_nightly_rate": 88.00,
  "revenue_potential": 27000.00,
  "listing_count": 142,
  "demand_score": 82,
  "fetched_at": "2026-05-20T10:30:00+00:00",
  "raw": { ... }
}
```

## Routes / entry points

| Route | Method | Description |
|---|---|---|
| `POST /deals/{deal}/price-reduction` | `DealController::recordPriceReduction` | Log a new price reduction event |
| `GET /api/deals/{deal}/airdna` | `DealController::airDnaData` | Fetch and cache AirDNA data for the deal's location |

## How it works

### Recording a price reduction

1. From the deal workspace, the user clicks "Record price drop" and fills in `reduced_on` (date), `from_price`, `to_price`, and an optional `note`.
2. `DealController::recordPriceReduction` validates that `to_price < from_price` and that `reduced_on` is not in the future.
3. The new reduction object is appended to the existing `price_reductions` JSONB array and saved.

### Market timing helper

`DealAnalysis::daysOnMarket()` calculates `listed_at->diffInDays(now())`. This gives investors a quick read on whether a property has been sitting (motivated seller signal) or is freshly listed.

### Fetching AirDNA data

1. User opens a deal with strategy `sa` or `hmo` and triggers the AirDNA lookup (button in the deal workspace).
2. `DealController::airDnaData` aborts with 422 if the strategy is not `sa` or `hmo`.
3. The location is resolved from: `deal->property->postcode`, then `deal->metrics->postcode`, then `deal->metrics->city`. If none is found, returns 422.
4. `AirDnaService::isConfigured()` checks for `airdna_api_key` in `platform_settings`. If not configured, returns JSON `{error: "not_configured"}`.
5. `AirDnaService::marketData()` calls `GET https://api.airdna.co/api/v1/market/search` with `location` and `currency=GBP`. Timeout: 10 seconds.
6. On success, the normalised payload is saved to `airdna_snapshot` and `airdna_snapshot_at` is set to now.
7. Returns JSON `{data: {...}, stamped_at: "ISO8601"}`.

### Configuration

The AirDNA API key is stored as a `PlatformSetting` with key `airdna_api_key`. Admins set it via Platform Admin > Settings. Without this key, the AirDNA button is disabled.

## Carina context

Carina can read market timing and AirDNA data from deal analyses. Relevant questions:

- "How long has this property been on the market?"
- "Has the asking price been reduced?"
- "What is the AirDNA occupancy rate for this location?"
- "What average daily rate does AirDNA show for SA in this area?"
- "Is this a good time to buy based on market timing?"
- "What is the revenue potential for short-term rental here?"

Carina should know:
- `listed_at` enables days-on-market calculation - longer time on market often indicates a motivated seller
- Price reductions signal negotiating room or vendor urgency
- AirDNA data is only fetched for SA and HMO strategies
- `airdna_snapshot_at` shows how fresh the data is - data older than 30 days should be re-fetched
- AirDNA requires a platform-level API key set by Verlox admins
