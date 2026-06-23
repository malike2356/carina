# Feature: Regulatory Risk Classification

## Context

Labyrinth Scout at `console.labyrinthscout.com/` already has an internal risk tier
system (`low/moderate/elevated/high/critical` in `src/trust/compute-trust-metrics.ts`).
That system is for security engineers. This feature adds a second classification layer
that maps Scout's runtime data to regulatory categories that compliance officers and
boards understand: EU AI Act risk tiers and UK DSIT alignment levels.

The EU AI Act enforcement starts August 2026. Enterprise customers in the UK will begin
using these categories for procurement and audit purposes now. This classification is
what makes Scout legible to the people who buy governance.

## What to build

### 1. `src/governance/regulatory-classification.ts`

New file. Exports a single function `classifyRegulatoryRisk(input)`.

```typescript
export type EuAiActTier =
  | 'minimal_risk'      // no regulation required
  | 'limited_risk'      // transparency obligations only (Article 52)
  | 'high_risk'         // conformity assessment required (Article 6 + Annex III)
  | 'unacceptable_risk'; // prohibited (Article 5) - flag only, no Scout deployment should reach this

export type UkDsitAlignment =
  | 'aligned'       // meets DSIT white paper principles
  | 'partial'       // meets transparency; explainability not evidenced
  | 'not_assessed'; // insufficient data

export interface RegulatoryClassification {
  eu_ai_act: {
    tier: EuAiActTier;
    tier_label: string;
    reasoning: string[]; // human-readable list of facts that led to this tier
    article_refs: string[]; // e.g. ['Article 52', 'Recital 47']
    gaps: string[]; // what is missing to reach lower tier
  };
  uk_dsit: {
    alignment: UkDsitAlignment;
    alignment_label: string;
    principles_met: string[];
    principles_partial: string[];
  };
  assessed_at: string; // ISO8601
  data_sufficient: boolean; // false if fewer than 3 days of telemetry
}
```

Classification logic. Read from the PostureSummary and TrustHealthSummary types already
exported by `src/dashboard/widgets/posture-summary.ts`.

**EU AI Act tier decision tree:**

Start at `limited_risk`. Upgrade to `high_risk` if ANY of:
- `risk_score >= 60`
- `incidents.unresolved_critical > 0`
- `control_plane.kill_switch_triggered === true`
- `trust.erc8004_status !== 'live'` AND `agents.total > 0` (no identity, agents running)

Downgrade to `minimal_risk` if ALL of:
- `risk_score <= 20`
- `control_plane.kill_switch_armed === true`
- `trust.last_attestation_at` is within 30 days
- `control_plane.alert_channels_configured === true`
- `incidents.unresolved_critical === 0`

Flag `unacceptable_risk` (never in normal operation; only if): risk_score >= 90 AND
kill_switch triggered AND breach events in last 24h. This is an alert, not a normal tier.

`reasoning` must always list 2-5 plain-English statements like:
- "Risk score is 15 (threshold: <= 20 for Minimal Risk)"
- "Kill switch is armed and configured"
- "ERC-8004 agent identity registered on-chain"
- "No unresolved critical incidents in the last 30 days"

`gaps` must list what the operator must do to reach the next lower tier. If already at
`minimal_risk`, gaps is empty.

`article_refs`:
- minimal_risk: ['Recital 47 - no specific obligations']
- limited_risk: ['Article 52 - transparency obligations']
- high_risk: ['Article 6', 'Annex III', 'Article 9 - risk management system required',
               'Article 12 - logging obligations', 'Article 14 - human oversight']
- unacceptable_risk: ['Article 5 - prohibited practice']

**UK DSIT alignment decision:**

`aligned` if: audit logs present + kill switch configured + attestation on-chain.
`partial` if: audit logs present but no attestation or no kill switch armed.
`not_assessed` if: fewer than 72 hours of telemetry OR `data_sufficient === false`.

`principles_met` list (check each): 'Safety', 'Security', 'Fairness', 'Accountability',
'Transparency', 'Explainability', 'Contestability', 'Governance'.

