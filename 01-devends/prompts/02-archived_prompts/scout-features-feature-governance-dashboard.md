# Feature: Governance Compliance Dashboard

## Context

Scout's existing `public/dashboard.html` is a security engineer's tool: kill switches,
injection events, threat radar, response terminal. It is built for people who understand
what "egress blocked" means.

The people who buy governance are different: CISO, compliance officer, external auditor,
board member. They need a completely separate view. They want to know: are we compliant,
what are our obligations, where are the gaps, and can I export a PDF for the board meeting.

This feature builds `public/governance.html` as a standalone page. It shares the same
auth cookie as the security dashboard but has no security jargon. Every term on the page
is either a plain English word or a named regulatory standard.

Prerequisite: the `GET /api/compliance/regulatory-classification` route from
`feature-regulatory-risk-classification.md` must exist first.

## What to build

### 1. `src/api/governance.ts`

New Express router mounted at `/api/governance` in `server.ts`.

```typescript
import { Router } from 'express';
export const governanceRouter = Router();
```

Register in `server.ts`:
```typescript
import { governanceRouter } from './api/governance.js';
app.use('/api/governance', requireSession, governanceRouter);
```

Note: `requireSession` not `requireApiKey`. This is a browser-facing page, not an SDK
endpoint.

#### `GET /api/governance/posture`

Returns everything the governance dashboard needs in one call. No pagination.

Aggregate from existing sources:

```typescript
interface GovernancePosture {
  generated_at: string;
  
  // Regulatory
  eu_ai_act: {
    tier: string;
    tier_label: string;
    gaps: string[];
    article_refs: string[];
  };
  uk_dsit: {
    alignment: string;
    alignment_label: string;
    principles_met: string[];
    principles_partial: string[];
  };
  
  // Framework alignment scores (0-100)
  frameworks: {
    eu_ai_act_readiness: number; // % of EU AI Act Article 9/12/14 controls in place
    gdpr_readiness: number; // % of GDPR controls (audit log + SAR + deletion)
    soc2_readiness: number; // % of SOC2 type II indicators (logging + access control + monitoring)
    iso42001_readiness: number; // % of ISO 42001 AI management system requirements
  };
  
  // Governance health
  governance_score: number; // 0-100 weighted average of framework scores
  governance_label: string; // 'Compliant' | 'At Risk' | 'Non-Compliant'
  
  // Attestation history (last 5)
  attestations: Array<{
    attested_at: string;
    chain: string;
    tx_hash: string | null;
    risk_score_at_attestation: number | null;
  }>;
  
  // Action items for operator
  action_items: Array<{
    id: string;
    priority: 'critical' | 'high' | 'medium';
    label: string;
    framework: string; // 'EU AI Act' | 'GDPR' | 'SOC2' | 'UK DSIT'
    article: string; // e.g. 'Article 14'
  }>;
  
  // Agent summary (governance-framed, no security jargon)
  agents: {
    total: number;
    governed: number; // have heartbeat in last 24h
    identified: number; // have ERC-8004 identity
    compliant: number; // governed + identified + no unresolved incidents
  };
  
  // Kill switch state (reframed as human oversight status)
  human_oversight: {
    enabled: boolean; // kill switch armed
    last_exercised: string | null; // last kill switch event, ISO8601
    response_time_secs: number | null; // how fast kill switch responded last time
  };
}
```

**Framework readiness scoring:**

Each score is a simple count of controls present / total controls defined.

EU AI Act readiness - controls (Article refs):
- audit_log_active (Art 12): security_events table has rows in last 7 days
- human_oversight_configured (Art 14): kill switch armed
- risk_documented (Art 9): attestation within 60 days
- agent_identity_registered (Art 13): erc8004_status === 'live'
- monitoring_active (Art 9): heartbeat within 24h for at least 1 agent
- incident_response_defined (Art 14): alert channel configured
Score = controls_met / 6 * 100

GDPR readiness - controls:
- audit_log_present: same as above
- sar_route_configured: always true (the route exists)
- deletion_route_configured: always true
- data_retention_configured: check retention_policy table or config
Score = 2 (always) + 2 (if retention configured) / 4 * 100. Honest floor of 50%.

