# Property ROI Calculator Formulas - BTL, HMO, BRR, R2R

## Core Formulas

### Gross Yield
```
Gross Yield (%) = (Annual Rent / Purchase Price) × 100
```

### Net Yield
```
Net Yield (%) = ((Annual Rent - Annual Costs) / Purchase Price) × 100
```

### Return on Investment (ROI)
```
ROI (%) = Annual Cashflow / Total Money In × 100
```
Where **Total Money In** = Deposit + Tax & Legals + Renovation + Finders Fee

### Monthly Cashflow
```
Monthly Cashflow = Monthly Rent - Total Monthly Costs
```

### Annual Cashflow
```
Annual Cashflow = Monthly Cashflow × 12
```

---

## Strategy: Single Let (BTL)

### Inputs
| Input | Typical Value |
|---|---|
| Purchase Price | £69,995 - £325,000 |
| Deposit (LTV 75%) | 25% of purchase price |
| Mortgage Balance | 75% of purchase price |
| Achievable Rent | Market rent per month |
| Legals (incl. SDLT) | 4% of purchase price |
| Renovation | Varies (£0 - £5,000+) |
| Finders Fee | £0 - £3,500 |

### Monthly Cost Components
| Cost | Rate | Basis |
|---|---|---|
| Mortgage Payments | 5-6% p.a. on mortgage balance / 12 | Interest-only assumption |
| Management Fee | 10% of monthly rent | When using letting agent |
| Maintenance & Voids | 5-10% of monthly rent | |
| Utilities | £0 (tenant-paid for AST) | |
| Insurance | ~£23-£50 | |
| Council Tax | £0 (tenant-paid for AST) | |

### Example Worked Calculation (Budget Single Let)
```
Purchase Price:       £69,995
Deposit (25%):        £17,499
Mortgage (75%):       £52,496
Achievable Rent:      £725/month

Total Money In:
  Deposit:            £17,499
  Tax & Legals (4%):  £2,800
  Renovation:         £2,000
  Total:              £22,299

Monthly Costs:
  Mortgage (5%):      £219
  Management (10%):   £73
  Maintenance (5%):   £36
  Total:              £328

Monthly Cashflow:     £725 - £328 = £397
Annual Cashflow:      £397 × 12 = £4,770
ROI:                  £4,770 / £22,299 = 21.4%
```

### Example Worked Calculation (Higher-Value Single Let)
```
Purchase Price:       £325,000
Deposit (25%):        £81,250
Mortgage (75%):       £243,750
Achievable Rent:      £1,725/month

Total Money In:
  Deposit:            £81,250
  Tax & Legals (4%):  £13,000
  Finders Fee:        £3,000
  Total:              £97,250

Monthly Costs:
  Mortgage (3%):      £609
  Management (10%):   £173
  Maintenance (5%):   £86
  Total:              £868

Monthly Cashflow:     £1,725 - £868 = £857
Annual Cashflow:      £857 × 12 = £10,282
ROI:                  £10,282 / £97,250 = 10.6%
```

---

## Strategy: Multi Let / HMO

### Additional Cost Components vs Single Let
| Cost | Rate |
|---|---|
| Management Fee | 12% of monthly rent (higher than BTL) |
| Maintenance & Voids | 10% of monthly rent |
| Utilities (gas, elec, water) | ~£256/month (landlord-paid) |
| WiFi | ~£35-£50/month |
| Council Tax | ~£107-£124/month (landlord-paid) |

### Example Worked Calculation (5-Bed HMO, Manchester)
```
Purchase Price:       £232,000
Deposit (25%):        £58,000
Mortgage (75%):       £174,000
Achievable Rent:      £3,300/month (5 rooms × £660)

Total Money In:
  Deposit:            £58,000
  Tax & Legals (4%):  £9,280
  Renovation:         £37,650
  Furnishings:        £4,000
  Finders Fee:        £3,000
  Total:              £111,930

Monthly Costs:
  Mortgage (5%):      £725
  Management (12%):   £396
  Maintenance (10%):  £330
  Utilities:          £350
  WiFi:               £35
  Council Tax:        £117
  Total:              £1,953

Monthly Cashflow:     £3,300 - £1,953 = £1,347
Annual Cashflow:      £1,347 × 12 = £16,163
ROI:                  £16,163 / £111,930 = 14.4%
```

### HMO Yield Rule of Thumb
- Target areas where HMO annual income = 7-10% of purchase price or above
- HMO 3-bed annual income (3 rooms × room rate × 12): target > 7% of PP
- HMO 5-bed provides significantly better cashflow per £ invested than BTL

---

## Strategy: Buy-Refurbish-Refinance (BRR)

### BRR Logic
Buy below market value → refurbish to add value → refinance at new value → recycle capital

### BRR Profit Calculation
```
Equity Created = New Value - (Purchase Price + Renovation + Tax & Legals)
```

