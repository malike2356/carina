# Deal Analysis by Buyer Goal

**Status:** Reference knowledge
**Source:** PropSource masterclass (4 May 2026) -- the 122k flat case study
**Related:** Deal Engine (`04-deals.md`, `29-deals-module-strategy.md`), Deal Calculators (`10-deal-calculators.md`)

---

## 1. The Core Insight: "Good Deal" Depends on Who's Buying

Industry analysis demonstrated a 3-bed flat:
- Purchase price: 122,000
- Refurb: 10,000
- Sourcing fee: 5,000
- Total all-in: 137,000
- Post-refurb value: 135,000
- Cash flow: 900/month

**Majority of attendees called it a BAD deal** (because margin was thin, flippers couldn't profit).

**But it was actually a GOOD deal** for the right buyer because:
- 900/month cash flow on ~50k investment = 18-22% ROI
- The average UK salary is ~3,000/month
- Three deals like this replace a full-time salary
- Passive, hands-off, tenant-paid

---

## 2. Deal Analysis by Buyer Persona

### 2.1 The Flipper / BRR Investor
**Goal:** Maximum equity gain, exit quickly

| Metric | Target |
|--------|--------|
| Minimum margin | 20-30% after all costs |
| ROI on capital | 50%+ |
| Hold time | 3-12 months |
| Key metric | Gross profit minus costs |

**Filters for:** Below market value, forced appreciation potential, quick exit market

### 2.2 The Cash-Flow Investor (Armchair)
**Goal:** Passive income, long-term hold, portfolio building

| Metric | Target |
|--------|--------|
| Minimum cash flow | 200+/month per property |
| ROI on deposit | 10%+ |
| Hold time | 10-30 years |
| Key metric | Net monthly cash flow / total invested |

**Filters for:** Tenant demand, rental yield, low maintenance, good area

### 2.3 The JV Partner
**Goal:** Leverage other people's skills, split profit

| Metric | Target |
|--------|--------|
| Minimum deal profit | 20k+ (to split) |
| Risk level | Medium |
| Involvement | Strategic, not hands-on |
| Key metric | Total profit split |

**Filters for:** Clear exit strategy, experienced operator, good deal structure

### 2.4 The Angel Investor
**Goal:** Better return than bank (3.75% interest), capital preservation

| Metric | Target |
|--------|--------|
| Minimum ROI | 8-15% (beats inflation + bank) |
| Risk level | Low to medium |
| Security | First charge / secured |
| Key metric | ROI vs bank rate + inflation |

**Filters for:** Stable cash flow, good area, long-term hold, low void risk

---

## 3. The 5-Factor Deal Analysis Framework

| Factor | What to Assess | Flipper Weight | Cash-Flow Weight |
|--------|---------------|----------------|------------------|
| Location | Transport, amenities, schools, employment | High | High |
| Condition | Refurb cost vs end value | High | Medium |
| Structure | Freehold/leasehold, tenancy type | Medium | High |
| Numbers | Purchase + costs vs value + income | Critical | Critical |
| Exit | Who will buy/rent this? | Critical | Medium |

---

## 4. Decision Tree for Deal Routing

```
Is there minimum 20% gross margin after refurb?
├── YES --> Can we flip it within 6 months?
│   ├── YES --> Route to flippers / BRR investors
│   └── NO --> Can we hold for cash flow?
│       ├── YES --> Route to cash-flow investors
│       └── NO --> Pass / renegotiate
└── NO --> Does it cash flow 200+/month?
    ├── YES --> Route to cash-flow / angel investors
    └── NO --> Pass
```

---

## 5. Carina Deal Analysis Prompt

When Carina analyses a deal, it should consider:
- Who is the target buyer? (flipper, cash-flow, JV, angel)
- What is their primary goal? (equity, income, leverage, safety)
- Does the deal meet their minimum thresholds?
- What is the confidence level based on data quality?
- What are the key risks specific to this buyer type?

---

## 6. Propreneur Implementation

- Deal Engine calculators (BTL, BRR, HMO) already exist in v2
- Add buyer persona selector to deal analysis output
- Return multiple perspectives: "For a flipper: X. For a cash-flow investor: Y."
- Investor matching: auto-match deals with investor criteria in the CRM
