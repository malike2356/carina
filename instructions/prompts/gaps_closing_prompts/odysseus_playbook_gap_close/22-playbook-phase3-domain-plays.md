# Prompt 22 - Playbook Phase 3: Domain Plays (YAML)

## Objective

Load domain-specific play definitions from YAML. Evaluate triggers, activate plays, return path options for real business decisions (property, security, business ops).

---

## Context

**Depends on:** Prompt 21

**Read:** COOKBOOK_TO_PLAYBOOK_ROADMAP Phase 3

---

## Step 1 - Play definition format

`src/playbook/domains/property/offer-negotiation.yml` example:

```yaml
play: deal_offer_negotiation
domain: property
label: Deal offer negotiation
triggers:
  - vendor_counter_above_asking
  - vendor_rejected_offer
inputs:
  - name: counterPercentAboveMax
    type: number
  - name: propertyScore
    type: number
  - name: alternativeDeals
    type: number
paths:
  - id: accept_counter
    label: Accept the counter-offer
    conditions: "counterPercentAboveMax <= 5 && propertyScore >= 80"
    implications: Fast close, higher cost, lower yield
  - id: split_difference
    label: Offer to split the difference
    conditions: "counterPercentAboveMax > 5 && counterPercentAboveMax <= 15"
    implications: Keeps deal alive at moderate cost
  - id: walk_away_signal
    label: Signal willingness to walk away
    conditions: "counterPercentAboveMax > 15 || alternativeDeals >= 3"
    implications: May bring vendor back; risks losing deal
  - id: creative_terms
    label: Propose creative terms
    conditions: "counterPercentAboveMax > 5"
    implications: Rent credit, delayed completion, lease option
```

Create 15 play files minimum:

**property/** (6): deal-sourcing, offer-negotiation, due-diligence, tenant-arrears, portfolio-rebalance, compliance-hmo

**security/** (5): injection-detected, anomaly-spike, breach-confirmed, egress-blocked, compliance-deadline

**business/** (4): client-onboarding, payment-failed, deal-stalled, capacity-alert

---

## Step 2 - play-loader.ts

- Load all YAML from `domains/**`
- Validate schema with zod
- Index by `play` id and `domain`

---

## Step 3 - play-evaluator.ts

```typescript
export interface PlayContext {
  trigger: string;
  domain?: string;
  inputs: Record<string, number | string | boolean>;
}

export function evaluatePlay(ctx: PlayContext): PlaybookResponse | null
```

- Match trigger to play
- Evaluate path `conditions` (simple expression parser or safe eval subset)
- Score applicable paths; return PlaybookResponse

---

## Step 4 - CLI

```
carina playbook play <trigger> --domain property --input counterPercentAboveMax=12 --input propertyScore=82
carina playbook plays [--domain property|security|business]
```

---

## Step 5 - Tests

Per domain: 2 integration tests with known inputs -> expected recommended path id.

Trigger accuracy target: 90% on fixture set (document fixtures in test file).

---

## Acceptance criteria

- [ ] 15 YAML plays load without error
- [ ] `carina playbook play vendor_counter_above_asking ...` returns negotiation paths
- [ ] Scout injection play returns quarantine path when severity high
- [ ] No visual play editor (YAML only, per roadmap)