### BRR Capital Recycled
```
Remortgage Amount = New Value × 75% (LTV)
Capital Returned = Remortgage Amount - Original Mortgage Balance
Money Left In = Original Total In - Capital Returned
```

### Example: BRR to HMO (42 Hulton St, Failsworth M35 0AZ)
```
Purchase Price:       £232,000
Renovation:           £37,650 (inc. contingency)
Furnish & Dressing:   £4,000
HMO Licence:          £985
Tax & Legals (5%):    £11,600
Total Spent:          £286,235

New Value (Post-Refurb): £288,000
Equity Profit:           £288,000 - £286,235 = -£1,235 (marginal loss on refurb)

New Mortgage (75%):   £216,000
New Deposit Required: £72,000
Money In After Refi:  £73,235 (deposit + fees)

HMO Income (5 rooms × £670): £3,350/month

Monthly Costs:
  Mortgage (5%):      £900
  Management (12%):   £402
  Maintenance (10%):  £335
  Utilities (5 rooms): £350
  WiFi:               £35
  Council Tax (Band B): £117
  Total:              £2,139

Monthly Cashflow:     £3,350 - £2,139 = £1,211
Annual Cashflow:      £14,531
ROI on £73,235:       19.8%
```

### Example: BRR to Single Let (Hulton St alternative)
```
Purchase Price:       £180,000
Renovation:           £20,000
Tax & Legals (5%):    £9,000
Total Spent:          £209,000

New Value:            £260,000
Equity Profit:        £51,000

Remortgage (75%):     £195,000
Deposit (25%):        £65,000
Money Left In Deal:   £9,000

Single Let Rent:      £850/month
Monthly Costs:        £578 (mortgage 6%, mgmt 10%, maintenance 5%)
Monthly Cashflow:     £272.50
Annual Cashflow:      £3,270
ROI on £9,000 in:     36.3%
```

---

## Strategy: Rent-to-Rent (R2R)

### R2R Logic - HMO Model
Agree fixed rent with landlord → sublet rooms at market rates → profit = margin

### R2R Financial Model
```
Total Startup Cost = Landlord Deposit + Furnishings + Renovation + Licence Fee + Finders Fee

Monthly Income = Achievable Rent (e.g. 5 rooms × room rate × occupancy)
Monthly Costs = Rent to Landlord + Management Fee + Maintenance + Utilities + WiFi + Council Tax + TV Licence + Insurance

Monthly Cashflow = Monthly Income - Monthly Costs
Annual ROI = Annual Cashflow / Startup Cost × 100
```

### Example: R2R HMO (42 Hulton St)
```
Rent to Landlord:    £1,295/month
Deposit:             £1,350
Achievable Rent:     £3,640/month (5 rooms)

Startup Cost:        £3,000 (deposit + misc)

Monthly Costs:
  Rent to Landlord:  £1,295
  Management (10%):  £364
  Maintenance (10%): £364
  Gas/Elec/Water:    £150
  WiFi:              £35
  Council Tax:       £110
  TV Licence:        £15
  Insurance:         £12
  Total:             £2,345

Monthly Cashflow:    £3,640 - £2,345 = £1,295
Annual Cashflow:     £15,540
ROI on £3,000 in:    518% (extremely capital-efficient)
```

### R2R Occupancy Sensitivity Table
| Occupancy | Monthly Income (5 rooms × £728) |
|---|---|
| 50% | £1,820 |
| 65% | £2,366 |
| 70% | £2,548 |
| Full | £3,640 |

**Rule**: Never take on a property that does not break even at 50% occupancy.

---

## Key Investment Benchmarks

| Metric | Minimum Target | Strong Performance |
|---|---|---|
| ROI (BTL) | 10% | 15%+ |
| ROI (HMO) | 12% | 18%+ |
| ROI (BRR) | 15% | 25%+ |
| ROI (R2R) | 100%+ | 300%+ |
| Gross Yield | 6% | 8%+ |
| Monthly Cashflow (BTL) | £200 | £400+ |
| Monthly Cashflow (HMO) | £500 | £1,000+ |
| HMO Room Rate (Northern cities) | £400-£500 | £600-£750+ |
| HMO Room Rate (Southern cities) | £450-£600 | £700-£800+ |

---

## Mortgage Rate Reference Points Used in Calculations

| Scenario | Rate Used |
|---|---|
| Conservative (current market) | 5-6% |
| Historic low assumption | 3-4% |
| Standard calculation default | 5% |

Note: All examples use interest-only mortgage calculations. Capital repayment mortgages will reduce cashflow but build equity faster.

---

## Stamp Duty (SDLT) Reference

As an investor purchasing additional properties, SDLT surcharge applies (3% above standard rates). For quick calculation, use 4-5% of purchase price to cover SDLT + legal fees combined.