SOC2 readiness - controls:
- continuous_monitoring: heartbeat within 1h
- access_control: API key authentication active (always true)
- audit_logging: security_events rows in last 24h
- incident_tracking: incidents table exists and has rows
- alerting: alert channel configured
Score = controls_met / 5 * 100

ISO 42001 readiness - controls:
- governance_policy: policy pack applied (not 'observe')
- risk_management: risk_score computed and documented
- human_oversight: kill switch armed
- audit_trail: security_events present
- identity_management: erc8004_status !== 'planned'
Score = controls_met / 5 * 100

Governance score = weighted average:
- EU AI Act: 35%
- GDPR: 25%
- SOC2: 20%
- ISO 42001: 20%

Governance label:
- >= 80: 'Compliant'
- >= 55: 'At Risk'
- < 55: 'Non-Compliant'

**Attestation history query:**
```sql
SELECT attested_at, chain, tx_hash, risk_score
FROM trust_attestations
ORDER BY attested_at DESC
LIMIT 5
```
If table does not exist, return empty array (do not throw).

**Action items:** derive from missing controls. Each missing control from the EU AI Act
readiness check becomes an action item with the article reference. Limit to 6 items,
ordered by priority (critical first). Mark as critical if the control is Art 14 (human
oversight) or Art 12 (logging).

#### `GET /api/governance/board-report`

Accepts `?format=pdf` (default) or `?format=json`.

Returns a governance summary report. Not a security event dump. This is a structured
document with sections:

Sections (plain text in PDF):
1. Executive Summary (3 sentences: governance score, EU AI Act tier, primary gap)
2. Regulatory Classification (EU AI Act tier + reasoning + UK DSIT alignment)
3. Framework Alignment (table: framework, score, status, primary gap)
4. Agent Governance Summary (total, governed, identified, compliant)
5. Human Oversight Status (kill switch enabled/last exercised)
6. Attestation History (last 3 attestations)
7. Recommended Actions (top 3 action items)
8. Report Metadata (generated_at, Scout version, account)

PDF generation: use the same raw PDF builder already in `src/api/export.ts`
(the `generatePdf` function). Adapt it for this report structure. Do not add external PDF
libraries.

JSON format returns the GovernancePosture object extended with `report_sections: string[]`.

### 2. `public/governance.html`

Standalone HTML page. Same visual language as `public/dashboard.html` (same CSS
variables, same dark theme, JetBrains Mono font). Do NOT import dashboard.html's CSS.
Duplicate the base variables and reset in a `<style>` block in this file. Keep it
self-contained.

The page authenticates via the same session cookie. On load, fetch
`GET /api/governance/posture`. If 401, redirect to the login page.

#### Layout

```
[header: LABYRINTH SCOUT - GOVERNANCE] [nav: Security Dashboard | Governance (active)]

[governance-score-banner]            <- large; full width
[regulatory-classification-row]      <- two cards: EU AI Act | UK DSIT
[framework-grid]                     <- 2x2: EU AI Act | GDPR | SOC2 | ISO 42001
[bottom-row: agents | oversight | attestations | actions]
[export-bar]                         <- "Export Board Report" button
```

#### Governance score banner

Full-width card. Shows:
- Large number: governance score (e.g. "74")
- Label: "GOVERNANCE SCORE"
- Status badge: "COMPLIANT" / "AT RISK" / "NON-COMPLIANT" in green/amber/red
- Sub-line: e.g. "EU AI Act: Limited Risk · 3 action items"

CSS classes: `.governance-score-banner`, `.score-compliant`, `.score-at-risk`,
`.score-non-compliant`. Same colour scheme as the posture banner in dashboard.html.

#### Regulatory classification cards

Two side-by-side cards.

Left card (EU AI Act):
- Title: "EU AI ACT CLASSIFICATION"
- Value: tier label (e.g. "Limited Risk")
- Colour: green (minimal) / amber (limited) / red (high/unacceptable)
- Body: first 2 items from `reasoning` as a short list
- Footer: article refs (small text)

Right card (UK DSIT):
- Title: "UK DSIT ALIGNMENT"
- Value: alignment label
- Body: "Principles met: Safety, Accountability..." (comma list from `principles_met`)
- Body: "Partial: Fairness, Explainability..." (from `principles_partial`, grey text)

