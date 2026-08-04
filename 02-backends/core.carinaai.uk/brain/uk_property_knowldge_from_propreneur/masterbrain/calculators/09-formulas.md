# Property Investment Calculations and Formulas
## Complete Reference - England and Wales (UK)
**Authority:** HMRC, RICS, ARLA, NAEA, Bank of England conventions.
**SDLT rates:** England and NI, post-April 2025.
**Last reviewed:** May 2025.

---

## Table of Contents

1. [Yield Calculations](#1-yield-calculations)
2. [Return and Profit Metrics](#2-return-and-profit-metrics)
3. [Cashflow Analysis](#3-cashflow-analysis)
4. [Mortgage and Finance Calculations](#4-mortgage-and-finance-calculations)
5. [SDLT - Stamp Duty Land Tax](#5-sdlt--stamp-duty-land-tax)
6. [Buy-to-Let (BTL)](#6-buy-to-let-btl)
7. [HMO - House in Multiple Occupation](#7-hmo--house-in-multiple-occupation)
8. [Rent-to-Rent (R2R)](#8-rent-to-rent-r2r)
9. [Serviced Accommodation (SA)](#9-serviced-accommodation-sa)
10. [Buy-Refurbish-Refinance (BRR)](#10-buy-refurbish-refinance-brr)
11. [Flip / Property Trading](#11-flip--property-trading)
12. [Below Market Value (BMV) / No Money Down](#12-below-market-value-bmv--no-money-down)
13. [Development](#13-development)
14. [Commercial Property](#14-commercial-property)
15. [Valuation Methods](#15-valuation-methods)
16. [Time Value of Money](#16-time-value-of-money)
17. [Debt and Leverage Ratios](#17-debt-and-leverage-ratios)
18. [Portfolio Metrics](#18-portfolio-metrics)
19. [Operational and Cost Metrics](#19-operational-and-cost-metrics)
20. [UK Tax Considerations](#20-uk-tax-considerations)

---

## 1. Yield Calculations

Yield measures annual rental income as a percentage of capital value. UK convention: always expressed as percentage (%), never decimal.

### 1.1 Gross Yield

The simplest yield measure. Ignores all costs.

```
Gross Yield (%) = (Annual Gross Rent / Property Value) × 100
```

Where:
- **Annual Gross Rent** = Monthly Rent × 12
- **Property Value** = Purchase price or current market value

Example: £900/mo rent on £150,000 property  
`(900 × 12 / 150,000) × 100 = 7.2%`

---

### 1.2 Net Yield

Deducts operating costs (management, insurance, voids, maintenance) but NOT mortgage finance. This is the standard UK property yield used for comparison.

```
Net Yield (%) = ((Annual Gross Rent - Annual Operating Costs) / Property Value) × 100
```

Annual Operating Costs include:
- Management fees
- Letting/renewal fees
- Buildings insurance
- Ground rent / service charges
- Void allowance
- Maintenance and repairs reserve
- Accountancy fees (if recurring)

Does NOT include: mortgage interest, SDLT, legal/purchase costs.

---

### 1.3 Net Initial Yield (Commercial / RICS)

```
Net Initial Yield (NIY) (%) = ((Passing Rent - Operating Costs) / Capital Value) × 100
```

Used in UK commercial property valuation. Based on current passing rent, not ERV. Finance excluded.

---

### 1.4 Reversionary Yield

What yield the property will produce when leases roll over to full market rent (ERV).

```
Reversionary Yield (%) = ((Estimated Rental Value - Operating Costs) / Purchase Price) × 100
```

---

### 1.5 Equivalent Yield

A blended yield between current NIY and reversionary yield, used in commercial property DCF. Calculated as the constant discount rate that equates the present value of all expected income (at current rent until rent review/expiry, then ERV thereafter) to the purchase price. Solved by Newton-Raphson or Excel's IRR function.

---

### 1.6 Running Yield

```
Running Yield (%) = (Current Annual Rent Received / Current Market Value) × 100
```

Used on a live portfolio to track income performance against today's values.

---

### 1.7 True Yield (Net of Purchaser's Costs)

```
True Yield (%) = (Net Annual Rent / (Capital Value × (1 + Purchaser's Costs %))) × 100
```

Purchaser's costs include SDLT, agent fees, legal, survey. Rarely published but the real net return at acquisition.

---

### 1.8 NOI Yield (SA / Commercial)

```
NOI Yield (%) = (Net Operating Income / Property Value) × 100
```

Where NOI = Gross Revenue - All Operating Expenses (excluding mortgage, depreciation, tax).

---

## 2. Return and Profit Metrics

### 2.1 Return on Investment (ROI)

```
ROI (%) = (Annual Net Cashflow / Total Cash Invested) × 100
```

Total Cash Invested = Deposit + SDLT + Legal + Survey + Refurb + Any other upfront costs (not the mortgage loan).

---

### 2.2 Cash-on-Cash Return (CoC)

Identical formula to ROI when using pre-tax cash flow over cash deployed. Sometimes distinguished as specifically pre-tax:

```
CoC (%) = (Annual Pre-Tax Cash Flow / Total Cash Deployed) × 100
```

---

### 2.3 Return on Equity (ROE)

Measures return against the current equity (not original deposit):

```
ROE (%) = (Annual Net Income / Current Equity in Property) × 100
```

Current Equity = Current Market Value - Outstanding Mortgage Balance

Useful when deciding whether to refinance or retain.

---

### 2.4 Total Return

```
Total Return (%) = ((Net Income + Capital Appreciation) / Total Cash Invested) × 100
```

Capital Appreciation = Current Value - Purchase Price

---

### 2.5 Annualised Return

When holding period is not exactly 12 months:

```
Annualised Return (%) = ((1 + Total Return)^(1 / Years Held) - 1) × 100
```

---

### 2.6 Equity Multiple (EM)

```
Equity Multiple = Total Cash Received / Total Cash Invested
```

An EM of 2.0× means you doubled your money. No time consideration (use IRR for time-adjusted version).

---

### 2.7 Net Profit (Flip / Development)

```
Net Profit = Sale Price - Total Acquisition and Development Costs - Selling Costs
```

---

### 2.8 Profit on Cost (Development)

```
Profit on Cost (%) = (Net Profit / Total Development Cost) × 100
```

Viability threshold (UK development finance): typically 15-20% minimum.

---

### 2.9 Profit on GDV / Development Margin

```
Development Margin (%) = (Net Profit / GDV) × 100
```

20% minimum considered viable. 25%+ is target. Used by most development finance lenders in UK.

---

## 3. Cashflow Analysis

### 3.1 Effective Gross Income (EGI)

```
EGI = Potential Gross Income (PGI) - Vacancy and Credit Loss
```

```
PGI = Monthly Rent × 12  (100% occupancy)
Vacancy Loss = PGI × Void Rate
EGI = PGI × (1 - Void Rate)
```

---

### 3.2 Net Operating Income (NOI)

```
NOI = EGI - Operating Expenses
```

Operating Expenses = Management + Insurance + Maintenance + Letting Fees + Ground Rent + Service Charges + Other (excludes mortgage, SDLT, depreciation, income tax).

---

### 3.3 Before-Tax Cash Flow (BTCF)

```
BTCF = NOI - Annual Mortgage Debt Service
```

Annual Debt Service = Monthly Mortgage Payment × 12

---

### 3.4 Monthly Cashflow

```
Monthly Cashflow = Monthly Rent - Monthly Mortgage - Monthly Operating Costs
```

Monthly Operating Costs = (Annual management + insurance + maintenance + void allowance) / 12

---

### 3.5 Void Allowance (Annual)

```
Void Allowance = Monthly Rent × Void Months per Year
```

Typical UK void rates: single-let 1 month/yr (8.3%), HMO 0.5 month/yr per room, SA use occupancy rate.

---

## 4. Mortgage and Finance Calculations

### 4.1 Repayment (Capital and Interest) Mortgage - Monthly Payment

Standard amortisation formula:

```
M = P × (r × (1 + r)^n) / ((1 + r)^n - 1)
```

Where:
- **M** = Monthly payment
- **P** = Principal loan amount
- **r** = Monthly interest rate = Annual rate / 12
- **n** = Total number of months = Years × 12

Example: £150,000 at 5.5% over 25 years  
r = 0.055/12 = 0.004583  
n = 300  
M = 150,000 × (0.004583 × 1.004583^300) / (1.004583^300 - 1) = £918.13/month

---

### 4.2 Interest-Only Mortgage - Monthly Payment

```
M = P × (Annual Rate / 12)
```

Example: £150,000 at 5.5% IO  
M = 150,000 × (0.055 / 12) = £687.50/month

---

### 4.3 Total Interest Paid (Repayment Mortgage)

```
Total Interest = (Monthly Payment × n) - Principal
```

---

### 4.4 Total Cost Over Term (Interest-Only)

```
Total Cost = (Monthly IO Payment × n) + Principal
```

(The principal is returned as a balloon payment at the end.)

---

### 4.5 Outstanding Loan Balance at Month k (Repayment)

```
Balance(k) = P × ((1 + r)^n - (1 + r)^k) / ((1 + r)^n - 1)
```

---

### 4.6 Bridging Loan - Simple Interest (industry standard quote)

```
Interest = Loan × Annual Rate × (Term Months / 12)
```

```
Total Monthly Rate Quote: Interest = Loan × Monthly Rate × Term Months
```

Note: Most bridging lenders quote a monthly rate (e.g., 0.65%-1.2%/month). The annual rate in this formula = monthly rate × 12.

Rolled interest (compound, for longer terms):

```
Total Repayable = Loan × (1 + Monthly Rate)^Term Months
Interest = Total Repayable - Loan
```

---

### 4.7 Loan to Value (LTV)

```
LTV (%) = (Loan Amount / Property Value) × 100
```

Equity = Property Value - Loan Amount  
Available equity to release (at target LTV): `Equity Release = (Property Value × Target LTV) - Outstanding Balance`

---

### 4.8 Loan to Cost (LTC)

```
LTC (%) = (Loan Amount / Total Project Cost) × 100
```

Development finance maximum: typically 70-80% LTC.

---

### 4.9 Mortgage Stress Test (BTL)

UK BTL lender test (PRA rules):

```
Stress Test: Rent ≥ Mortgage Payment × Stress Ratio
```

Typical stress ratio: 125% (basic rate taxpayer) or 145% (higher rate taxpayer).  
Stress rate: calculated at notional rate typically 5.5% (lender-specific).

```
ICR (Interest Cover Ratio) = Annual Rent / Annual Interest Charge
Minimum ICR: 1.25 (basic rate) / 1.45 (higher rate)
```

---

### 4.10 Debt Service Coverage Ratio (DSCR)

```
DSCR = NOI / Annual Debt Service
```

Minimum acceptable (UK commercial lenders): 1.25×  
Strong: 1.5×+

---

### 4.11 Annual Percentage Rate (APR)

```
APR = ((1 + Monthly Rate)^12 - 1) × 100
```

Used to compare bridging loan quotes on a like-for-like basis.

---

### 4.12 Development Finance Interest (60% Drawdown Rule)

Development loans draw down progressively. Standard assumption for interest calculation:

```
Average Loan Balance = Total Facility × 60%
Interest Cost = Average Loan Balance × Annual Rate × (Term Months / 12)
```

---

## 5. SDLT - Stamp Duty Land Tax

All rates effective for completions in England and Northern Ireland. Scotland uses LBTT; Wales uses LTT.

### 5.1 Standard Residential (Main Home, no relief) - Post April 2025

| Band | Rate |
|------|------|
| £0 - £125,000 | 0% |
| £125,001 - £250,000 | 2% |
| £250,001 - £925,000 | 5% |
| £925,001 - £1,500,000 | 10% |
| Above £1,500,000 | 12% |

SDLT is calculated progressively (like income tax):

```
SDLT = 0% × min(price, 125,000)
     + 2% × min(max(price - 125,000, 0), 125,000)
     + 5% × min(max(price - 250,000, 0), 675,000)
     + 10% × min(max(price - 925,000, 0), 575,000)
     + 12% × max(price - 1,500,000, 0)
```

Example: £300,000 standard  
= 0 + 2% × 125,000 + 5% × 50,000 = 2,500 + 2,500 = **£5,000**

---

### 5.2 Additional Dwelling Surcharge (Second Homes / BTL) - Post October 2024 + Post April 2025

5% surcharge added to each standard band:

| Band | Rate |
|------|------|
| £0 - £125,000 | 5% |
| £125,001 - £250,000 | 7% |
| £250,001 - £925,000 | 10% |
| £925,001 - £1,500,000 | 15% |
| Above £1,500,000 | 17% |

```
SDLT = 5% × min(price, 125,000)
     + 7% × min(max(price - 125,000, 0), 125,000)
     + 10% × min(max(price - 250,000, 0), 675,000)
     + 15% × min(max(price - 925,000, 0), 575,000)
     + 17% × max(price - 1,500,000, 0)
```

Example: £200,000 BTL  
= 5% × 125,000 + 7% × 75,000 = 6,250 + 5,250 = **£11,500**

Example: £500,000 BTL  
= 5% × 125,000 + 7% × 125,000 + 10% × 250,000 = 6,250 + 8,750 + 25,000 = **£40,000**

---

### 5.3 First-Time Buyer Relief - Post April 2025

| Band | Rate |
|------|------|
| £0 - £300,000 | 0% |
| £300,001 - £500,000 | 5% |
| Above £500,000 | Standard rates (no FTB relief) |

```
If price > £500,000: use standard residential rates
If price ≤ £300,000: SDLT = £0
If £300,001 ≤ price ≤ £500,000: SDLT = (price - 300,000) × 5%
```

Example: £400,000 FTB: (400,000 - 300,000) × 5% = **£5,000**

---

### 5.4 Non-Residential / Commercial SDLT (England and NI)

| Band | Rate |
|------|------|
| £0 - £150,000 | 0% |
| £150,001 - £250,000 | 2% |
| Above £250,000 | 5% |

```
SDLT = 0% × min(price, 150,000)
     + 2% × min(max(price - 150,000, 0), 100,000)
     + 5% × max(price - 250,000, 0)
```

Example: £400,000 commercial: 0 + 2% × 100,000 + 5% × 150,000 = 2,000 + 7,500 = **£9,500**

---

### 5.5 LBTT - Scotland (Standard Residential, Current Rates)

| Band | Rate |
|------|------|
| £0 - £145,000 | 0% |
| £145,001 - £250,000 | 2% |
| £250,001 - £325,000 | 5% |
| £325,001 - £750,000 | 10% |
| Above £750,000 | 12% |

Additional Dwelling Supplement (ADS): 6% charged on full consideration (not just excess) for additional residential properties over £40,000.

---

### 5.6 LTT - Wales (Standard Residential, Current Rates)

| Band | Rate |
|------|------|
| £0 - £225,000 | 0% |
| £225,001 - £400,000 | 6% |
| £400,001 - £750,000 | 7.5% |
| £750,001 - £1,500,000 | 10% |
| Above £1,500,000 | 12% |

Higher Residential Rates (second homes/BTL in Wales): add 4% surcharge to each band.

---

### 5.7 Effective SDLT Rate

```
Effective Rate (%) = (SDLT Payable / Purchase Price) × 100
```

---

## 6. Buy-to-Let (BTL)

### 6.1 Gross Yield

```
Gross Yield (%) = (Monthly Rent × 12 / Purchase Price) × 100
```

---

### 6.2 Net Yield (excl. mortgage - RICS convention)

```
Annual Operating Costs = Management + Insurance + Maintenance + Void Allowance + Letting Fees + Other

Net Yield (%) = ((Annual Rent - Annual Operating Costs) / Purchase Price) × 100
```

Typical operating cost estimates (UK single-let):
- Management: 10% of gross rent (let-only typically 8-12%)
- Void: 1 month per year (~8.3% of annual rent)
- Maintenance: 1% of property value per year
- Insurance: £200-£500/year
- Letting/renewal fees: 0.5-1 month rent annually

---

### 6.3 Monthly Cashflow

```
Monthly Cashflow = Rent - Mortgage - Management - Maintenance - Insurance - Council Tax - Utilities - Void Allowance
```

Where Void Allowance (monthly equivalent) = (Rent × Void Months per Year) / 12

---

### 6.4 Annual Void Allowance

```
Annual Void Allowance = Monthly Rent × Void Months
```

---

### 6.5 Management Fee

```
Annual Management Fee = Annual Effective Rent × Management %
```

UK market rates: 8% (let-only, landlord manages), 10-12% (full management), 15% (premium London agents).

---

### 6.6 Maintenance Reserve

```
Annual Maintenance = Property Value × Maintenance % (typically 0.5-1.5% per year)
```

---

### 6.7 ROI

```
Total Cash Invested = Deposit + SDLT + Legal Fees + Survey Fees + Refurb Budget
ROI (%) = (Annual Net Cashflow / Total Cash Invested) × 100
```

---

### 6.8 Mortgage Rental Coverage

```
Rental Coverage Ratio = Monthly Rent / Monthly Mortgage Payment
```

Minimum 125% (basic rate) or 145% (higher rate) per PRA affordability rules.

---

### 6.9 Rental Yield vs. Mortgage Rate Spread

```
Yield Spread = Gross Yield - Mortgage Rate
```

Positive spread = positive leverage; the property earns more than it costs to finance.

---

## 7. HMO - House in Multiple Occupation

### 7.1 Gross Potential Rent

```
Gross Potential Rent (Annual) = Rent per Room × Number of Rooms × 12
```

---

### 7.2 Effective Gross Rent (after void)

```
Void Allowance = Rent per Room × Void Months per Year × Rooms
Effective Gross Rent = Gross Potential Rent - Void Allowance
```

HMO void is typically calculated per room, not per property.

---

### 7.3 NOI (HMO)

```
Operating Costs = HMO Licence + Council Tax + Utilities + Insurance + Management + Maintenance
NOI = Effective Gross Rent - Operating Costs
```

HMO management: typically 10-15% of gross potential rent.  
HMO licence: £500-£1,500/year depending on council area.

---

### 7.4 Net Yield (HMO)

```
Net Yield (%) = (NOI / Purchase Price) × 100
```

---

### 7.5 Cash-on-Cash (HMO)

```
CoC (%) = ((NOI - Annual Mortgage) / Total Cash Invested) × 100
```

---

### 7.6 Profit per Door (per Room)

```
Annual Profit per Door = Annual Net Profit / Number of Rooms
```

---

### 7.7 Premium over BTL (same property)

```
HMO Premium = HMO Gross Yield - BTL Gross Yield (if single let at market rent)
```

---

## 8. Rent-to-Rent (R2R)

R2R: Operator takes a lease from the landlord and sublicenses to sub-tenants at a higher rate. No purchase required.

### 8.1 Monthly Spread

```
Monthly Spread = Subtenant Income (g) - Landlord Rent (l)
```

---

### 8.2 Monthly Profit

```
Monthly Profit = Spread - Management Fee - Utilities - Insurance - Council Tax - Other Fixed Costs
```

---

### 8.3 Annual Profit (void-adjusted)

During a void month the operator loses all subtenant income (g) but still pays the landlord (l) and all fixed costs.

```
Annual Profit = (Monthly Profit × 12) - (Subtenant Income g × Void Months)
```

The void deduction is `g × void months` (full income lost), NOT `spread × void months`.

---

### 8.4 Net Margin

```
Net Margin (%) = (Annual Profit / Annual Subtenant Income) × 100
Annual Subtenant Income = g × 12
```

---

### 8.5 Break-Even Occupancy (R2R)

The occupancy rate at which the operator covers all costs:

```
Break-even Occupancy (%) = (Landlord Rent + Fixed Costs) / Subtenant Income × 100
```

---

### 8.6 Profit per Door (R2R HMO)

```
Profit per Door = Annual Profit / Number of Sub-Tenants
```

---

## 9. Serviced Accommodation (SA)

### 9.1 Annual Revenue

```
Annual Revenue = Nightly Rate × Occupancy Rate × 365
```

---

### 9.2 Monthly Revenue

```
Monthly Revenue = Nightly Rate × Occupancy Rate × 30.4167
```

(30.4167 = 365/12)

---

### 9.3 Average Daily Rate (ADR)

```
ADR = Total Revenue in Period / Total Nights Sold in Period
```

---

### 9.4 RevPAR (Revenue Per Available Room-Night)

```
RevPAR = Total Revenue / Total Available Nights
       = ADR × Occupancy Rate
```

---

### 9.5 Occupancy Rate

```
Occupancy Rate (%) = (Nights Booked / Total Available Nights) × 100
```

---

### 9.6 Annual NOI (SA)

```
Operating Costs = Cleaning + Platform Commission + Management + Utilities + Channel Manager + Insurance + Maintenance

NOI = Annual Revenue - Annual Operating Costs
```

Typical SA cost structure:
- Platform commission (Airbnb/Booking.com): 3-15%
- Cleaning: £30-£80 per stay (or 10-25% of revenue)
- SA management: 15-25% of revenue
- Utilities: £200-£600/month depending on size

---

### 9.7 Gross Yield (SA)

```
Gross Yield (%) = (Annual Revenue / Purchase Price) × 100
```

---

### 9.8 NOI Yield (SA)

```
NOI Yield (%) = (Annual NOI / Purchase Price) × 100
```

---

### 9.9 Breakeven Occupancy (SA)

```
Breakeven Occupancy (%) = Annual Fixed Costs / (Nightly Rate × 365) × 100
```

---

### 9.10 Cleaning Cost per Stay

```
Cleaning Cost per Stay = (Cleaning % × Annual Revenue) / (Occupied Nights / Avg Stay Length)
```

Or directly input as a fixed cost per stay multiplied by number of stays.

---

## 10. Buy-Refurbish-Refinance (BRR)

### 10.1 Total Cost (All-In)

```
Total Cost = Purchase Price + SDLT + Legal Fees + Survey Fees + Refurb Cost + Finance Costs + Contingency
```

Standard contingency: 10-15% of refurb cost.

---

### 10.2 After-Refurb Value (ARV / GDV)

The post-refurbishment market value. Obtained from local comparables or RICS surveyor. Input value - not calculated.

---

### 10.3 Refinance Proceeds

```
Refinance Proceeds = Post-Refurb Value × Refinance LTV
```

Typical refinance LTV: 70-75% (sometimes 80% for limited companies). Lender will commission their own valuation.

---

### 10.4 Cash Left In

```
Cash Left In = max(0, Total Cost - Refinance Proceeds)
```

If Total Cost > Refinance Proceeds, you have money stuck in the deal.

---

### 10.5 Cash Out (No Money Left In)

```
Cash Out = Refinance Proceeds - Total Cost
```

Positive cash out = money returned above original investment.

---

### 10.6 Capital Recycled

```
Capital Recycled (%) = min(100, (Refinance Proceeds / Total Cost) × 100)
```

100% = no money left in. < 100% = some cash left in. > 100% (capped at 100) = cash out.

---

### 10.7 Equity Created

```
Equity Created = Post-Refurb Value - Refinance Proceeds
```

This is the equity position above the new mortgage.

---

### 10.8 BRR ROI (on cash left in)

```
BRR ROI (%) = (Annual Net Cashflow / Cash Left In) × 100
```

Not calculable when Cash Left In = 0 (infinite ROI, sometimes shown as "∞").

---

### 10.9 Gross Yield (BRR, post-refurb)

```
Gross Yield (%) = (Monthly Rent × 12 / Post-Refurb Value) × 100
```

Note: uses ARV (not purchase price) since you are refinancing against ARV.

---

### 10.10 Monthly Cashflow (BRR, interest-only refinance)

```
Monthly Mortgage (IO) = Refinance Proceeds × Annual Rate / 12
Monthly Cashflow = Monthly Rent - Monthly Mortgage - Management - Maintenance
```

---

### 10.11 Minimum Discount to BRR

To get 75% LTV refinance to cover total cost:

```
Required ARV = Total Cost / 0.75
Minimum Uplift = Required ARV - Purchase Price
```

---

## 11. Flip / Property Trading

### 11.1 Total Acquisition Cost

```
Total Cost = Purchase Price + SDLT + Legal Buy + Survey + Refurb + Finance/Holding + Marketing + Other
```

---

### 11.2 Selling Costs

```
Selling Costs = Sale Price × Agent Fee % + Legal Sell Fee
```

UK estate agent fees: typically 1-2.5% + VAT (marketed), or fixed fee.

---

### 11.3 Net Profit

```
Net Profit = Sale Price - Total Cost - Selling Costs
```

---

### 11.4 Profit Margin

```
Profit Margin (%) = (Net Profit / Sale Price) × 100
```

---

### 11.5 ROI (Flip)

```
ROI (%) = (Net Profit / Total Cost) × 100
```

---

### 11.6 Annualised Return (Flip)

```
Annualised Return (%) = ((1 + ROI/100)^(12/HoldingMonths) - 1) × 100
```

---

### 11.7 Maximum Purchase Price (back-calculation from target profit)

```
Max Purchase = Sale Price - Selling Costs - Target Profit - Refurb - Legal - Survey - Finance - SDLT
```

SDLT is itself a function of purchase price (iterate or use approximation).

---

## 12. Below Market Value (BMV) / No Money Down

### 12.1 Discount Amount

```
Discount Amount = Market Value - Purchase Price
```

---

### 12.2 Discount Percentage

```
Discount (%) = (Discount Amount / Market Value) × 100
```

---

### 12.3 Same-Day Remortgage Model (BMV/NMD)

In this model, bridging finance covers 100% of purchase price, then an immediate remortgage at market value releases funds.

```
Bridging Amount = Purchase Price (100% bridging)
Remortgage Proceeds = Market Value × Remortgage LTV
Bridging Fee = Purchase Price × Arrangement Fee %
```

---

### 12.4 Net Cash Position

```
Net Cash = Remortgage Proceeds - Purchase Price - Bridging Fee - Legal Fees - Valuation Fee - SDLT
```

Positive Net Cash = no money down (cash out).  
Negative Net Cash = cash left in required.

---

### 12.5 Breakeven Discount

The minimum discount needed to achieve net cash = £0 (no money down):

```
Breakeven Discount (%) = (Purchase Price + Bridging Fee + Legal + Valuation + SDLT - Remortgage Proceeds) / Market Value × 100
```

At 75% LTV: breakeven discount typically ~25% + costs/(MV).

---

### 12.6 Maximum Purchase Price for NMD

```
Max Purchase (NMD) = Market Value - (Breakeven Discount % / 100 × Market Value)
```

---

## 13. Development

### 13.1 Gross Development Value (GDV)

```
GDV = Number of Units × Average Unit Value
```

For mixed-use or phased developments, sum by unit type.

---

### 13.2 Construction Cost

```
Construction Cost = Build Cost per Unit (£/m² or per unit) × Number of Units
```

---

### 13.3 Contingency

```
Contingency = Construction Cost × Contingency Rate (typically 10-15%)
```

---

### 13.4 Gross Development Costs (GDC)

```
GDC = Purchase Price + Construction Cost + Contingency + Professional Fees
```

Professional fees include: architects, structural engineers, QS, planning consultant, CDM.

---

### 13.5 Development Finance: Loan Size

Subject to lesser of LTC and LTV-GDV:

```
Max by LTC = GDC × Max LTC (typically 80%)
Max by LTV-GDV = GDV × Max LTV-GDV (typically 65%)
Development Loan = min(Max by LTC, Max by LTV-GDV)
```

---

### 13.6 Arrangement Fee

```
Arrangement Fee = Development Loan × Arrangement Fee % (typically 1.5-2%)
```

---

### 13.7 Development Finance Interest (60% drawdown)

```
Average Drawdown = Development Loan × 60%
Interest = Average Drawdown × Annual Finance Rate × (Project Months / 12)
```

---

### 13.8 Total Project Cost

```
Total Project Cost = GDC + Arrangement Fee + Finance Interest
```

---

### 13.9 Equity Required

```
Equity Required = GDC - Development Loan
```

---

### 13.10 Sell Exit: Net Profit

```
Sales Agent Fee = GDV × 1.5% (typical)
Sell Profit = GDV - Total Project Cost - Sales Agent Fee
```

---

### 13.11 Hold Exit: Refinance

```
Hold Refinance LTV: 70% (stressed)
Hold Mortgage = GDV × 70%
Annual Mortgage Cost = Hold Mortgage × Stressed Rate (5.5% IO)
Net Annual Cashflow = (Gross Annual Rent × 0.80) - Annual Mortgage Cost
```

The 0.80 factor = 80% income retention (20% opex allowance).

---

### 13.12 Residual Land Value (RLV)

Valuation approach to determine maximum land price:

```
RLV = GDV - Build Costs - Contingency - Professional Fees - Finance Costs - Profit Requirement
```

The profit requirement = GDV × target development margin (e.g., 20-25%).

---

### 13.13 Development Appraisal Shorthand (RICS Residual Method)

```
RLV = GDV - Total Development Costs (excl. land) - Developer's Profit
Developer's Profit = GDV × Profit % on GDV  (or = Total Costs × Profit % on Cost)
```

---

## 14. Commercial Property

### 14.1 Gross Yield (Commercial)

```
Gross Yield (%) = (Passing Rent Annual / Purchase Price) × 100
```

---

### 14.2 Net Initial Yield (NIY)

```
NIY (%) = ((Passing Rent - Operating Costs) / Purchase Price) × 100
```

Operating Costs: management, insurance, maintenance reserve, void allowance.  
Excludes: mortgage, SDLT.

---

### 14.3 Reversionary Yield

```
Reversionary Yield (%) = ((ERV - Operating Costs) / Purchase Price) × 100
```

---

### 14.4 Capital Value (Investment Method)

```
Capital Value = Net Income / Target Yield (as decimal)
```

Example: £50,000 NOI at 7.5% yield = £50,000 / 0.075 = **£666,667**

---

### 14.5 Reversionary Capital Value (at ERV)

```
Reversionary Capital Value = ERV / Target Yield
```

---

### 14.6 Yield Shift (Capital Value Change)

```
New Capital Value = Income / New Yield
Capital Gain = New Capital Value - Old Capital Value
Capital Gain % = (Capital Gain / Old Capital Value) × 100
```

A 1% downward yield shift on commercial produces a large capital uplift.

---

### 14.7 WAULT - Weighted Average Unexpired Lease Term

```
WAULT (years) = Σ(Unexpired Lease Years × Annual Rent) / Σ(Annual Rent)
```

Calculated from today to each lease expiry. Uses rent-weighting. Higher WAULT = more income security.

---

### 14.8 WAULB - Weighted Average Unexpired Lease to Break

```
WAULB (years) = Σ(Years to Break × Annual Rent) / Σ(Annual Rent)
```

Conservative WAULT using the earliest break option rather than expiry.

---

### 14.9 Void Rate (Commercial)

```
Void Rate (%) = (Vacant Area / Total Lettable Area) × 100
```

---

### 14.10 Rent per Square Foot / Metre

```
Rent PSF = Annual Rent / Gross Internal Area (sq ft)
Rent PSM = Annual Rent / Gross Internal Area (sq m)
```

1 sq m = 10.764 sq ft

---

### 14.11 Estimated Rental Value (ERV)

Market rent per sq ft/m from comparable evidence, multiplied by area:

```
ERV = Market Rent Rate (£/sqft) × Lettable Area (sqft)
```

---

### 14.12 Rent Review Uplifts

Open market rent review (upward only):

```
New Rent = max(Passing Rent, Market ERV at Review Date)
Rent Uplift = max(0, ERV - Passing Rent)
```

RPI-linked review:

```
New Rent = Passing Rent × (CPI/RPI at Review / CPI/RPI at Previous Review)
```

---

### 14.13 Service Charge Net Recovery

```
Net Service Charge = Gross Service Charge Expenditure - Tenant Recoveries
```

In full repairing and insuring (FRI) leases, tenants bear all costs; landlord net service charge = £0.

---

## 15. Valuation Methods

### 15.1 Comparable Method (Market Approach)

```
Property Value = Adjusted Comparable Sale Price
Adjustment = Comparable Price × Adjustment Factor per Attribute
```

Adjustments for: condition, size, location, tenure, time of sale.

---

### 15.2 Investment Method (Income Capitalisation)

```
Value = Net Income / Capitalisation Rate (as decimal)
```

---

### 15.3 Discounted Cash Flow (DCF)

```
Value = Σ[CF(t) / (1 + r)^t]  for t = 1 to n
       + Terminal Value / (1 + r)^n
```

Where:
- **CF(t)** = Net cash flow in year t
- **r** = Discount rate (risk-adjusted required return)
- **Terminal Value** = Exit value at end of hold period

---

### 15.4 Terminal Value (Gordon Growth Model)

```
Terminal Value = CF(n) × (1 + g) / (r - g)
```

Where:
- **g** = Long-run income growth rate
- **r** = Discount rate

---

### 15.5 Residual Valuation

```
Land Value = GDV - Build Costs - Finance - Profit Requirement
```

Used to appraise development sites and back-calculate maximum bid price.

---

### 15.6 Depreciated Replacement Cost (DRC)

```
Value = Replacement Cost of Building - Accumulated Depreciation + Land Value
```

Used for specialist properties with no comparable market evidence.

---

### 15.7 Gross Rent Multiplier (GRM)

```
GRM = Purchase Price / Annual Gross Rent
```

Lower GRM = better relative income. UK single-let: GRM of 10-16 typical (6-10% gross yield).

---

### 15.8 Price per Room / Unit

```
Price per Room = Purchase Price / Number of Rooms
Price per Unit = Purchase Price / Number of Units
```

---

## 16. Time Value of Money

### 16.1 Net Present Value (NPV)

```
NPV = Σ[CF(t) / (1 + r)^t]  for t = 0 to n
```

- t = 0 is today (initial outlay, typically negative)
- t = 1,2,...,n are future annual cash flows
- r = annual discount rate (as decimal, e.g. 0.08 for 8%)

NPV > 0 = project exceeds hurdle rate. NPV = 0 = exactly meeting hurdle.

---

### 16.2 Internal Rate of Return (IRR)

The rate r that sets NPV = 0:

```
0 = Σ[CF(t) / (1 + IRR)^t]  for t = 0 to n
```

Solved numerically (Newton-Raphson):

```
r(new) = r(old) - NPV(r) / NPV'(r)

where NPV'(r) = Σ[-t × CF(t) / (1 + r)^(t+1)]
```

Converges typically in 20-80 iterations to ≤1e-8 accuracy.

---

### 16.3 Modified IRR (MIRR)

Overcomes IRR reinvestment assumption. Assumes positive CFs reinvested at finance rate, negatives discounted at cost of capital:

```
MIRR = (FV(positive CFs at reinvestment rate) / PV(negative CFs at finance rate))^(1/n) - 1
```

---

### 16.4 Payback Period

```
Payback Period (months) = Total Cash Invested / Monthly Net Cashflow
```

Simple payback, ignores time value.

---

### 16.5 Discounted Payback Period

The period when cumulative discounted cashflows recover the initial investment.

```
Find T: Σ[CF(t) / (1 + r)^t] = 0 for t = 0 to T
```

---

### 16.6 Present Value of a Perpetuity

```
PV = CF / r
```

Useful for valuing freehold ground rents or income streams with no end date.

---

### 16.7 Present Value of an Annuity

```
PV = CF × [1 - (1 + r)^(-n)] / r
```

---

### 16.8 Future Value

```
FV = PV × (1 + r)^n
```

---

### 16.9 Rule of 72 (Doubling Time Estimate)

```
Years to Double = 72 / Annual Return %
```

Example: 9% return → 72/9 = 8 years to double.

---

## 17. Debt and Leverage Ratios

### 17.1 Loan to Value (LTV)

```
LTV (%) = (Outstanding Loan / Property Value) × 100
```

---

### 17.2 Debt Yield

```
Debt Yield (%) = (NOI / Loan Amount) × 100
```

Lenders use debt yield as an alternative to LTV/DSCR, especially in commercial lending. Typical minimum: 8-10%.

```
Debt Yield (%) = NOI / Loan Amount × 100
```

---

### 17.3 Debt Service Coverage Ratio (DSCR)

```
DSCR = NOI / Annual Debt Service (P + I)
```

Minimum standards:
- Residential BTL (PRA stress test): ≥1.25× (basic rate) or ≥1.45× (higher rate taxpayer)
- Commercial property: ≥1.25× typical minimum; ≥1.35× for stronger lenders
- Development: DSCR at stabilisation typically required ≥1.20×

---

### 17.4 Interest Cover Ratio (ICR)

Used in BTL stress testing:

```
ICR = Annual Rent / Annual Interest Charge
```

---

### 17.5 Break-Even Ratio (BER)

```
BER (%) = (Operating Expenses + Debt Service) / Gross Income × 100
```

BER < 70% generally considered healthy for commercial property. Also expressed as breakeven occupancy:

```
Breakeven Occupancy (%) = (Annual OpEx + Annual Debt Service) / Annual Gross Potential Income × 100
```

---

### 17.6 Portfolio LTV

```
Portfolio LTV (%) = (Total Mortgage Debt / Total Portfolio Value) × 100
```

---

### 17.7 Positive Leverage Condition

Leverage enhances returns when:

```
Cap Rate > Mortgage Constant
```

Where:
```
Mortgage Constant = Annual Debt Service / Loan Amount
```

If cap rate > mortgage constant, every pound borrowed improves ROE.

---

## 18. Portfolio Metrics

### 18.1 Portfolio Gross Yield

```
Portfolio Gross Yield (%) = (Total Annual Rent / Total Portfolio Value) × 100
```

---

### 18.2 Portfolio Net Yield

```
Portfolio Net Yield (%) = ((Total Annual Rent - Total Operating Costs) / Total Portfolio Value) × 100
```

---

### 18.3 Portfolio Value

```
Portfolio Value = Σ(Individual Property Values)
```

---

### 18.4 Portfolio Equity

```
Portfolio Equity = Total Portfolio Value - Total Outstanding Mortgage Debt
```

---

### 18.5 Portfolio Annual Cashflow

```
Portfolio Annual Cashflow = Σ(Individual Property Annual Cashflows)
```

---

### 18.6 Average Yield (Weighted)

```
Weighted Avg Yield (%) = Σ(Property Value × Property Yield) / Total Portfolio Value
```

---

### 18.7 Portfolio LTV (See 17.6)

```
Portfolio LTV (%) = (Total Debt / Total Portfolio Value) × 100
```

---

### 18.8 Concentration Risk

```
Concentration % = (Single Asset Value or Single Area Value / Total Portfolio Value) × 100
```

Rule of thumb: no single asset should exceed 25-30% of portfolio value.

---

### 18.9 Annual Capital Growth

```
Capital Growth (%) = ((Current Value - Purchase Price) / Purchase Price) × 100
```

---

### 18.10 Compound Annual Growth Rate (CAGR)

```
CAGR (%) = ((Current Value / Purchase Price)^(1 / Years Held) - 1) × 100
```

---

## 19. Operational and Cost Metrics

### 19.1 Expense Ratio

```
Expense Ratio (%) = (Total Operating Expenses / Gross Rental Income) × 100
```

Typical UK BTL: 30-45%. HMO: 40-55%. SA: 45-65%.

---

### 19.2 Operating Cost per Property

```
Average OpEx = Total Operating Costs / Number of Properties
```

---

### 19.3 Void Rate

```
Void Rate (%) = (Total Void Days / Total Available Days) × 100
```

Or:

```
Void Rate (%) = (Void Months / 12) × 100
```

---

### 19.4 Occupancy Rate (SA / HMO)

```
Occupancy (%) = (Occupied Nights or Occupied Room-Nights / Total Available Nights) × 100
```

---

### 19.5 Refurb Cost per Square Metre

```
Refurb Cost PSM = Total Refurb Cost / Gross Internal Area (m²)
```

UK refurb benchmarks (2024-25):
- Light cosmetic: £200-£400/m²
- Medium (kitchen, bathroom, redecorating): £400-£700/m²
- Heavy (structural, rewire, replumb): £700-£1,200/m²
- Full gut and rebuild: £1,200-£2,000+/m²

---

### 19.6 Payback on Refurb Investment

```
Payback (months) = Refurb Cost / (Uplift in Monthly Rent or Cashflow)
```

---

### 19.7 Value Add from Refurb

```
Value Add = (New Market Value - Old Market Value) - Refurb Cost
Value Add (%) = Value Add / Refurb Cost × 100
```

Positive value add = refurb created equity above its cost.

---

### 19.8 Sourcing Fee

```
Sourcing Fee = Purchase Price × Sourcing % (typically 1-2%)
Or: fixed fee per deal (£3,000-£10,000+ depending on market)
```

---

## 20. UK Tax Considerations

These are indicators only. Always obtain qualified tax advice (HMRC/accountant).

### 20.1 Rental Income Tax (Individual Landlord)

```
Taxable Rental Profit = Gross Rental Income - Allowable Expenses (excl. mortgage interest)
```

Allowable expenses: letting agent fees, management, insurance, maintenance, service charges, ground rent, accountancy. NOT: mortgage capital repayment, SDLT, capital improvements.

Section 24 (since April 2020): Individual landlords cannot deduct mortgage interest from rental income. Instead, a 20% tax credit is given on mortgage finance costs.

```
Tax Credit = Mortgage Finance Costs × 20%
Tax Payable = (Taxable Profit × Marginal Rate) - Tax Credit
```

Basic rate (20%): effectively neutral (20% tax - 20% credit = 0 net extra tax on IO mortgage).  
Higher rate (40%): 40% tax - 20% credit = 20% effective additional tax on finance costs.

---

### 20.2 Mortgage Interest Tax Relief Net Impact

For higher-rate landlords under Section 24:

```
Extra Tax vs Pre-2017 = (Monthly Mortgage Interest × 12) × 20%
```

This amount is additional tax payable per year compared to the pre-2017 full-deduction regime.

---

### 20.3 Capital Gains Tax (CGT) on Residential Property

CGT is levied on the gain when a property is sold (not PPR - principal private residence).

```
Gain = Sale Price - Purchase Price - Allowable Costs (SDLT, legal, improvement costs, agent)
Taxable Gain = Gain - Annual CGT Allowance (£3,000 for 2024-25)
CGT = Taxable Gain × CGT Rate
```

CGT rates for residential property (2024-25 onwards):
- Basic rate taxpayer: 18%
- Higher/additional rate taxpayer: 24%

---

### 20.4 CGT Calculation with Purchase Costs

```
Allowable Base Cost = Purchase Price + SDLT + Legal Buy + Survey
Allowable Improvement Costs = Capital Improvements (not repairs)
Net Gain = Sale Price - Allowable Base Cost - Allowable Improvement Costs - Selling Costs
```

---

### 20.5 Incorporation (Ltd Company) SDLT Consideration

Transferring personally-held properties to a Ltd company triggers SDLT at full market value (and CGT). Run the SDLT calculation at market value, not original purchase price.

---

### 20.6 Annual Tax on Enveloped Dwellings (ATED)

Properties valued above £500,000 held by non-natural persons (companies, partnerships with corporate members) are subject to ATED.

2024-25 ATED annual charges (illustrative):
- £500,001 - £1m: £4,400/year
- £1m - £2m: £9,000/year
- £2m - £5m: £30,550/year
- £5m - £10m: £71,500/year
- £10m - £20m: £143,550/year
- Above £20m: £287,500/year

Reliefs available for let properties, development, and certain trading activities.

---

### 20.7 VAT on Commercial Property

New commercial property: standard-rated (20%) - buyer can recover if VAT-registered.  
Old commercial property: exempt by default. Seller can opt to tax (OTT), making it 20% VATable.

```
VAT on Purchase = Purchase Price × 20% (if opted to tax)
```

VAT is recoverable against output VAT if buyer is VAT-registered for related income.

---

### 20.8 Income from Furnished Holiday Let (FHL) - Transitional Note

FHL regime abolished from April 2025. Properties previously qualifying as FHL are now taxed as standard rental property. Mortgage interest tax credit (Section 24) applies from April 2025.

---

### 20.9 Non-Resident Capital Gains Tax (NRCGT)

Non-UK residents selling UK residential property must report and pay CGT within 60 days of completion. Rate: 18%/24% (same as residents from April 2024 change).

---

## Reference Benchmarks (UK Market, 2025)

These are indicative ranges, not guarantees. Markets vary significantly by region.

| Metric | Typical Range | Notes |
|--------|--------------|-------|
| BTL Gross Yield | 4% - 9% | Varies hugely by region; London 3-5%, North 6-9% |
| BTL Net Yield | 2.5% - 6% | After management, insurance, maintenance, voids |
| HMO Gross Yield | 8% - 15% | Room-by-room lettings; premium above single-let |
| SA Gross Yield | 10% - 25% | Varies by location, season, and management quality |
| Bridging Monthly Rate | 0.65% - 1.2%/mo | Higher for regulated residential |
| Development Margin | 20% - 30% on GDV | 20% minimum viable; 25% target |
| BTL Mortgage Rate | 5% - 7% (2025) | IO product rates |
| Commercial Cap Rate | 4.5% - 9% | Highly variable by asset class and covenant |
| HMO Management Fee | 10% - 15% of gross rent | Full management, including voids cover |
| SA Management Fee | 15% - 25% of revenue | Full management including OTA management |
| BTL Management Fee | 8% - 12% of gross rent | Full management |
| Maintenance Reserve | 0.5% - 1.5% pa of value | Higher for older properties |
| Void Rate (single-let) | 5% - 10% (0.6-1.2 mo/yr) | Regional demand variation |
| Refurb Light | £200 - £400/m² | Cosmetic only |
| Refurb Medium | £400 - £700/m² | Kitchen/bathroom included |
| Refurb Heavy | £700 - £1,200/m² | Full structural works |
| Solicitor Fees (buy) | £1,000 - £3,000 | Freehold; leasehold higher |
| Solicitor Fees (sell) | £800 - £2,000 | Standard residential |
| Survey (Homebuyer) | £350 - £800 | Level 2 report |
| Survey (Building) | £600 - £1,500 | Level 3 / full structural |
| Bridging Arrangement | 1.5% - 2% of facility | One-off fee |
| Estate Agent (sell) | 1% - 2.5% + VAT | Sole agency; multi-agency higher |
| Source Fee | £3,000 - £10,000 | Or 1-2% of purchase price |

---

## Formula Quick Reference

```
Gross Yield (%)          = (Rent × 12 / Value) × 100
Net Yield (%)            = ((Rent × 12 - OpEx) / Value) × 100
ROI (%)                  = (Annual Cashflow / Cash Invested) × 100
CoC (%)                  = (Pre-tax CF / Cash Deployed) × 100
ROE (%)                  = (Net Income / Current Equity) × 100
DSCR                     = NOI / Annual Debt Service
LTV (%)                  = (Loan / Value) × 100
LTC (%)                  = (Loan / Total Cost) × 100
Cap Rate (%)             = (NOI / Price) × 100
GRM                      = Price / Annual Gross Rent
Mortgage (repayment)     = P × (r × (1+r)^n) / ((1+r)^n - 1)
Mortgage (IO)            = P × (r / 12)
Bridging interest        = Loan × Annual Rate × (Months / 12)
NPV                      = Σ[CF(t) / (1+r)^t]
BRR: Capital Recycled    = min(100, Refinance / TotalCost × 100)
BRR: Cash Left In        = max(0, TotalCost - Refinance)
R2R: Annual Profit       = (Monthly Profit × 12) - (g × Void Months)
Dev Margin (%)           = (Net Profit / GDV) × 100
WAULT                    = Σ(Lease Years × Rent) / Σ(Rent)
Breakeven Occ (%)        = (OpEx + Debt) / GPI × 100
SA RevPAR                = Total Revenue / Total Available Nights
SA ADR                   = Total Revenue / Nights Booked
CAGR (%)                 = ((FV / PV)^(1/Years) - 1) × 100
```

---

*This document is a financial reference for the Propreneur platform. All figures and rates should be verified against current HMRC guidance, lender criteria, and market conditions before use in actual investment decisions. Not financial advice.*