Map:
- Safety: kill_switch_armed
- Security: alert_channels_configured AND egress_filter_enabled
- Accountability: erc8004_status === 'live'
- Transparency: audit log has events in last 7 days
- Governance: attestation within 30 days
- Fairness/Explainability/Contestability: mark as 'partial' always (Scout doesn't measure these - be honest)

### 2. Add `GET /api/governance/classification` to `src/api/compliance.ts`

Mount point: already mounted at `/api/compliance` in `server.ts`.

```
GET /api/compliance/regulatory-classification
```

Requires `requireApiKey`. NOT `requireScoutPro` (regulatory classification is a
standard feature, not gated behind Pro).

Handler:
1. Call `dashboardRouter` internals or query the DB directly to get PostureSummary
   fields. Re-use the existing `buildPostureSummary` helpers from
   `src/dashboard/widgets/posture-summary.ts` and the aggregation already done in
   `GET /api/dashboard/posture`.
   
   Simpler: make a direct DB query for the 5 values needed:
   - risk_score: query the last known risk score from `public_trust_cache` or compute
     fresh via `computeRiskScore`
   - kill_switch_armed/triggered: from `globalKillSwitch`
   - unresolved_critical: `SELECT COUNT(*) FROM incidents WHERE status != 'resolved'
     AND severity = 'critical'`
   - last_attestation_at: from `trust_attestations` table (most recent `attested_at`)
   - alert_channels_configured: check `TELEGRAM_BOT_TOKEN` or similar config
   - erc8004_status: from `trust_registrations` table

2. Call `classifyRegulatoryRisk(input)` and return the result as JSON.

3. Cache in Redis for 5 minutes under key `scout:regulatory:classification` to avoid
   re-querying on every dashboard refresh. Invalidate on kill switch state change.

Response shape:
```json
{
  "eu_ai_act": {
    "tier": "limited_risk",
    "tier_label": "Limited Risk",
    "reasoning": ["Risk score is 18 (below 20 threshold for Minimal Risk)", "..."],
    "article_refs": ["Article 52 - transparency obligations"],
    "gaps": ["Configure alert channels to qualify for Minimal Risk"]
  },
  "uk_dsit": {
    "alignment": "aligned",
    "alignment_label": "Aligned with DSIT white paper principles",
    "principles_met": ["Safety", "Accountability", "Transparency", "Governance"],
    "principles_partial": ["Fairness", "Explainability", "Contestability"]
  },
  "assessed_at": "2026-06-13T16:00:00.000Z",
  "data_sufficient": true
}
```

### 3. Add regulatory classification to posture summary

In `src/dashboard/widgets/posture-summary.ts`:

Add `regulatory` field to `PostureSummary` interface:

```typescript
regulatory: {
  eu_ai_act_tier: EuAiActTier;
  eu_ai_act_label: string;
  uk_dsit_alignment: UkDsitAlignment;
  gaps_count: number; // how many gaps remain
} | null; // null when data_sufficient === false
```

Call `classifyRegulatoryRisk` inside `buildPostureSummary` and populate this field.
Pass the PostureSummary inputs directly (they are already assembled at that call site).

### 4. Dashboard display

In `public/dashboard.html`, add a `Regulatory` metric card to the Live Posture section
(the same `.op-section` row that has Risk Score, Agents Active, etc.).

The card shows the EU AI Act tier. Use these colours:
- minimal_risk: `var(--green)`
- limited_risk: `var(--amber)` (define `--amber: #f5a623` if not present)
- high_risk: `var(--red)`
- unacceptable_risk: `var(--red)` with blinking

Card HTML:
```html
<div class="op-metric" id="posture-regulatory-card" data-help="posture-regulatory-tier">
  <div class="label">EU AI Act</div>
  <div class="value" id="posture-regulatory-tier">-</div>
  <div class="delta flat" id="posture-regulatory-gaps">assessing...</div>
</div>
```

In the dashboard JS, inside the posture polling function, populate:
- `#posture-regulatory-tier` with the tier label, colored
- `#posture-regulatory-gaps` with "N gaps remaining" or "Compliant"

Tooltip on hover: show the first 2 items from `reasoning` in the card's `title` attribute.

### 5. Tests

File: `src/governance/__tests__/regulatory-classification.test.ts`

8 tests using Vitest:

1. `minimal_risk: all conditions met returns minimal_risk with empty gaps`
2. `limited_risk: missing attestation prevents minimal_risk`
3. `high_risk: unresolved critical incident forces high_risk`
4. `high_risk: risk_score >= 60 forces high_risk`
5. `unacceptable_risk: risk >= 90 + breach + kill triggered`
6. `uk_dsit aligned: kill switch + attestation + audit logs`
7. `uk_dsit partial: no attestation`
8. `data_sufficient false: fewer than 3 days telemetry returns not_assessed for uk_dsit`

No mocking of DB - pass constructed input objects directly to `classifyRegulatoryRisk`.

## Files to create/modify

- CREATE `src/governance/regulatory-classification.ts`
- CREATE `src/governance/__tests__/regulatory-classification.test.ts`
- MODIFY `src/api/compliance.ts` - add `GET /regulatory-classification` route
- MODIFY `src/dashboard/widgets/posture-summary.ts` - add `regulatory` field
- MODIFY `public/dashboard.html` - add regulatory metric card

## Do not change

- `src/trust/compute-trust-metrics.ts` - do not touch the existing risk tier system
- `src/server.ts` - no new routes needed (compliance router already mounted)
- Existing compliance routes (GDPR SAR/report/erase)

## Acceptance check

Run `npm test`. All existing tests pass. 8 new tests pass.
`curl -H "X-Scout-Key: $SCOUT_API_KEY" http://localhost:4444/api/compliance/regulatory-classification`
returns valid JSON with `eu_ai_act.tier` one of the four valid values.