#### Framework alignment grid

2x2 grid of cards. Each card:
- Title: framework name
- Circular or bar progress indicator showing % score (HTML/CSS only, no canvas)
- Status: "Compliant" / "At Risk" / "Review Required"
- One-line description of the primary gap (if any)

For the progress indicator: use a CSS `conic-gradient` circle:
```css
.progress-ring {
  width: 64px; height: 64px; border-radius: 50%;
  background: conic-gradient(var(--green) calc(var(--pct) * 1%), var(--lift) 0);
}
```
Set `--pct` via inline style from JS.

#### Agents card

Table with columns: Agent ID | Status | Identified | Incidents
Populated from `agents` in the posture response.
Show: governed/total as a fraction, compliant/total as a fraction.
Label: "Governed Agents" not "Monitored Agents".

#### Human oversight card

Shows: "Human Override: ENABLED / DISABLED"
Last exercised: relative timestamp or "Never exercised"
Response time: "< 30s" or "N/A"

#### Attestation timeline

List of last 5 attestations. Each row: date | chain | tx hash (truncated, links to
explorer if chain is 'live' on Base mainnet). If no attestations: "No attestations
recorded. Run `scout trust:attest` to create one."

#### Action items

Ordered list. Each item: priority badge (CRITICAL / HIGH / MEDIUM) | label | framework tag | article ref.
Max 6 items. If 0: green box "No action items. Governance posture is complete."

#### Export bar

Sticky bottom bar:
```html
<div class="export-bar">
  <span class="export-label">Board Report</span>
  <button id="btn-export-pdf" class="export-btn">Export PDF</button>
  <button id="btn-export-json" class="export-btn secondary">Export JSON</button>
  <span id="export-status" class="export-status"></span>
</div>
```

On click, `GET /api/governance/board-report?format=pdf` with the session cookie. Trigger
browser download via Blob URL. Show "Generating..." while fetching.

#### Auto-refresh

Poll `GET /api/governance/posture` every 60 seconds. Update all values in place.
No page reload.

### 3. Navigation links between dashboards

In `public/dashboard.html`, add a link to `public/governance.html` in the header nav:
```html
<a href="/governance" class="nav-link">Governance</a>
```

In `public/governance.html`, add a link back:
```html
<a href="/" class="nav-link">Security</a>
```

The ops panel serves `public/` as static files. Both pages are at root paths `/` and
`/governance`. Confirm the ops panel's static file serving routes these correctly. If not,
add an explicit route in `server.ts`:
```typescript
app.get('/governance', requireSession, (_req, res) => {
  res.sendFile(path.join(publicDir, 'governance.html'));
});
```

### 4. Tests

File: `src/api/__tests__/governance.test.ts`

10 tests using Vitest + supertest (same pattern as existing API tests):

1. `GET /api/governance/posture returns 401 without session`
2. `GET /api/governance/posture returns 200 with valid session`
3. `posture response has all required top-level keys`
4. `governance_score is a number 0-100`
5. `governance_label is one of Compliant / At Risk / Non-Compliant`
6. `framework scores are all 0-100`
7. `action_items each have priority, label, framework, article`
8. `attestations array exists (empty is valid)`
9. `GET /api/governance/board-report returns PDF content-type`
10. `GET /api/governance/board-report?format=json returns governance data`

Mock the DB pool for unit-style tests. Use a test session to get past `requireSession`.

## Files to create/modify

- CREATE `src/api/governance.ts`
- CREATE `src/governance/framework-scorer.ts` (the scoring logic, exported from governance.ts)
- CREATE `public/governance.html`
- CREATE `src/api/__tests__/governance.test.ts`
- MODIFY `src/server.ts` - mount governanceRouter + add /governance static route
- MODIFY `public/dashboard.html` - add nav link to /governance

## Do not change

- `src/api/compliance.ts` - the GDPR routes stay as-is
- `src/api/export.ts` - the security event export stays as-is
- `public/dashboard.html` beyond adding the nav link

## Acceptance check

Run `npm test`. All tests pass including the 10 new ones.
Navigate to `http://localhost:4444/governance` in browser. The page loads, shows a
governance score, two regulatory cards, four framework cards, and the Export PDF button
downloads a file ending in `.pdf`.
