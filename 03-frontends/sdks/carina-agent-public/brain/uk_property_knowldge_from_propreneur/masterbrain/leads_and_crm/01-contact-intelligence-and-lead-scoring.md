# Contact Intelligence & Lead Scoring

**Last updated:** 2026-05-02 (implementation pass: tenant migration `2026_05_02_700000_contacts_investor_intelligence.php`, services, API, tests)
**Scope:** Investment score model, investor profile, deal quality scoring, engagement tiers

---

## Philosophy: Investment Intelligence, Not Marketing Intelligence

BenchStack-class platforms score contacts based on marketing engagement: email opens, page visits, form fills.
That is useful for a dentist or a gym. It is useless for a property investor platform where the
quality signal is not "did they open an email" but "do they have £150k available for a BRR deal
in the North West and are they looking right now?"

Propreneur's scoring model is built around three questions:

1. **Can they invest?** - Capital available, strategy confirmed, portfolio stage
2. **Are they engaged?** - Activity with deals, Carina, replies to communications
3. **Do we have something for them?** - Active deal inventory matching their criteria

Those three dimensions produce a total score (0-100) that drives the Communications Hub
(which sequence tier they're in), the CRM view (sort by score), and Carina context
(Carina knows who the hot investors are).

---

## Investor as First-Class Contact Type

The `contacts` table already has a `type` enum. When `type = 'investor'`, a set of extra
fields (stored in `investment_profile` JSONB) unlocks the full scoring model.

### `investment_profile` JSONB structure

```json
{
  "preferred_strategies": ["brr", "hmo"],
  "target_roi_pct": 8.0,
  "min_deal_size": 100000,
  "max_deal_size": 350000,
  "preferred_regions": ["M", "LS", "B"],
  "available_capital": 180000,
  "capital_confirmed": true,
  "investment_timeline": "0-6-months",
  "risk_appetite": "medium",
  "portfolio_stage": "growing",
  "total_invested": 420000,
  "active_deals_count": 3
}
```

Fields:
- `preferred_strategies` - array of strategy keys matching deal_analyses strategies
- `target_roi_pct` - minimum acceptable ROI
- `min_deal_size` / `max_deal_size` - asking price range they'll look at
- `preferred_regions` - postcode area prefixes (M = Manchester, LS = Leeds, B = Birmingham)
- `available_capital` - how much they can deploy now
- `capital_confirmed` - operator has verified this (not self-reported)
- `investment_timeline` - one of: `immediate`, `0-6-months`, `6-12-months`, `12-months-plus`
- `risk_appetite` - `low`, `medium`, `high`
- `portfolio_stage` - `starting` (0 properties), `growing` (1-5), `established` (6-20), `portfolio` (20+)
- `total_invested` - cumulative capital committed across all deals (computed from deal_analyses if available)
- `active_deals_count` - number of live deals they're involved in

### Schema additions to `contacts` table (implemented)

Migration `database/migrations/tenant/2026_05_02_700000_contacts_investor_intelligence.php` adds:

- `investment_profile`, `investment_criteria` (jsonb, nullable)
- `investment_score_engagement`, `investment_score_capacity`, `investment_score_match`, `investment_score_total` (0-100 total is sum of the three components)
- `engagement_stage` (default `new`), `last_engagement_at`, `last_investor_score_at`
- `total_invested`, `deals_won`, `preferred_asset_classes`, `min_budget`, `max_budget`, `target_yield_min`, `investment_horizon_months`, `leverage_required`, `max_ltv`

Table `investor_profiles`: `contact_id` (unique), `past_deals`, `capital_deployed_by_asset_class`, `engagement_history`, `communication_preferences`, `profile_tags` (all jsonb nullable).

The older placeholder column names in the sections below (`engagement_score` as a column name, etc.) refer to the **conceptual** model; live code uses the `investment_score_*` names above.

---

## Scoring Model

### 1. Investment Readiness Score (0-40 points)

Measures how ready this contact is to actually invest. This only applies to `type = 'investor'`
contacts. All other contact types receive 0 for this dimension.

| Signal | Points |
|---|---|
| `investment_profile` filled with preferred_strategies | +8 |
| `capital_confirmed = true` | +12 |
| `investment_timeline` is `immediate` or `0-6-months` | +10 |
| `available_capital` > 0 confirmed | +10 |

Max: 40 points

### 2. Engagement Score (0-35 points)

Measures recent activity with Propreneur - deal-specific activity, not generic web engagement.

| Signal | Points | Decay |
|---|---|---|
| Carina conversation in last 30 days | +10 | Resets after 60 days inactivity |
| Replied to a communication (SMS or email) | +8 | Last reply only |
| Viewed a deal (deal show page visit) | +5 per deal (max 15) | Resets after 90 days |
| Opened a communication | +3 per open (max 9) | Rolling 30-day window |
| Pipeline card linked to this contact had activity | +5 | Last 30 days |

Max: 35 points (intentionally capped - engagement without investment profile should not produce a top score)

Engagement signals are stored as a JSON array in `engagement_signals`:
```json
[
  {"type": "carina_conversation", "at": "2026-04-28T14:23:00Z", "points": 10},
  {"type": "communication_reply", "at": "2026-04-25T09:15:00Z", "points": 8},
  {"type": "deal_viewed", "deal_id": "uuid", "at": "2026-04-20T11:00:00Z", "points": 5}
]
```

### 3. Deal Match Score (0-25 points)

Measures whether there are active deals in the workspace inventory that match this investor's criteria. Recomputed each time `SourcingMatchService` runs.

| Signal | Points |
|---|---|
| ≥ 1 unshared deal scored >75 by SourcingMatchService for this contact | +15 |
| ≥ 1 deal within their price range and preferred strategy | +10 |

Max: 25 points

---

## Total Score & Engagement Tiers

```
Total = investment_score_engagement + investment_score_capacity + investment_score_match (capped at 100)
```

| Total | Tier | `engagement_stage` | Action |
|---|---|---|---|
| 70-100 | Hot | `active` | Surface at top of CRM; assign to operator; trigger immediate sequence |
| 40-69 | Warm | `warm` | Keep in nurture sequence; send deal matches when scored >75 |
| 15-39 | Cold | `cold` | Quarterly re-engagement only |
| 0-14 | Dormant | `cold` | No automated comms; manual only |

The `engagement_stage` column on `contacts` maps to these tiers and is used by the
Communications Hub to determine which sequence tier an investor sits in.

---

## Services

### `ContactScoringService`

```php
class ContactScoringService
{
    public function score(Contact $contact): ScoringResult
    // Computes all three dimensions, writes back to contact, fires ContactScored event

    public function scoreInvestmentReadiness(Contact $contact): int
    // Reads investment_profile JSONB, returns 0-40

    public function scoreEngagement(Contact $contact): int
    // Reads engagement_signals, applies decay, returns 0-35

    public function scoreDealMatch(Contact $contact): int
    // Queries SourcingMatchService for current matches, returns 0-25

    public function recordSignal(Contact $contact, string $type, array $meta = []): void
    // Appends to engagement_signals, triggers score refresh
}
```

### `ContactEngagementScorer` (event listener)

Listens to:
- `CommunicationSent` → `recordSignal('communication_sent')`
- `CommunicationOpened` → `recordSignal('communication_opened')`
- `CommunicationReplied` → `recordSignal('communication_reply')` + increment score immediately
- `CarinaConversationStarted` (existing event) → `recordSignal('carina_conversation')`
- `PipelineDealActivityLogged` → `recordSignal('pipeline_activity')`

### `RefreshContactScoresJob`

Scheduled nightly at 02:00. Loops all contacts per tenant, runs `ContactScoringService::score()`,
detects tier transitions, fires `ContactTierChanged` event.

`ContactTierChanged` → Communications Hub checks if the new tier triggers an enrollment change.

---

## Deal Quality Score

Separate from contact scoring. Scores each `DealAnalysis` record on deal merit.
Stored in `deal_analyses.quality_score` (new int column).

| Signal | Points |
|---|---|
| ROI ≥ 8% | +25 |
| ROI 5-7.9% | +15 |
| Gross yield ≥ 7% | +20 |
| Monthly cashflow positive | +15 |
| Asking price < PropertyData `valuation` estimate | +15 |
| All financial fields complete (no nulls) | +10 |
| Deal linked to a real property (not standalone) | +5 |
| Carina narrative generated | +5 |
| Sensitivity analysis run | +5 |

Max: 100 points

```
quality_score ≥ 70 → "Strong deal" badge on deal index/show views
quality_score 40-69 → "Solid deal" badge
quality_score < 40 → No badge
```

`DealQualityScoringService` runs automatically after:
- `DealAnalysis` created or updated
- Calculator run via `DealCalculatorController`
- PropertyData enrichment fetch
- Carina narrative generated

---

## CRM Integration

### Contact Index Sort Options
New sort option: "Score - highest first" (default for investor-type contacts).

### Contact Show Page
New sidebar card: "Investment Profile" (investor contacts only) showing:
- Investment score ring (0-100 visual)
- Tier badge (Hot / Warm / Cold)
- Preferred strategy chips
- Available capital
- Last engagement date

### CRM Filter Additions
- Filter by `engagement_stage`: Hot / Warm / Cold
- Filter by `investment_profile.preferred_strategies`: BTL / HMO / BRR / R2R / SA / Flip
- Filter by `investment_profile.available_capital`: range slider

---

## Carina Integration

When a user asks Carina "Who are my best investors for this BRR deal?", Carina can:
1. Query contacts with `type = 'investor'` and `investment_profile.preferred_strategies` containing `brr`
2. Sort by `total_score` descending
3. Filter by `investment_profile.max_deal_size` ≥ deal asking price
4. Return ranked list with reasons

This makes Carina a deal-investor matchmaker, not just a question-answering chatbot.

---

## Phased Build Plan

### Phase 1 - Data Layer

| Item | Description |
|---|---|
| Migration: scoring columns on contacts | investment_profile, engagement_score, investment_score, deal_match_score, total_score, engagement_stage, engagement_signals, last_scored_at |
| Migration: quality_score on deal_analyses | int column, default 0 |
| `ContactScoringService` | investment readiness + engagement calculation |
| `DealQualityScoringService` | deal scoring, triggered from DealController |
| `RefreshContactScoresJob` | nightly batch scoring |
| Contact model updates | $casts for JSONB fields, engagement_stage enum |
| Pest tests | scoring rules, tier transitions |

### Phase 2 - UI

| Item | Description |
|---|---|
| Investment Profile card on Contact show | Investor type only |
| Score column on Contact index | Sortable, with tier badge |
| CRM filter: engagement_stage, strategy, capital | |
| Deal quality badge on Deal index/show | Strong / Solid badges |

### Phase 3 - Carina Integration

| Item | Description |
|---|---|
| "Who are my best investors for this deal?" query | Carina queries contact scoring |
| Investor match notification on deal creation | If new deal scores >75 for an investor, surface in Carina |
| Portfolio-level scoring dashboard | Which investors have capacity right now |

---

## Migration Skeleton

```php
Schema::table('contacts', function (Blueprint $table) {
    $table->jsonb('investment_profile')->nullable()->after('custom_fields');
    $table->unsignedSmallInteger('investment_score')->default(0)->after('investment_profile');
    $table->unsignedSmallInteger('engagement_score')->default(0)->after('investment_score');
    $table->unsignedSmallInteger('deal_match_score')->default(0)->after('engagement_score');
    $table->unsignedSmallInteger('total_score')->default(0)->after('deal_match_score');
    $table->string('engagement_stage', 20)->default('cold')->after('total_score');
    $table->jsonb('engagement_signals')->nullable()->after('engagement_stage');
    $table->timestamp('last_scored_at')->nullable()->after('engagement_signals');
    $table->timestamp('last_engagement_at')->nullable()->after('last_scored_at');
});

Schema::table('deal_analyses', function (Blueprint $table) {
    $table->unsignedSmallInteger('quality_score')->default(0)->after('status');
});
```

---

*Related: `31-comms-and-engagement-engine.md`, `05-crm.md`, `04-deals.md`, `29-deals-module-strategy.md`*
