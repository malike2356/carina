<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Formula explanations (Show Working)
|--------------------------------------------------------------------------
|
| Static metadata for each calculator output Propreneur surfaces a "Show
| working" panel for. The live numbers (variable values + arithmetic steps)
| are built per-request by {@see \App\Services\Deals\CalculatorWorking\CalculatorWorkingService};
| this file only holds the prose, the formula text, and the Xelox source slug.
|
| Source articles live at
| /opt/lampp/htdocs/VERLOX/xeloxproperties/blogPosts/Calculations/*.md
| (Xelox Properties Ltd). The wording here is rewritten in Propreneur's voice
| with a citation link — never embedded or iframed.
|
| Phase 1 calculators (Tier 1): btl, hmo, sdlt, brr, sa.
| Phase 2+ slots are documented inline so the registry is easy to extend.
*/

return [
    'xelox_base_url' => env('XELOX_BLOG_BASE_URL', 'https://xeloxproperties.co.uk/blog/calculations'),

    'attribution' => 'This calculation is based on methodology developed and proven by Xelox Properties Ltd.',

    // ─────────────────────────────────────────────────────────────────
    // BTL — Buy-to-Let
    // ─────────────────────────────────────────────────────────────────
    'btl' => [
        'gross_yield_pct' => [
            'display_name' => 'BTL Gross Yield',
            'unit'         => '%',
            'formula'      => '(Monthly Rent × 12 ÷ Purchase Price) × 100',
            'variables'    => [
                ['name' => 'Monthly Rent',   'description' => 'Gross rent the property collects each month.'],
                ['name' => 'Purchase Price', 'description' => 'What you pay for the property (offer / agreed price).'],
            ],
            'plain_summary' => 'Gross yield is the first sanity-check on a BTL: how much annual rent the property generates as a percentage of the price you paid. It ignores costs and mortgage, so it always looks better than reality — use it as a filter, never as a verdict.',
            'rule_of_thumb' => 'In the current rate environment, a gross yield below 5% will struggle to cashflow at 75% LTV.',
            'xelox_slug'    => '042-btl-gross-yield-the-first-number-you-should-know-on-any-buy-to-let',
        ],

        'net_yield_pct' => [
            'display_name' => 'BTL Net Yield',
            'unit'         => '%',
            'formula'      => '((Annual Rent − Annual Operating Costs) ÷ Purchase Price) × 100',
            'variables'    => [
                ['name' => 'Annual Rent',           'description' => 'Monthly rent × 12.'],
                ['name' => 'Annual Operating Costs', 'description' => 'Mortgage + insurance + management + maintenance + voids + council tax + utilities.'],
                ['name' => 'Purchase Price',        'description' => 'Offer / agreed price.'],
            ],
            'plain_summary' => 'Net yield strips out the costs you actually pay each year. It is the number that decides whether a deal works after operating reality.',
            'rule_of_thumb' => 'On the South Coast, typical BTL net yields are 3% to 4.5%. Below 3% the property will struggle to cashflow at current rates.',
            'xelox_slug'    => '043-btl-net-yield-the-number-that-actually-matters',
        ],

        'monthly_cashflow' => [
            'display_name' => 'Monthly Cashflow',
            'unit'         => '£',
            'formula'      => 'Rent − Mortgage − Insurance − Management − Maintenance − Voids − Council Tax − Utilities',
            'variables'    => [
                ['name' => 'Rent',        'description' => 'Monthly rent.'],
                ['name' => 'Mortgage',    'description' => 'Monthly mortgage payment (interest-only or repayment).'],
                ['name' => 'Management',  'description' => 'Letting-agent fee, usually 10–12% of rent.'],
                ['name' => 'Maintenance', 'description' => '1% of property value per year, divided by 12.'],
                ['name' => 'Voids',       'description' => 'Allowance for empty months — default 1 month a year.'],
            ],
            'plain_summary' => 'Monthly cashflow is what actually lands in your account after every operating cost. Negative cashflow means you are subsidising the mortgage out of your salary.',
            'rule_of_thumb' => 'Aim for £150–£300 a month positive after all costs at 75% LTV.',
            'xelox_slug'    => '044-btl-monthly-cashflow-the-operating-reality-of-every-buy-to-let',
        ],

        'annual_costs_total' => [
            'display_name' => 'Annual Operating Costs',
            'unit'         => '£',
            'formula'      => 'Mortgage + Insurance + Council Tax + Utilities + Management + Maintenance + Voids',
            'variables'    => [
                ['name' => 'Management',  'description' => 'Annual Rent × management % (default 12%).'],
                ['name' => 'Maintenance', 'description' => 'Purchase Price × maintenance % (default 1%).'],
                ['name' => 'Voids',       'description' => 'Monthly Rent × void months (default 1 month a year).'],
            ],
            'plain_summary' => 'The all-in annual cost of owning and letting this property. Most new investors under-estimate it by leaving out maintenance and voids.',
            'rule_of_thumb' => 'Expect 25–35% of gross annual rent to disappear into operating costs before mortgage.',
            'xelox_slug'    => '022-void-allowance-the-cost-new-landlords-always-forget',
        ],

        'roi_pct' => [
            'display_name' => 'Return on Investment (ROI)',
            'unit'         => '%',
            'formula'      => '(Annual Cashflow ÷ Total Cash Invested) × 100',
            'variables'    => [
                ['name' => 'Annual Cashflow',    'description' => 'Monthly Cashflow × 12.'],
                ['name' => 'Total Cash Invested', 'description' => 'Deposit + SDLT + legal fees + survey + refurb.'],
            ],
            'plain_summary' => 'ROI tells you how hard the money you actually put into the deal is working. It is the number to compare across deals of different sizes.',
            'rule_of_thumb' => 'Below 6% ROI on cash, the deal is competing with bank savings — only worth it for capital growth.',
            'xelox_slug'    => '048-btl-roi-return-on-investment-for-your-buy-to-let',
        ],

        'stamp_duty_computed' => [
            'display_name' => 'Stamp Duty (Additional Property)',
            'unit'         => '£',
            'formula'      => '5% × £0–£250k + 10% × £250k–£925k + 15% × £925k–£1.5m + 17% × £1.5m+',
            'variables'    => [
                ['name' => 'Purchase Price', 'description' => 'Agreed price; SDLT bands apply progressively.'],
            ],
            'plain_summary' => 'Additional-dwelling SDLT (the 5% surcharge schedule). This applies when the property is not your main home — every BTL purchase.',
            'rule_of_thumb' => 'Roughly 5–8% of the purchase price on typical BTL stock under £500k.',
            'xelox_slug'    => '036-additional-dwelling-surcharge-sdlt-when-you-buy-a-second-home-or-btl',
        ],

        'mortgage_stress_pass' => [
            'display_name' => 'Mortgage Stress Test',
            'unit'         => 'bool',
            'formula'      => '(Monthly Rent × Stress Rent Factor) ≥ (Monthly Mortgage × Stress Mortgage Factor)',
            'variables'    => [
                ['name' => 'Stress Rent Factor',     'description' => 'Lenders assume only 75% of rent is reliable (default 0.75).'],
                ['name' => 'Stress Mortgage Factor', 'description' => 'Lenders stress the rate up by 25% (default 1.25).'],
            ],
            'plain_summary' => 'The same test a BTL lender runs before approving your mortgage. Fail this and the deal will not finance at the LTV you want.',
            'rule_of_thumb' => 'Most lenders want 125–145% rental cover at a stressed rate. If you fail, you will need a higher deposit or higher rent.',
            'xelox_slug'    => '031-btl-mortgage-stress-test-will-the-lender-say-yes',
        ],
    ],

    // ─────────────────────────────────────────────────────────────────
    // HMO — House in Multiple Occupation
    // ─────────────────────────────────────────────────────────────────
    'hmo' => [
        'gross_annual_rent' => [
            'display_name' => 'HMO Gross Annual Rent',
            'unit'         => '£',
            'formula'      => '(Rent per Room × Rooms × 12) − (Rent per Room × Void Months × Rooms)',
            'variables'    => [
                ['name' => 'Rent per Room', 'description' => 'Average monthly rent per let room.'],
                ['name' => 'Rooms',         'description' => 'Number of lettable rooms.'],
                ['name' => 'Void Months',   'description' => 'Months per year each room sits empty (default 1).'],
            ],
            'plain_summary' => 'HMO income is calculated room by room. The gross potential is every room let; the gross effective figure subtracts an allowance for the empty months you should expect.',
            'rule_of_thumb' => 'A well-located 5-bed HMO in Portsmouth gross-rents £30k–£50k a year — about 2–3× a single-let.',
            'xelox_slug'    => '051-hmo-gross-potential-rent-how-much-a-house-share-could-earn',
        ],

        'operating_expenses' => [
            'display_name' => 'HMO Operating Expenses',
            'unit'         => '£',
            'formula'      => 'Licence Fee + Council Tax + Utilities + Insurance + (Gross Rent × Management %) + (Gross Rent × Maintenance %)',
            'variables'    => [
                ['name' => 'Licence Fee',  'description' => 'Annual HMO licence cost — varies by council, default £800.'],
                ['name' => 'Management %', 'description' => 'Default 12% of gross rent.'],
                ['name' => 'Maintenance %', 'description' => 'Default 5% of gross rent — HMOs wear faster than single-lets.'],
            ],
            'plain_summary' => 'HMOs cost more to run than single-lets: bills are included, voids per room are higher, wear and tear is faster, and most councils require an annual licence.',
            'rule_of_thumb' => 'Budget 35–45% of gross rent for opex before mortgage on a fully-occupied HMO.',
            'xelox_slug'    => '053-hmo-noi-net-operating-income-for-a-multi-let-property',
        ],

        'noi_annual' => [
            'display_name' => 'HMO Net Operating Income (NOI)',
            'unit'         => '£',
            'formula'      => 'Gross Annual Rent − Operating Expenses',
            'variables'    => [
                ['name' => 'Gross Annual Rent',  'description' => 'Effective rent after void allowance.'],
                ['name' => 'Operating Expenses', 'description' => 'All costs before debt service.'],
            ],
            'plain_summary' => 'NOI is the property\'s income performance independent of how you financed it. It is what every commercial lender values the building on.',
            'xelox_slug'    => '053-hmo-noi-net-operating-income-for-a-multi-let-property',
        ],

        'net_yield_pct' => [
            'display_name' => 'HMO Net Yield',
            'unit'         => '%',
            'formula'      => '(NOI ÷ Purchase Price) × 100',
            'variables'    => [
                ['name' => 'NOI',            'description' => 'Net operating income — gross rent minus opex.'],
                ['name' => 'Purchase Price', 'description' => 'What you paid for the building.'],
            ],
            'plain_summary' => 'HMO net yield strips out the extra costs that gross yield hides. A 15% gross HMO can be a 7% net HMO once you load the real costs.',
            'rule_of_thumb' => 'A solid HMO net yield is 7–10% in the regions; below 7% the model is hard to justify versus single-let plus your time.',
            'xelox_slug'    => '054-hmo-net-yield-the-real-return-on-your-multi-let-investment',
        ],

        'cash_on_cash_pct' => [
            'display_name' => 'HMO Cash-on-Cash',
            'unit'         => '%',
            'formula'      => '((NOI − Annual Mortgage) ÷ Total Investment) × 100',
            'variables'    => [
                ['name' => 'Annual Mortgage',  'description' => 'Mortgage interest + capital paid per year.'],
                ['name' => 'Total Investment', 'description' => 'Deposit + SDLT + conversion costs + setup.'],
            ],
            'plain_summary' => 'Cash-on-cash is the percent return on the cash you actually parked in the deal — the metric that compares HMOs to any other investment of the same size.',
            'rule_of_thumb' => 'HMO cash-on-cash returns of 10–15% are normal; below 8% the extra work seldom pays off.',
            'xelox_slug'    => '055-hmo-cash-on-cash-is-the-extra-work-worth-the-extra-return',
        ],
    ],

    // ─────────────────────────────────────────────────────────────────
    // SDLT
    // ─────────────────────────────────────────────────────────────────
    'sdlt' => [
        'sdlt_total' => [
            'display_name' => 'Stamp Duty Land Tax',
            'unit'         => '£',
            'formula_by_profile' => [
                'standard'             => '0% × £0–£250k + 5% × £250k–£925k + 10% × £925k–£1.5m + 12% × £1.5m+',
                'additional_property'  => '5% × £0–£250k + 10% × £250k–£925k + 15% × £925k–£1.5m + 17% × £1.5m+',
                'first_time_buyer'     => '0% × £0–£425k + 5% × £425k–£625k (above £625k: standard rates)',
            ],
            'variables' => [
                ['name' => 'Purchase Price', 'description' => 'Agreed price; SDLT is calculated band by band, not on the whole price.'],
                ['name' => 'Profile',        'description' => 'Standard (main home), additional property (BTL / second home), or first-time buyer.'],
            ],
            'plain_summary' => 'SDLT is progressive — you pay a different rate on each band of the price, like income tax. The rate on the first pound is not the rate on the last.',
            'rule_of_thumb' => 'SDLT is paid in cash on completion. It is not added to your mortgage. Have it ready.',
            'xelox_slug'    => '035-standard-residential-sdlt-how-stamp-duty-works-for-your-main-home',
        ],

        'effective_rate_pct' => [
            'display_name' => 'Effective SDLT Rate',
            'unit'         => '%',
            'formula'      => '(SDLT Total ÷ Purchase Price) × 100',
            'variables'    => [
                ['name' => 'SDLT Total',     'description' => 'The cash amount of stamp duty you actually pay.'],
                ['name' => 'Purchase Price', 'description' => 'Agreed price.'],
            ],
            'plain_summary' => 'The single percentage that tells you what proportion of the purchase price you pay in SDLT — useful for budgeting and for comparing properties at different price points.',
            'xelox_slug'    => '041-effective-sdlt-rate-the-true-percentage-you-pay-on-your-purchase',
        ],
    ],

    // ─────────────────────────────────────────────────────────────────
    // BRR — Buy, Refurbish, Refinance
    // ─────────────────────────────────────────────────────────────────
    'brr' => [
        'total_cost' => [
            'display_name' => 'BRR Total Cost',
            'unit'         => '£',
            'formula'      => 'Purchase Price + SDLT + Legal + Survey + Refurb + Finance Costs + Contingency',
            'variables'    => [
                ['name' => 'Purchase Price', 'description' => 'Agreed price.'],
                ['name' => 'SDLT',           'description' => 'Stamp duty (additional property surcharge applies).'],
                ['name' => 'Legal',          'description' => 'Conveyancing fees — default £1,500.'],
                ['name' => 'Survey',         'description' => 'Building survey — default £500.'],
                ['name' => 'Refurb',         'description' => 'Quoted refurb cost.'],
                ['name' => 'Finance Costs',  'description' => 'Bridging interest + arrangement fees during the works.'],
                ['name' => 'Contingency',    'description' => 'Refurb × 10% safety buffer.'],
            ],
            'plain_summary' => 'The all-in number you spend before you can refinance — everything from the purchase price to the legal fees to the contingency. If this exceeds the after-refurb value (ARV), the BRR is dead.',
            'rule_of_thumb' => 'New investors forget bridging interest and contingency. They eat 5–10% of the deal.',
            'xelox_slug'    => '074-brr-total-cost-what-you-actually-spend-before-refinancing',
        ],

        'refinance_gross' => [
            'display_name' => 'Refinance Proceeds',
            'unit'         => '£',
            'formula'      => 'After-Refurb Value × Refinance LTV',
            'variables'    => [
                ['name' => 'After-Refurb Value', 'description' => 'The post-works valuation a surveyor will sign off on.'],
                ['name' => 'Refinance LTV',      'description' => 'The percentage a BTL lender will lend (default 75%).'],
            ],
            'plain_summary' => 'The cash the bank gives you on refinance. This is what pays back the bridge and (hopefully) returns your deposit.',
            'xelox_slug'    => '076-brr-refinance-proceeds-how-much-the-bank-will-give-you-after-refurb',
        ],

        'cash_left_in' => [
            'display_name' => 'Cash Left In',
            'unit'         => '£',
            'formula'      => 'max(0, Total Cost − Refinance Proceeds)',
            'variables'    => [
                ['name' => 'Total Cost',          'description' => 'The all-in number above.'],
                ['name' => 'Refinance Proceeds', 'description' => 'What the bank gives you.'],
            ],
            'plain_summary' => 'What is still tied up in the deal after refinance. The whole point of BRR is to drive this towards zero so you can buy the next one.',
            'rule_of_thumb' => 'A "perfect" BRR recycles 100% of your cash. £5k–£15k left in is a normal real-world outcome.',
            'xelox_slug'    => '077-brr-cash-left-in-how-much-of-your-own-money-is-still-stuck-in-the-deal',
        ],

        'capital_recycled_pct' => [
            'display_name' => 'Capital Recycled',
            'unit'         => '%',
            'formula'      => 'min(100, (Refinance Proceeds ÷ Total Cost) × 100)',
            'variables'    => [
                ['name' => 'Refinance Proceeds', 'description' => 'What the bank releases on refinance.'],
                ['name' => 'Total Cost',         'description' => 'All-in spend before refinance.'],
            ],
            'plain_summary' => 'The percentage of your money you pulled back out. 100% is a "no money left in" deal.',
            'xelox_slug'    => '079-brr-capital-recycled-what-percentage-of-your-investment-did-you-get-ba',
        ],

        'equity_created' => [
            'display_name' => 'Equity Created',
            'unit'         => '£',
            'formula'      => 'After-Refurb Value − Refinance Proceeds',
            'variables'    => [
                ['name' => 'After-Refurb Value', 'description' => 'Post-works valuation.'],
                ['name' => 'Refinance Proceeds', 'description' => 'What you remortgaged the property for.'],
            ],
            'plain_summary' => 'The equity the bank leaves with you after refinance — the part of the new valuation you still own outright.',
            'xelox_slug'    => '080-brr-equity-created-how-much-value-you-built-through-the-refurb',
        ],

        'final_ltv_pct' => [
            'display_name' => 'Final LTV',
            'unit'         => '%',
            'formula'      => '(Refinance Proceeds ÷ After-Refurb Value) × 100',
            'variables'    => [
                ['name' => 'Refinance Proceeds', 'description' => 'New mortgage balance after refinance.'],
                ['name' => 'After-Refurb Value', 'description' => 'Post-works valuation.'],
            ],
            'plain_summary' => 'Your loan-to-value after the refinance — the single most important number to your lender.',
            'rule_of_thumb' => 'Most BTL lenders cap refinance LTV at 75%. Some specialist lenders go to 80%.',
            'xelox_slug'    => '029-loan-to-value-the-single-most-important-number-in-property-finance',
        ],
    ],

    // ─────────────────────────────────────────────────────────────────
    // SA — Serviced Accommodation
    // ─────────────────────────────────────────────────────────────────
    'sa' => [
        'monthly_revenue' => [
            'display_name' => 'SA Monthly Revenue',
            'unit'         => '£',
            'formula'      => 'Nightly Rate × Occupancy % × 30.4 × Room Count',
            'variables'    => [
                ['name' => 'Nightly Rate', 'description' => 'Average nightly rate (ADR).'],
                ['name' => 'Occupancy %',  'description' => 'The fraction of nights you expect to be booked.'],
                ['name' => 'Room Count',   'description' => 'Number of bookable units (default 1).'],
            ],
            'plain_summary' => 'SA is a hospitality business — income is nights × rate, not monthly rent. 30.4 is the average days per month over a year.',
            'xelox_slug'    => '065-sa-monthly-revenue-breaking-down-your-serviced-accommodation-income',
        ],

        'annual_revenue' => [
            'display_name' => 'SA Annual Revenue',
            'unit'         => '£',
            'formula'      => 'Nightly Rate × Occupancy % × 365 × Room Count',
            'variables'    => [
                ['name' => 'Nightly Rate', 'description' => 'Average nightly rate (ADR).'],
                ['name' => 'Occupancy %',  'description' => 'Annual occupancy expectation.'],
                ['name' => 'Room Count',   'description' => 'Bookable units.'],
            ],
            'plain_summary' => 'Annualised revenue projection. A well-run SA delivers 2–3× the gross rent of the same property as a BTL — but with proportionally higher costs.',
            'rule_of_thumb' => 'Portsmouth SAs range £20k–£50k revenue depending on location, size and quality.',
            'xelox_slug'    => '064-sa-annual-revenue-projecting-income-for-your-serviced-accommodation',
        ],

        'operating_costs' => [
            'display_name' => 'SA Operating Costs',
            'unit'         => '£',
            'formula'      => '(Revenue × Cleaning %) + (Revenue × Management %) + (Revenue × Platform %) + (Utilities × 12) + (Other × 12)',
            'variables'    => [
                ['name' => 'Cleaning %',  'description' => 'Cleaner cost as % of revenue (default 25%).'],
                ['name' => 'Management %', 'description' => 'SA management agency fee (default 15%).'],
                ['name' => 'Platform %',  'description' => 'Airbnb / Booking.com commission (default 10%).'],
                ['name' => 'Utilities',   'description' => 'Monthly utilities — landlord pays in SA.'],
            ],
            'plain_summary' => 'SA opex is fundamentally different from BTL: cleaning, platform fees, and bills are all on you. The gross-to-net gap is much larger.',
            'rule_of_thumb' => 'Budget 50–60% of revenue for opex before mortgage on a managed SA.',
            'xelox_slug'    => '073-sa-cleaning-cost-per-stay-the-hidden-cost-that-eats-your-margin',
        ],

        'annual_noi' => [
            'display_name' => 'SA Net Operating Income',
            'unit'         => '£',
            'formula'      => 'Annual Revenue − Operating Costs',
            'variables'    => [
                ['name' => 'Annual Revenue',  'description' => 'Projected gross income.'],
                ['name' => 'Operating Costs', 'description' => 'All opex before debt service.'],
            ],
            'plain_summary' => 'The true performance of the SA business — what it earns before financing. Always compare NOI, never revenue.',
            'xelox_slug'    => '069-sa-annual-noi-your-serviced-accommodation-s-true-operating-income',
        ],

        'revpar_daily' => [
            'display_name' => 'RevPAR (Revenue per Available Room-Night)',
            'unit'         => '£',
            'formula'      => 'Annual Revenue ÷ Rooms ÷ 365',
            'variables'    => [
                ['name' => 'Annual Revenue', 'description' => 'Projected revenue.'],
                ['name' => 'Rooms',          'description' => 'Bookable units.'],
                ['name' => '365',            'description' => 'Total available room-nights per year per unit.'],
            ],
            'plain_summary' => 'The hospitality-industry metric that blends rate and occupancy into a single number. The cleanest way to compare two SA properties.',
            'xelox_slug'    => '067-revpar-revenue-per-available-room-night-the-hotel-industry-standard-fo',
        ],
    ],

    /*
    | Phase 2+ slots (not implemented in this prompt):
    |   r2r, flip, commercial, bmv_no_money_down, development, refurb,
    |   sa_vs_btl, npv_irr, dscr, income_multiples, coc_roe, ltv,
    |   breakeven_occupancy, bridging, mortgage, section_24, cgt, portfolio_*
    */
];
