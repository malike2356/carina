# Three-Bucket Lead Pipeline Model

**Status:** Reference knowledge
**Source:** PropSource masterclass (4 May 2026)
**Related:** Pipeline (`06-pipeline.md`, `13-pipeline-kanban.md`), CRM (`05-crm.md`)

---

## 1. The Model

Every property business needs three parallel lead pipelines feeding into one deal flow:

```
SELLERS ──┐
          ├──> DEAL FLOW ──> INVESTORS
LANDLORDS ┘
               ^
          INVESTORS ──┘
```

---

## 2. Bucket 1: Seller Pipeline

### Sources
- Facebook ads ("We buy any house" campaigns)
- Direct to homeowner mail/email
- Referrals from existing contacts
- Networking events
- Estate agent relationships

### Pipeline Stages
```
New Lead -> Contacted -> Qualified -> Offer Made -> Negotiating -> Under Offer -> Completed
```

### Key Metrics
- Cost per lead: ~15 (Facebook)
- Cost per campaign: 20-25/day minimum
- Motivated seller rate: 44 sellers in 12 days (industry benchmark)
- Average time to first deal: 4-10 weeks
- Deal-to-lead ratio: ~11% (5 deals from 44 leads)

### Propreneur Implementation
- Extend existing Pipeline module with a "Sourcing (Sellers)" pipeline preset
- Different columns than general deal pipeline
- Track sourcing fee separately (3-7k/deal)

---

## 3. Bucket 2: Landlord Pipeline

### Sources
- Facebook ads targeting landlords
- Direct mail to portfolio landlords
- Referrals from letting agents
- Social media content

### Pipeline Stages
```
New Lead -> Contacted -> Property Audit -> Solution Proposed -> Negotiating -> Signed
```

### Key Metrics
- Usually longer sales cycle than sellers
- Higher average deal value (portfolio sales)
- More complex qualification (multiple properties, existing debt, tenant issues)

### Propreneur Implementation
- Landlord-specific contact tags in CRM
- Property portfolio view in Pipeline
- Document templates for lease options, rent-to-rent agreements

---

## 4. Bucket 3: Investor Pipeline

### Sources
- Facebook ads targeting investors
- LinkedIn networking
- Property networking events (IPN)
- Referrals from existing investors
- Content marketing (case studies, deal examples)

### Pipeline Stages
```
New Lead -> Qualified -> Deals Shared -> Offer Made -> Deal Accepted -> Completed -> Ongoing Relationship
```

### Key Metrics
- Average investor budget: 50-300k (industry benchmark)
- Target ROI: 10-22% (beats bank rate of 3.75%)
- Investor types: cash-rich time-poor, JV partners, angel investors

### Investor Sub-types (in CRM)

| Type | Label | Characteristics | Best Deals For |
|------|-------|-----------------|----------------|
| Armchair | cash_rich_time_poor | High income, wants passive | Cash-flow BTL, SA, HMO |
| JV Partner | jv_partner | Brings skill, needs operator | BRR, flipping, development |
| Angel | angel_investor | Capital, wants better than bank | Secured lending, stable cash flow |

### Propreneur Implementation
- Investor contact type already exists in CRM
- Investor portal already built (v1 has it; v2 planned)
- Add investor criteria matching vs deal criteria
- Auto-notify investors when matching deal enters the pipeline

---

## 5. Pipeline Health Dashboard

### Balanced Pipeline Targets
- At least 10 active leads in each bucket
- 3-5 qualified leads in each bucket
- 1-2 active negotiations in each bucket
- Minimum 1 deal closing per month per bucket

### Warning Signs
- All leads in one bucket (single point of failure)
- No new leads entering top of funnel
- Stalled negotiations (aging without movement)
- High disqualification rate (check messaging/targeting)

---

## 6. Cross-Bucket Automation

### Deal Matching
When a deal enters "Under Offer" in Seller Pipeline:
1. Check Investor Pipeline for matching criteria
2. Auto-notify matching investors
3. Create deal teaser for investor review
4. Track offer and acceptance

### Re-circulation
When a deal falls through:
1. Identify why (price, terms, location)
2. Re-circulate to different investor segment
3. If exhausted, move to open market

---

## 7. Feature Flag

`three_bucket_pipeline` -- gates pipeline presets for sourcing businesses
