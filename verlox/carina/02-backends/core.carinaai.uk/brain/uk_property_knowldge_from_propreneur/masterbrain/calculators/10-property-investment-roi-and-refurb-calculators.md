# Property investment: ROI models and refurbishment unit costs

**Updated:** 2026-05-03  
**Kind:** External practice guide (Carina RAG).  
**Source notes:** Internal spreadsheet methodology (BTL, BRR, HMO, R2R/SA). Numbers are **training examples**; always rebuild with live quotes, finance costs, tax, and insurance.  
**Related (product):** `39-deal-calculator-v1-v2-parity-and-refurb-plan.md`, `04-deals.md` for shipped calculator behaviour inside Propreneur.

## 1. Single-let ROI (spreadsheet pattern)

| Input | Notes |
| --- | --- |
| Purchase price | User input |
| Deposit (example 25%) | Purchase price × 0.25 |
| Mortgage | Purchase minus deposit |
| Achievable rent | Monthly market rent |
| Tax and legals (example 4%) | Purchase price × 0.04 |
| Renovation | User input |
| Finder fee | User input (example £2,500) |

**Monthly costs (typical lines):**

- Mortgage: (loan × interest rate) / 12 (example gross of 5% to 6% in training; use net payment if repayment).
- Management (example 10%): rent × 0.10.
- Maintenance and voids (example 5% to 10%): rent × band.
- Utilities, Wi-Fi, council tax: **zero** if tenant pays all.

**Outputs:**

- Monthly cashflow = rent minus sum of monthly costs.
- Annual cashflow = monthly × 12.
- ROI % = annual cashflow / total cash invested (define whether gross or net of tax).

## 2. BRR to HMO (spreadsheet pattern)

**Left column style inputs:** purchase, refurb, furnish and dress, legals (example 5% of relevant base), adjustments, target post-works value.

**Right column style outputs:** new value, mortgage at example **75%** of new value, legals (example £1,250), broker (example £500), private or personal capital plug.

**Monthly HMO costs (examples from training):**

- Mortgage at example **5%** on loan: (new value × 0.75 × rate) / 12.
- Management **10% to 12%** of gross income.
- Maintenance and voids **10%** of gross income.
- Utilities band **£350 to £400** (illustrative).
- Wi-Fi **£35 to £50**.
- Council tax: annual band / 12 (example Band B **£1,405/year** ≈ **£117/month**).

**Income:** room rate × room count × occupancy assumption.

**Equity profit (illustrative narrative):** post-refurb value minus (purchase + refurb + fees). Training row cites **5 Caister Road, Bedford**: purchase **£210,000** + refurb **£68,000** ≈ **£280,025** in; value **£400,000**; quick equity headline after rough fees **~£119,000** (verify against actual stack in full underwriting).

## 3. BRR to single let (spreadsheet pattern)

Example inputs: purchase **£75,000**, refurb **£19,635**, new value **£125,000**, legals **£750**, broker **£650** (all illustrative).

Monthly BTL lines similar to section 1 using loan on **75%** of new value at example **5%**.

## 4. Multi-let HMO purchase (cashflow style)

Example purchase band **£143,800 to £149,950**; rent **£1,760 to £1,800**; legals at **4%**; finder **£3,000** (illustrative).

Monthly lines may include: mortgage at **5%** on **75%** LTV, management **12%**, maintenance and voids **10%**, utilities **£256**, Wi-Fi **£50**, council tax **£107** (Band B style).

## 5. Rent-to-rent / serviced accommodation (spreadsheet pattern)

| Input | Notes |
| --- | --- |
| Rent to landlord | Core fixed cost |
| Deposit (example five weeks) | Often **£900 to £3,000** band in examples |
| ADR weekday / weekend | Dynamic pricing models vary |

**Underwriting rule from training:** stress to **break-even at about 50% occupancy** before taking operator risk; then scale scenarios at 0.5, 0.6, 0.7, 0.8, 0.9 occupancy.

**Monthly cost lines often include:** management **15%** of revenue, maintenance and voids **10%**, utilities **£200 to £400**, Wi-Fi **£35 to £50**, council tax **£110 to £180**, TV licence **£15**, linen and cleans **£100 to £500**, OTA commissions about **15%** (channel dependent).

## 6. Refurbishment unit cost database (training table)

| Item | Unit | BTL | HMO |
| --- | --- | --- | --- |
| Gutters full replacement | job | £550 | £550 |
| Windows PVC inc vents | each | £450 | £450 |
| Doors reinforced PVC or composite | each | £750 | £750 |
| Electrics consumer unit / partial | job | £1,000 | £1,000 |
| Electrics full rewire | job | £3,000 to £3,500 | £3,000 to £3,500 |
| Boiler fitted with warranty | each | £1,500 | £1,500 |
| Radiator | each | £250 | £250 |
| Plasterboard and skim room | room | £400 | £400 |
| Skim only room | room | £300 to £400 | £300 to £400 |
| Kitchen fitted pack | room | £4,500 | £4,500 |
| Bathroom retile and suite | room | £2,500 | £2,500 |
| Ensuite full | room | £1,750 | £3,000 |
| Flooring carpet | room | £180 to £200 | £180 to £200 |
| Flooring laminate | room | £250 | £250 |
| Stud partition wall | wall | £800 | £500 to £800 |
| Decoration rental standard | room | £300 | £300 |
| Rip-out labour | day | £100 | £100 |
| Skip | each | £250 | £200 to £250 |
| Damp proofing full tanking | job | £5,000 | £5,000 |
| Garden tidy | day | £100 | £100 |
| Internal door standard | door | £150 | £150 |
| Internal door fire rated | door | £275 to £350 | £275 to £350 |
| Fire alarm wired interlinked | job | n/a | £2,000 to £3,000 |
| Smoke alarm wired system | job | n/a | £1,000 |
| Loft conversion | room | £25,000 | £25,000 |
| Extension | storey | £25,000 | £25,000 |
| Garage to room | garage | £10,000 | £10,000 |

**Contingency bands (training):** miscellaneous **5%**; contingency **10% / 20% / 30%** best / mid / worst style layers.

**Grand total:** sum of line items + misc% + contingency% on the basis your spreadsheet uses (some apply contingency on subtotal ex fees; align to one rule).
