# Deal Calculators

**Last updated:** 2026-05-17

## Overview
18 financial calculators for property investment analysis: 9 deal strategy calculators and 9 financial tools. Run them from the calculator playground, via Carina AI, or through the API. Save analyses for later reference and compare scenarios with sensitivity grids.

## Core Features

### Deal Strategy Calculators (9)
| Calculator | What It Does |
|------------|-------------|
| **Buy-to-Let** | Gross yield, net cashflow, ROI, stress testing |
| **BRR (Buy, Refurb, Refinance)** | Total investment, refinance LTV, cash left in, equity |
| **HMO** | Room-by-room rents, void periods, yields |
| **Rent-to-Rent** | Margin between subtenant income and landlord rent |
| **Serviced Accommodation** | Nightly rate, occupancy percentage, revenue |
| **Flip** | Net profit, ROI after purchase + refurb + sale costs |
| **BMV No Money Down** | Below market value + 100% bridging + same-day remortgage |
| **Commercial** | Commercial yields, WAULT, SDLT, value-add potential |
| **Development** | Commercial-to-residential: GDV, GDC, development finance, exits |

### Financial Tool Calculators (9)
| Tool | What It Does |
|------|-------------|
| **NPV & IRR** | Discounted cash flow analysis |
| **DSCR** | Debt service coverage ratio |
| **Income Multiples** | NOI, cap rate, GRM, gross yield |
| **Cash-on-Cash / ROE** | Pre-tax cash flow return + return on equity |
| **Loan-to-Value** | LTV percentage and implied equity |
| **Breakeven Occupancy** | Minimum occupancy needed to cover expenses |
| **SDLT** | Stamp duty for England/NI residential purchases |
| **Bridging Finance** | Interest and fee calculations |
| **Mortgage Repayment** | Interest-only or repayment monthly payments |

### Side-by-side comparison
Compare Serviced Accommodation vs Buy-to-Let on key metrics in one view.

## Getting Started
1. Go to the Calculator Playground from the workspace
2. Select a strategy or tool from the sidebar
3. Enter your property details (price, deposit, rental income, costs)
4. View instant results with key metrics
5. Run sensitivity analyses to test different scenarios

## Key Workflows

### Running a deal analysis
Enter property price, deposit, interest rate, rental income, and costs. The calculator instantly returns yield, cashflow, ROI, and stress-test results. Every run is logged for your audit trail.

### Sensitivity analysis
For BTL, BRR, HMO, R2R, SA, Flip, Commercial, and Development calculators, run sensitivity grids to see how results change with ±1% interest rate changes, different rental incomes, or cost variations.

### Saving and reusing defaults
Set workspace-wide default values for interest rates, tax rates, and fee percentages. New calculations pre-fill with your preferences. Saved analyses can be revisited later.

### Carina integration
Ask Carina "Run a BTL calc on a 3-bed in Manchester" and she'll walk you through the inputs conversationally, then run the calculation and explain the results.

## Business Rules
- All financial values use pence-level precision for accurate calculations
- Every calculator run is logged immutably for audit purposes
- Sensitivity grids support multi-scenario comparison (e.g., ±1% interest rate)
- Calculator runs can be linked to saved deal analyses for later reference
- Workspace defaults are per-tenant and persist across sessions

## Best Practices
- Set workspace defaults once so every new calculation starts with your preferred rates
- Run sensitivity grids before making offers - small changes in interest rates can swing viability
- Link calculator runs to deal analyses for a complete underwriting record
- Use Carina for quick "what if" scenarios during conversations
- Compare SA vs BTL side-by-side when evaluating different strategy options

## Related Features
- **Carina Agent** - Ask Carina to run any calculator conversationally
- **Pipeline Automation** - Link deal analyses to pipeline cards
- **Refurbishment** - Include refurb costs in flip and BRR calculations
