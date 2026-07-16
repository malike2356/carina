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
| with a citation link - never embedded or iframed.
|
| Phase 1 calculators (Tier 1): btl, hmo, sdlt, brr, sa.
| Phase 2+ slots are documented inline so the registry is easy to extend.
*/

return [
    // Single citation back to the Xelox blog index. Per-article URLs are
    // intentionally not exposed in the UI (the articles may not be published
    // yet - a broken link is worse than no link). Readers can browse the
    // blog and find the relevant article themselves.
    'xelox_blog_url' => env('XELOX_BLOG_URL', 'https://xeloxproperties.co.uk/blog/'),

    'attribution' => 'This calculation is based on methodology developed and proven by Xelox Properties Ltd.',
    'attribution_link' => 'Read the full Xelox Properties blog',

    // ─────────────────────────────────────────────────────────────────
    // BTL - Buy-to-Let
    // ─────────────────────────────────────────────────────────────────
    'btl' => [
        'gross_yield_pct' => [
            'display_name' => 'BTL Gross Yield',
            'unit' => '%',
            'formula' => '(Monthly Rent × 12 ÷ Purchase Price) × 100',
            'variables' => [
                ['name' => 'Monthly Rent',   'description' => 'Gross rent the property collects each month.'],
                ['name' => 'Purchase Price', 'description' => 'What you pay for the property (offer / agreed price).'],
            ],
            'plain_summary' => 'Gross yield is the first sanity-check on a BTL: how much annual rent the property generates as a percentage of the price you paid. It ignores costs and mortgage, so it always looks better than reality - use it as a filter, never as a verdict.',
            'rule_of_thumb' => 'In the current rate environment, a gross yield below 5% will struggle to cashflow at 75% LTV.',
            'xelox_slug' => '042-btl-gross-yield-the-first-number-you-should-know-on-any-buy-to-let',
        ],

        'net_yield_pct' => [
            'display_name' => 'BTL Net Yield',
            'unit' => '%',
            'formula' => '((Annual Rent − Annual Operating Costs) ÷ Purchase Price) × 100',
            'variables' => [
                ['name' => 'Annual Rent',           'description' => 'Monthly rent × 12.'],
                ['name' => 'Annual Operating Costs', 'description' => 'Mortgage + insurance + management + maintenance + voids + council tax + utilities.'],
                ['name' => 'Purchase Price',        'description' => 'Offer / agreed price.'],
            ],
            'plain_summary' => 'Net yield strips out the costs you actually pay each year. It is the number that decides whether a deal works after operating reality.',
            'rule_of_thumb' => 'On the South Coast, typical BTL net yields are 3% to 4.5%. Below 3% the property will struggle to cashflow at current rates.',
            'xelox_slug' => '043-btl-net-yield-the-number-that-actually-matters',
        ],

        'monthly_cashflow' => [
            'display_name' => 'Monthly Cashflow',
            'unit' => '£',
            'formula' => 'Rent − Mortgage − Insurance − Management − Maintenance − Voids − Council Tax − Utilities',
            'variables' => [
                ['name' => 'Rent',        'description' => 'Monthly rent.'],
                ['name' => 'Mortgage',    'description' => 'Monthly mortgage payment (interest-only or repayment).'],
                ['name' => 'Management',  'description' => 'Letting-agent fee, usually 10-12% of rent.'],
                ['name' => 'Maintenance', 'description' => '1% of property value per year, divided by 12.'],
                ['name' => 'Voids',       'description' => 'Allowance for empty months - default 1 month a year.'],
            ],
            'plain_summary' => 'Monthly cashflow is what actually lands in your account after every operating cost. Negative cashflow means you are subsidising the mortgage out of your salary.',
            'rule_of_thumb' => 'Aim for £150-£300 a month positive after all costs at 75% LTV.',
            'xelox_slug' => '044-btl-monthly-cashflow-the-operating-reality-of-every-buy-to-let',
        ],

        'annual_costs_total' => [
            'display_name' => 'Annual Operating Costs',
            'unit' => '£',
            'formula' => 'Mortgage + Insurance + Council Tax + Utilities + Management + Maintenance + Voids',
            'variables' => [
                ['name' => 'Management',  'description' => 'Annual Rent × management % (default 12%).'],
                ['name' => 'Maintenance', 'description' => 'Purchase Price × maintenance % (default 1%).'],
                ['name' => 'Voids',       'description' => 'Monthly Rent × void months (default 1 month a year).'],
            ],
            'plain_summary' => 'The all-in annual cost of owning and letting this property. Most new investors under-estimate it by leaving out maintenance and voids.',
            'rule_of_thumb' => 'Expect 25-35% of gross annual rent to disappear into operating costs before mortgage.',
            'xelox_slug' => '022-void-allowance-the-cost-new-landlords-always-forget',
        ],

        'roi_pct' => [
            'display_name' => 'Return on Investment (ROI)',
            'unit' => '%',
            'formula' => '(Annual Cashflow ÷ Total Cash Invested) × 100',
            'variables' => [
                ['name' => 'Annual Cashflow',    'description' => 'Monthly Cashflow × 12.'],
                ['name' => 'Total Cash Invested', 'description' => 'Deposit + SDLT + legal fees + survey + refurb.'],
            ],
            'plain_summary' => 'ROI tells you how hard the money you actually put into the deal is working. It is the number to compare across deals of different sizes.',
            'rule_of_thumb' => 'Below 6% ROI on cash, the deal is competing with bank savings - only worth it for capital growth.',
            'xelox_slug' => '048-btl-roi-return-on-investment-for-your-buy-to-let',
        ],

        'stamp_duty_computed' => [
            'display_name' => 'Stamp Duty (Additional Property)',
            'unit' => '£',
            'formula' => '5% × £0-£250k + 10% × £250k-£925k + 15% × £925k-£1.5m + 17% × £1.5m+',
            'variables' => [
                ['name' => 'Purchase Price', 'description' => 'Agreed price; SDLT bands apply progressively.'],
            ],
            'plain_summary' => 'Additional-dwelling SDLT (the 5% surcharge schedule). This applies when the property is not your main home - every BTL purchase.',
            'rule_of_thumb' => 'Roughly 5-8% of the purchase price on typical BTL stock under £500k.',
            'xelox_slug' => '036-additional-dwelling-surcharge-sdlt-when-you-buy-a-second-home-or-btl',
        ],

        'mortgage_stress_pass' => [
            'display_name' => 'Mortgage Stress Test',
            'unit' => 'bool',
            'formula' => '(Monthly Rent × Stress Rent Factor) ≥ (Monthly Mortgage × Stress Mortgage Factor)',
            'variables' => [
                ['name' => 'Stress Rent Factor',     'description' => 'Lenders assume only 75% of rent is reliable (default 0.75).'],
                ['name' => 'Stress Mortgage Factor', 'description' => 'Lenders stress the rate up by 25% (default 1.25).'],
            ],
            'plain_summary' => 'The same test a BTL lender runs before approving your mortgage. Fail this and the deal will not finance at the LTV you want.',
            'rule_of_thumb' => 'Most lenders want 125-145% rental cover at a stressed rate. If you fail, you will need a higher deposit or higher rent.',
            'xelox_slug' => '031-btl-mortgage-stress-test-will-the-lender-say-yes',
        ],
    ],

    // ─────────────────────────────────────────────────────────────────
    // HMO - House in Multiple Occupation
    // ─────────────────────────────────────────────────────────────────
    'hmo' => [
        'gross_annual_rent' => [
            'display_name' => 'HMO Gross Annual Rent',
            'unit' => '£',
            'formula' => '(Rent per Room × Rooms × 12) − (Rent per Room × Void Months × Rooms)',
            'variables' => [
                ['name' => 'Rent per Room', 'description' => 'Average monthly rent per let room.'],
                ['name' => 'Rooms',         'description' => 'Number of lettable rooms.'],
                ['name' => 'Void Months',   'description' => 'Months per year each room sits empty (default 1).'],
            ],
            'plain_summary' => 'HMO income is calculated room by room. The gross potential is every room let; the gross effective figure subtracts an allowance for the empty months you should expect.',
            'rule_of_thumb' => 'A well-located 5-bed HMO in Portsmouth gross-rents £30k-£50k a year - about 2-3× a single-let.',
            'xelox_slug' => '051-hmo-gross-potential-rent-how-much-a-house-share-could-earn',
        ],

        'operating_expenses' => [
            'display_name' => 'HMO Operating Expenses',
            'unit' => '£',
            'formula' => 'Licence Fee + Council Tax + Utilities + Insurance + (Gross Rent × Management %) + (Gross Rent × Maintenance %)',
            'variables' => [
                ['name' => 'Licence Fee',  'description' => 'Annual HMO licence cost - varies by council, default £800.'],
                ['name' => 'Management %', 'description' => 'Default 12% of gross rent.'],
                ['name' => 'Maintenance %', 'description' => 'Default 5% of gross rent - HMOs wear faster than single-lets.'],
            ],
            'plain_summary' => 'HMOs cost more to run than single-lets: bills are included, voids per room are higher, wear and tear is faster, and most councils require an annual licence.',
            'rule_of_thumb' => 'Budget 35-45% of gross rent for opex before mortgage on a fully-occupied HMO.',
            'xelox_slug' => '053-hmo-noi-net-operating-income-for-a-multi-let-property',
        ],

        'noi_annual' => [
            'display_name' => 'HMO Net Operating Income (NOI)',
            'unit' => '£',
            'formula' => 'Gross Annual Rent − Operating Expenses',
            'variables' => [
                ['name' => 'Gross Annual Rent',  'description' => 'Effective rent after void allowance.'],
                ['name' => 'Operating Expenses', 'description' => 'All costs before debt service.'],
            ],
            'plain_summary' => 'NOI is the property\'s income performance independent of how you financed it. It is what every commercial lender values the building on.',
            'xelox_slug' => '053-hmo-noi-net-operating-income-for-a-multi-let-property',
        ],

        'net_yield_pct' => [
            'display_name' => 'HMO Net Yield',
            'unit' => '%',
            'formula' => '(NOI ÷ Purchase Price) × 100',
            'variables' => [
                ['name' => 'NOI',            'description' => 'Net operating income - gross rent minus opex.'],
                ['name' => 'Purchase Price', 'description' => 'What you paid for the building.'],
            ],
            'plain_summary' => 'HMO net yield strips out the extra costs that gross yield hides. A 15% gross HMO can be a 7% net HMO once you load the real costs.',
            'rule_of_thumb' => 'A solid HMO net yield is 7-10% in the regions; below 7% the model is hard to justify versus single-let plus your time.',
            'xelox_slug' => '054-hmo-net-yield-the-real-return-on-your-multi-let-investment',
        ],

        'cash_on_cash_pct' => [
            'display_name' => 'HMO Cash-on-Cash',
            'unit' => '%',
            'formula' => '((NOI − Annual Mortgage) ÷ Total Investment) × 100',
            'variables' => [
                ['name' => 'Annual Mortgage',  'description' => 'Mortgage interest + capital paid per year.'],
                ['name' => 'Total Investment', 'description' => 'Deposit + SDLT + conversion costs + setup.'],
            ],
            'plain_summary' => 'Cash-on-cash is the percent return on the cash you actually parked in the deal - the metric that compares HMOs to any other investment of the same size.',
            'rule_of_thumb' => 'HMO cash-on-cash returns of 10-15% are normal; below 8% the extra work seldom pays off.',
            'xelox_slug' => '055-hmo-cash-on-cash-is-the-extra-work-worth-the-extra-return',
        ],
        'monthly_cashflow' => [
            'display_name' => 'HMO monthly cashflow',
            'unit' => '£',
            'formula' => '(NOI ÷ 12) − Monthly mortgage',
            'variables' => [
                ['name' => 'NOI', 'description' => 'Annual net operating income.'],
            ],
            'plain_summary' => 'What lands in your account each month after opex and mortgage.',
            'xelox_slug' => '044-btl-monthly-cashflow-the-operating-reality-of-every-buy-to-let',
        ],
        'gross_yield_pct' => [
            'display_name' => 'HMO gross yield',
            'unit' => '%',
            'formula' => '(Gross monthly rent × 12 ÷ Purchase price) × 100',
            'variables' => [
                ['name' => 'Gross monthly rent', 'description' => 'Rooms × rent per room.'],
            ],
            'plain_summary' => 'Headline yield before costs. HMO gross yields look high; always check net yield and cashflow.',
            'xelox_slug' => '051-hmo-gross-potential-rent-how-much-a-house-share-could-earn',
        ],
        'breakeven_occupancy_pct' => [
            'display_name' => 'HMO breakeven occupancy',
            'unit' => '%',
            'formula' => '((Opex + Annual mortgage) ÷ Gross potential rent) × 100',
            'variables' => [
                ['name' => 'Gross potential rent', 'description' => 'Full occupancy annual rent.'],
            ],
            'plain_summary' => 'Minimum occupancy to cover costs and debt.',
            'xelox_slug' => '062-r2r-break-even-occupancy-how-many-rooms-must-be-full-to-avoid-losing-m',
        ],
        'profit_per_room' => [
            'display_name' => 'Profit per room (annual)',
            'unit' => '£',
            'formula' => 'Annual cashflow ÷ Rooms',
            'variables' => [
                ['name' => 'Annual cashflow', 'description' => 'After mortgage.'],
            ],
            'plain_summary' => 'Whether each room earns enough to justify HMO management effort.',
            'xelox_slug' => '063-r2r-profit-per-door-the-per-room-metric-that-keeps-your-business-hones',
        ],
        'operating_cost_ratio_pct' => [
            'display_name' => 'HMO operating cost ratio',
            'unit' => '%',
            'formula' => '(Operating expenses ÷ Gross potential rent) × 100',
            'variables' => [
                ['name' => 'Operating expenses', 'description' => 'All opex before mortgage.'],
            ],
            'plain_summary' => 'Opex as a share of gross rent. Above 40% is usually tight.',
            'xelox_slug' => '064-r2r-operating-cost-ratio-keeping-costs-under-control',
        ],
    ],

    // ─────────────────────────────────────────────────────────────────
    // SDLT
    // ─────────────────────────────────────────────────────────────────
    'sdlt' => [
        'sdlt_total' => [
            'display_name' => 'Stamp Duty Land Tax',
            'unit' => '£',
            'formula_by_profile' => [
                'standard' => '0% × £0-£250k + 5% × £250k-£925k + 10% × £925k-£1.5m + 12% × £1.5m+',
                'additional_property' => '5% × £0-£250k + 10% × £250k-£925k + 15% × £925k-£1.5m + 17% × £1.5m+',
                'first_time_buyer' => '0% × £0-£425k + 5% × £425k-£625k (above £625k: standard rates)',
            ],
            'variables' => [
                ['name' => 'Purchase Price', 'description' => 'Agreed price; SDLT is calculated band by band, not on the whole price.'],
                ['name' => 'Profile',        'description' => 'Standard (main home), additional property (BTL / second home), or first-time buyer.'],
            ],
            'plain_summary' => 'SDLT is progressive - you pay a different rate on each band of the price, like income tax. The rate on the first pound is not the rate on the last.',
            'rule_of_thumb' => 'SDLT is paid in cash on completion. It is not added to your mortgage. Have it ready.',
            'xelox_slug' => '035-standard-residential-sdlt-how-stamp-duty-works-for-your-main-home',
        ],

        'effective_rate_pct' => [
            'display_name' => 'Effective SDLT Rate',
            'unit' => '%',
            'formula' => '(SDLT Total ÷ Purchase Price) × 100',
            'variables' => [
                ['name' => 'SDLT Total',     'description' => 'The cash amount of stamp duty you actually pay.'],
                ['name' => 'Purchase Price', 'description' => 'Agreed price.'],
            ],
            'plain_summary' => 'The single percentage that tells you what proportion of the purchase price you pay in SDLT - useful for budgeting and for comparing properties at different price points.',
            'xelox_slug' => '041-effective-sdlt-rate-the-true-percentage-you-pay-on-your-purchase',
        ],
    ],

    // ─────────────────────────────────────────────────────────────────
    // BRR - Buy, Refurbish, Refinance
    // ─────────────────────────────────────────────────────────────────
    'brr' => [
        'total_cost' => [
            'display_name' => 'BRR Total Cost',
            'unit' => '£',
            'formula' => 'Purchase Price + SDLT + Legal + Survey + Refurb + Finance Costs + Contingency',
            'variables' => [
                ['name' => 'Purchase Price', 'description' => 'Agreed price.'],
                ['name' => 'SDLT',           'description' => 'Stamp duty (additional property surcharge applies).'],
                ['name' => 'Legal',          'description' => 'Conveyancing fees - default £1,500.'],
                ['name' => 'Survey',         'description' => 'Building survey - default £500.'],
                ['name' => 'Refurb',         'description' => 'Quoted refurb cost.'],
                ['name' => 'Finance Costs',  'description' => 'Bridging interest + arrangement fees during the works.'],
                ['name' => 'Contingency',    'description' => 'Refurb × 10% safety buffer.'],
            ],
            'plain_summary' => 'The all-in number you spend before you can refinance - everything from the purchase price to the legal fees to the contingency. If this exceeds the after-refurb value (ARV), the BRR is dead.',
            'rule_of_thumb' => 'New investors forget bridging interest and contingency. They eat 5-10% of the deal.',
            'xelox_slug' => '074-brr-total-cost-what-you-actually-spend-before-refinancing',
        ],

        'refinance_gross' => [
            'display_name' => 'Refinance Proceeds',
            'unit' => '£',
            'formula' => 'After-Refurb Value × Refinance LTV',
            'variables' => [
                ['name' => 'After-Refurb Value', 'description' => 'The post-works valuation a surveyor will sign off on.'],
                ['name' => 'Refinance LTV',      'description' => 'The percentage a BTL lender will lend (default 75%).'],
            ],
            'plain_summary' => 'The cash the bank gives you on refinance. This is what pays back the bridge and (hopefully) returns your deposit.',
            'xelox_slug' => '076-brr-refinance-proceeds-how-much-the-bank-will-give-you-after-refurb',
        ],

        'cash_left_in' => [
            'display_name' => 'Cash Left In',
            'unit' => '£',
            'formula' => 'max(0, Total Cost − Refinance Proceeds)',
            'variables' => [
                ['name' => 'Total Cost',          'description' => 'The all-in number above.'],
                ['name' => 'Refinance Proceeds', 'description' => 'What the bank gives you.'],
            ],
            'plain_summary' => 'What is still tied up in the deal after refinance. The whole point of BRR is to drive this towards zero so you can buy the next one.',
            'rule_of_thumb' => 'A "perfect" BRR recycles 100% of your cash. £5k-£15k left in is a normal real-world outcome.',
            'xelox_slug' => '077-brr-cash-left-in-how-much-of-your-own-money-is-still-stuck-in-the-deal',
        ],

        'capital_recycled_pct' => [
            'display_name' => 'Capital Recycled',
            'unit' => '%',
            'formula' => 'min(100, (Refinance Proceeds ÷ Total Cost) × 100)',
            'variables' => [
                ['name' => 'Refinance Proceeds', 'description' => 'What the bank releases on refinance.'],
                ['name' => 'Total Cost',         'description' => 'All-in spend before refinance.'],
            ],
            'plain_summary' => 'The percentage of your money you pulled back out. 100% is a "no money left in" deal.',
            'xelox_slug' => '079-brr-capital-recycled-what-percentage-of-your-investment-did-you-get-ba',
        ],

        'equity_created' => [
            'display_name' => 'Equity Created',
            'unit' => '£',
            'formula' => 'After-Refurb Value − Refinance Proceeds',
            'variables' => [
                ['name' => 'After-Refurb Value', 'description' => 'Post-works valuation.'],
                ['name' => 'Refinance Proceeds', 'description' => 'What you remortgaged the property for.'],
            ],
            'plain_summary' => 'The equity the bank leaves with you after refinance - the part of the new valuation you still own outright.',
            'xelox_slug' => '080-brr-equity-created-how-much-value-you-built-through-the-refurb',
        ],

        'final_ltv_pct' => [
            'display_name' => 'Final LTV',
            'unit' => '%',
            'formula' => '(Refinance Proceeds ÷ After-Refurb Value) × 100',
            'variables' => [
                ['name' => 'Refinance Proceeds', 'description' => 'New mortgage balance after refinance.'],
                ['name' => 'After-Refurb Value', 'description' => 'Post-works valuation.'],
            ],
            'plain_summary' => 'Your loan-to-value after the refinance - the single most important number to your lender.',
            'rule_of_thumb' => 'Most BTL lenders cap refinance LTV at 75%. Some specialist lenders go to 80%.',
            'xelox_slug' => '029-loan-to-value-the-single-most-important-number-in-property-finance',
        ],
    ],

    // ─────────────────────────────────────────────────────────────────
    // SA - Serviced Accommodation
    // ─────────────────────────────────────────────────────────────────
    'sa' => [
        'monthly_revenue' => [
            'display_name' => 'SA Monthly Revenue',
            'unit' => '£',
            'formula' => 'Nightly Rate × Occupancy % × 30.4 × Room Count',
            'variables' => [
                ['name' => 'Nightly Rate', 'description' => 'Average nightly rate (ADR).'],
                ['name' => 'Occupancy %',  'description' => 'The fraction of nights you expect to be booked.'],
                ['name' => 'Room Count',   'description' => 'Number of bookable units (default 1).'],
            ],
            'plain_summary' => 'SA is a hospitality business - income is nights × rate, not monthly rent. 30.4 is the average days per month over a year.',
            'xelox_slug' => '065-sa-monthly-revenue-breaking-down-your-serviced-accommodation-income',
        ],

        'annual_revenue' => [
            'display_name' => 'SA Annual Revenue',
            'unit' => '£',
            'formula' => 'Nightly Rate × Occupancy % × 365 × Room Count',
            'variables' => [
                ['name' => 'Nightly Rate', 'description' => 'Average nightly rate (ADR).'],
                ['name' => 'Occupancy %',  'description' => 'Annual occupancy expectation.'],
                ['name' => 'Room Count',   'description' => 'Bookable units.'],
            ],
            'plain_summary' => 'Annualised revenue projection. A well-run SA delivers 2-3× the gross rent of the same property as a BTL - but with proportionally higher costs.',
            'rule_of_thumb' => 'Portsmouth SAs range £20k-£50k revenue depending on location, size and quality.',
            'xelox_slug' => '064-sa-annual-revenue-projecting-income-for-your-serviced-accommodation',
        ],

        'operating_costs' => [
            'display_name' => 'SA Operating Costs',
            'unit' => '£',
            'formula' => '(Revenue × Cleaning %) + (Revenue × Management %) + (Revenue × Platform %) + (Utilities × 12) + (Other × 12)',
            'variables' => [
                ['name' => 'Cleaning %',  'description' => 'Cleaner cost as % of revenue (default 25%).'],
                ['name' => 'Management %', 'description' => 'SA management agency fee (default 15%).'],
                ['name' => 'Platform %',  'description' => 'Airbnb / Booking.com commission (default 10%).'],
                ['name' => 'Utilities',   'description' => 'Monthly utilities - landlord pays in SA.'],
            ],
            'plain_summary' => 'SA opex is fundamentally different from BTL: cleaning, platform fees, and bills are all on you. The gross-to-net gap is much larger.',
            'rule_of_thumb' => 'Budget 50-60% of revenue for opex before mortgage on a managed SA.',
            'xelox_slug' => '073-sa-cleaning-cost-per-stay-the-hidden-cost-that-eats-your-margin',
        ],

        'annual_noi' => [
            'display_name' => 'SA Net Operating Income',
            'unit' => '£',
            'formula' => 'Annual Revenue − Operating Costs',
            'variables' => [
                ['name' => 'Annual Revenue',  'description' => 'Projected gross income.'],
                ['name' => 'Operating Costs', 'description' => 'All opex before debt service.'],
            ],
            'plain_summary' => 'The true performance of the SA business - what it earns before financing. Always compare NOI, never revenue.',
            'xelox_slug' => '069-sa-annual-noi-your-serviced-accommodation-s-true-operating-income',
        ],

        'revpar_daily' => [
            'display_name' => 'RevPAR (Revenue per Available Room-Night)',
            'unit' => '£',
            'formula' => 'Annual Revenue ÷ Rooms ÷ 365',
            'variables' => [
                ['name' => 'Annual Revenue', 'description' => 'Projected revenue.'],
                ['name' => 'Rooms',          'description' => 'Bookable units.'],
                ['name' => '365',            'description' => 'Total available room-nights per year per unit.'],
            ],
            'plain_summary' => 'The hospitality-industry metric that blends rate and occupancy into a single number. The cleanest way to compare two SA properties.',
            'xelox_slug' => '067-revpar-revenue-per-available-room-night-the-hotel-industry-standard-fo',
        ],
        'monthly_cashflow' => [
            'display_name' => 'SA monthly cashflow',
            'unit' => '£',
            'formula' => '(NOI ÷ 12) − Monthly mortgage',
            'variables' => [
                ['name' => 'NOI', 'description' => 'Annual net operating income.'],
            ],
            'plain_summary' => 'Monthly profit after all SA costs and mortgage.',
            'xelox_slug' => '044-btl-monthly-cashflow-the-operating-reality-of-every-buy-to-let',
        ],
        'net_margin_pct' => [
            'display_name' => 'SA net margin',
            'unit' => '%',
            'formula' => '(NOI ÷ Annual revenue) × 100',
            'variables' => [
                ['name' => 'NOI', 'description' => 'After operating costs.'],
            ],
            'plain_summary' => 'Share of revenue that becomes NOI before debt.',
            'xelox_slug' => '063-r2r-net-margin-profit-as-a-percentage-of-income',
        ],
        'operating_cost_ratio_pct' => [
            'display_name' => 'SA operating cost ratio',
            'unit' => '%',
            'formula' => '(Operating costs ÷ Annual revenue) × 100',
            'variables' => [
                ['name' => 'Operating costs', 'description' => 'Cleaning, platform, utilities, etc.'],
            ],
            'plain_summary' => 'How much of each pound of revenue goes to running the business.',
            'xelox_slug' => '064-r2r-operating-cost-ratio-keeping-costs-under-control',
        ],
    ],

    // ─────────────────────────────────────────────────────────────────
    // R2R - Rent-to-Rent
    // ─────────────────────────────────────────────────────────────────
    'r2r' => [
        'annual_gross_income' => [
            'display_name' => 'Annual gross income',
            'unit' => '£',
            'formula' => 'Subtenant rent × 12 (or rooms × rent per room × 12)',
            'variables' => [
                ['name' => 'Subtenant rent', 'description' => 'Total rent from all rooms or units each month.'],
                ['name' => 'Lettable rooms', 'description' => 'Number of income-producing rooms or units.'],
            ],
            'plain_summary' => 'Total rent you expect to collect in a full year before voids and costs.',
            'xelox_slug' => '060-r2r-gross-margin-the-spread-before-operating-costs',
        ],
        'rent_difference_monthly' => [
            'display_name' => 'Gross rent margin (monthly)',
            'unit' => '£',
            'formula' => 'Subtenant rent − Head rent',
            'variables' => [
                ['name' => 'Subtenant rent', 'description' => 'Total rent collected from tenants or guests each month.'],
                ['name' => 'Head rent', 'description' => 'Rent you pay the property owner under the management / R2R agreement.'],
            ],
            'plain_summary' => 'The spread before operating costs. If this is negative, the deal cannot work without renegotiating the head lease.',
            'xelox_slug' => '060-r2r-gross-margin-the-spread-before-operating-costs',
        ],
        'gross_margin_pct' => [
            'display_name' => 'Gross margin %',
            'unit' => '%',
            'formula' => '(Gross margin ÷ Subtenant rent) × 100',
            'variables' => [
                ['name' => 'Gross margin', 'description' => 'Subtenant rent minus head rent, monthly.'],
                ['name' => 'Subtenant rent', 'description' => 'Gross rent collected monthly.'],
            ],
            'plain_summary' => 'How much of each pound of rent is margin before you pay bills. A healthy HMO R2R often shows 25% to 40% here.',
            'xelox_slug' => '060-r2r-gross-margin-the-spread-before-operating-costs',
        ],
        'monthly_operating_costs' => [
            'display_name' => 'Monthly operating costs',
            'unit' => '£',
            'formula' => 'Management + Utilities + Council tax + Insurance + Maintenance + Cleaning + Compliance',
            'variables' => [
                ['name' => 'Management', 'description' => 'Agent fee or self-managed allowance.'],
                ['name' => 'Utilities', 'description' => 'Gas, electric, water where operator pays.'],
                ['name' => 'Council tax', 'description' => 'Often paid by the R2R operator on whole-property deals.'],
            ],
            'plain_summary' => 'Every monthly cost to run the property before profit. Keep the operating cost ratio under 30% of gross rent where possible.',
            'xelox_slug' => '061-r2r-monthly-profit-the-operating-bottom-line',
        ],
        'monthly_profit' => [
            'display_name' => 'Net monthly profit',
            'unit' => '£',
            'formula' => 'Gross margin − Operating costs',
            'variables' => [
                ['name' => 'Gross margin', 'description' => 'Subtenant rent minus head rent.'],
                ['name' => 'Operating costs', 'description' => 'Management, utilities, council tax, insurance, maintenance, cleaning, compliance.'],
            ],
            'plain_summary' => 'What is left each month after you pay the landlord and run the property. This is the number that must stay positive.',
            'xelox_slug' => '061-r2r-monthly-profit-the-operating-bottom-line',
        ],
        'annual_profit' => [
            'display_name' => 'Annual net profit',
            'unit' => '£',
            'formula' => '(Monthly profit × 12) − (Gross margin × Void months)',
            'variables' => [
                ['name' => 'Monthly profit', 'description' => 'Net profit in a full month.'],
                ['name' => 'Void months', 'description' => 'Allowance for empty rooms or gaps between tenants.'],
            ],
            'plain_summary' => 'Annualised profit after a void haircut on the gross margin. Use this for comparisons and setup capital return.',
            'xelox_slug' => '062-r2r-annual-profit-the-year-one-outcome',
        ],
        'net_margin_pct' => [
            'display_name' => 'Net margin',
            'unit' => '%',
            'formula' => '(Annual profit ÷ Annual gross income) × 100',
            'variables' => [
                ['name' => 'Annual profit', 'description' => 'Net profit after void allowance.'],
                ['name' => 'Annual gross income', 'description' => 'Subtenant rent × 12.'],
            ],
            'plain_summary' => 'How much of every pound of rent becomes profit after all costs and voids. Experienced operators often target 20%+ on stable HMO R2R.',
            'xelox_slug' => '063-r2r-net-margin-profit-as-a-percentage-of-income',
        ],
        'operating_cost_ratio_pct' => [
            'display_name' => 'Operating cost ratio',
            'unit' => '%',
            'formula' => '(Monthly operating costs ÷ Subtenant rent) × 100',
            'variables' => [
                ['name' => 'Operating costs', 'description' => 'Sum of all monthly running costs.'],
                ['name' => 'Subtenant rent', 'description' => 'Gross rent collected monthly.'],
            ],
            'plain_summary' => 'Operating costs as a share of gross rent. Above 35% usually means the deal is tight.',
            'xelox_slug' => '064-r2r-operating-cost-ratio-keeping-costs-under-control',
        ],
        'breakeven_occupancy_pct' => [
            'display_name' => 'Breakeven occupancy',
            'unit' => '%',
            'formula' => '((Head rent + Operating costs) ÷ Subtenant rent) × 100',
            'variables' => [
                ['name' => 'Head rent', 'description' => 'Monthly payment to the landlord.'],
                ['name' => 'Operating costs', 'description' => 'Monthly running costs.'],
                ['name' => 'Subtenant rent', 'description' => 'Gross rent at full occupancy.'],
            ],
            'plain_summary' => 'Minimum occupancy needed to cover head rent and running costs. Leave headroom below 100% for voids and churn.',
            'xelox_slug' => '062-r2r-break-even-occupancy-how-many-rooms-must-be-full-to-avoid-losing-m',
        ],
        'profit_per_door' => [
            'display_name' => 'Profit per door (annual)',
            'unit' => '£',
            'formula' => 'Annual profit ÷ Lettable rooms',
            'variables' => [
                ['name' => 'Annual profit', 'description' => 'Net profit after void allowance.'],
                ['name' => 'Lettable rooms', 'description' => 'Income-producing rooms or units.'],
            ],
            'plain_summary' => 'Whether each room earns enough to justify setup and management effort. Under £100/month per door is often marginal.',
            'xelox_slug' => '063-r2r-profit-per-door-the-per-room-metric-that-keeps-your-business-hones',
        ],
        'setup_costs_total' => [
            'display_name' => 'Setup capital',
            'unit' => '£',
            'formula' => 'Deposit + Furnishing + Licence + Legal + Other',
            'variables' => [
                ['name' => 'Landlord deposit', 'description' => 'Typically 4 to 8 weeks head rent.'],
                ['name' => 'Furnishing', 'description' => 'HMO or SA fit-out to licensing standard.'],
            ],
            'plain_summary' => 'Cash you put in before the first profitable month. Recovery time should ideally be under six months.',
            'xelox_slug' => '062-r2r-annual-profit-the-year-one-outcome',
        ],
        'return_on_setup_capital_pct' => [
            'display_name' => 'Return on setup capital',
            'unit' => '%',
            'formula' => '(Annual profit ÷ Setup capital) × 100',
            'variables' => [
                ['name' => 'Annual profit', 'description' => 'Year-one net profit after voids.'],
                ['name' => 'Setup capital', 'description' => 'Total upfront cash invested.'],
            ],
            'plain_summary' => 'How hard your setup cash works in year one. R2R can beat BTL cash-on-cash because leverage is on the lease, not a mortgage.',
            'xelox_slug' => '062-r2r-annual-profit-the-year-one-outcome',
        ],
        'setup_recovery_months' => [
            'display_name' => 'Setup recovery (months)',
            'unit' => 'months',
            'formula' => 'Setup capital ÷ Monthly profit',
            'variables' => [
                ['name' => 'Setup capital', 'description' => 'Total upfront investment.'],
                ['name' => 'Monthly profit', 'description' => 'Steady-state net profit per month.'],
            ],
            'plain_summary' => 'How many months of profit it takes to earn back your setup cash. Under six months is strong; over twelve is slow.',
            'xelox_slug' => '062-r2r-annual-profit-the-year-one-outcome',
        ],
        'ten_percent_rule_pass' => [
            'display_name' => '10% rule',
            'unit' => '',
            'formula' => 'Subtenant rent ≥ Head rent × (1 + 10%)',
            'variables' => [
                ['name' => 'Subtenant rent', 'description' => 'Gross monthly income.'],
                ['name' => 'Head rent', 'description' => 'Monthly lease cost.'],
            ],
            'plain_summary' => 'Quick screen: gross rent must clear head rent by at least 10% before costs.',
            'xelox_slug' => '060-r2r-gross-margin-the-spread-before-operating-costs',
        ],
        'minimum_income_rule_pass' => [
            'display_name' => 'Minimum margin rule',
            'unit' => '',
            'formula' => 'Gross margin ≥ Head rent × Minimum margin %',
            'variables' => [
                ['name' => 'Gross margin', 'description' => 'Subtenant rent minus head rent.'],
                ['name' => 'Head rent', 'description' => 'Monthly payment to landlord.'],
            ],
            'plain_summary' => 'Gross margin on head rent must meet your platform minimum (configurable). Filters deals that look full but have no real spread.',
            'xelox_slug' => '060-r2r-gross-margin-the-spread-before-operating-costs',
        ],
    ],

    'flip' => [
        'total_cost' => [
            'display_name' => 'Flip total cost',
            'unit' => '£',
            'formula' => 'Purchase + SDLT + legal + survey + refurb + finance + marketing + holding',
            'variables' => [
                ['name' => 'Purchase', 'description' => 'Agreed purchase price.'],
                ['name' => 'Refurb', 'description' => 'Works budget.'],
            ],
            'plain_summary' => 'All cash tied up before sale. If total cost exceeds what you can sell for after selling costs, the flip loses money.',
            'xelox_slug' => '085-flip-total-cost-what-you-spend-before-you-sell',
        ],
        'net_profit' => [
            'display_name' => 'Flip net profit',
            'unit' => '£',
            'formula' => 'Selling price − Total cost − Selling costs',
            'variables' => [
                ['name' => 'Selling price', 'description' => 'Expected sale price after works.'],
            ],
            'plain_summary' => 'What is left after every cost. Active flippers often pay tax as trading income, not CGT.',
            'xelox_slug' => '089-flip-net-profit-the-bottom-line-on-a-refurb-and-sell',
        ],
        'roi_pct' => [
            'display_name' => 'Flip ROI',
            'unit' => '%',
            'formula' => '(Net profit ÷ Total cost) × 100',
            'variables' => [
                ['name' => 'Net profit', 'description' => 'Profit after all costs.'],
                ['name' => 'Total cost', 'description' => 'Cash invested in the deal.'],
            ],
            'plain_summary' => 'Return on the cash you had in the deal for the hold period.',
            'xelox_slug' => '090-flip-roi-return-on-the-cash-you-tied-up',
        ],
    ],

    'bmv_no_money_down' => [
        'discount_pct' => [
            'display_name' => 'Discount from market',
            'unit' => '%',
            'formula' => '(Market value − Purchase price) ÷ Market value × 100',
            'variables' => [
                ['name' => 'Market value', 'description' => 'RICS or comparable value.'],
                ['name' => 'Purchase price', 'description' => 'Agreed BMV price.'],
            ],
            'plain_summary' => 'How far below market you are buying. Same-day remortgage models often need 30%+ to recycle all cash.',
            'xelox_slug' => '092-bmv-discount-how-far-below-market-you-are-buying',
        ],
        'remortgage_amount' => [
            'display_name' => 'Remortgage proceeds',
            'unit' => '£',
            'formula' => 'Market value × LTV',
            'variables' => [
                ['name' => 'Market value', 'description' => 'Valuation at refinance.'],
                ['name' => 'LTV', 'description' => 'Lender loan to value (often 75%).'],
            ],
            'plain_summary' => 'Cash released on the day-one remortgage against market value, not purchase price.',
            'xelox_slug' => '094-bmv-remortgage-proceeds-cash-back-on-refinance',
        ],
        'net_cash_position' => [
            'display_name' => 'Net cash position',
            'unit' => '£',
            'formula' => 'Remortgage − Purchase − Bridging fee − Legal − Valuation − SDLT',
            'variables' => [
                ['name' => 'Remortgage', 'description' => 'Gross loan advance.'],
            ],
            'plain_summary' => 'Positive means you take cash out or leave none in. Negative is how much you still need to fund.',
            'xelox_slug' => '095-bmv-net-cash-position-did-you-achieve-no-money-down',
        ],
        'breakeven_discount_pct' => [
            'display_name' => 'Breakeven discount',
            'unit' => '%',
            'formula' => 'Minimum discount so remortgage covers all costs',
            'variables' => [
                ['name' => 'Market value', 'description' => 'Valuation used for LTV.'],
            ],
            'plain_summary' => 'The discount you need from market to hit true no money down at your LTV and fee assumptions.',
            'xelox_slug' => '097-bmv-breakeven-discount-the-minimum-bmv-to-recycle-all-cash',
        ],
    ],

    'commercial' => [
        'gross_yield_pct' => [
            'display_name' => 'Commercial gross yield',
            'unit' => '%',
            'formula' => '(Passing rent ÷ Purchase price) × 100',
            'variables' => [
                ['name' => 'Passing rent', 'description' => 'Current rent roll.'],
                ['name' => 'Purchase price', 'description' => 'Price paid or offered.'],
            ],
            'plain_summary' => 'Headline yield on passing rent before costs. Always pair with net initial yield.',
            'xelox_slug' => '111-commercial-gross-yield-the-headline-number-on-a-commercial-deal',
        ],
        'net_initial_yield_pct' => [
            'display_name' => 'Net initial yield (NIY)',
            'unit' => '%',
            'formula' => '((Passing rent − Operating costs) ÷ Purchase price) × 100',
            'variables' => [
                ['name' => 'Passing rent', 'description' => 'In-place rent.'],
                ['name' => 'Operating costs', 'description' => 'Service charge, void, management, insurance, maintenance.'],
            ],
            'plain_summary' => 'What the asset earns today after opex, before finance. The standard commercial comparison metric.',
            'xelox_slug' => '112-commercial-net-initial-yield-niy-the-real-yield-on-passing-rent',
        ],
        'reversionary_yield_pct' => [
            'display_name' => 'Reversionary yield',
            'unit' => '%',
            'formula' => '((ERV − Operating costs) ÷ Purchase price) × 100',
            'variables' => [
                ['name' => 'ERV', 'description' => 'Estimated rental value at full market rent.'],
            ],
            'plain_summary' => 'Yield if all income moved to ERV. Shows upside when leases are below market.',
            'xelox_slug' => '113-commercial-reversionary-yield-the-upside-when-rent-rolls-forward',
        ],
        'net_annual_income' => [
            'display_name' => 'Net annual income',
            'unit' => '£',
            'formula' => 'Passing rent − Operating costs − Mortgage',
            'variables' => [
                ['name' => 'Passing rent', 'description' => 'Annual rent roll.'],
            ],
            'plain_summary' => 'Cash the asset generates after costs and debt service.',
            'xelox_slug' => '114-commercial-net-income-after-costs-and-finance',
        ],
    ],

    'development' => [
        'gdv_total' => [
            'display_name' => 'Gross development value (GDV)',
            'unit' => '£',
            'formula' => 'Unit values × unit count',
            'variables' => [
                ['name' => 'Units', 'description' => 'Homes or flats created.'],
            ],
            'plain_summary' => 'Total sales value on exit. Every development model starts here.',
            'xelox_slug' => '098-development-gdv-gross-development-value',
        ],
        'gross_dev_costs' => [
            'display_name' => 'Gross development costs',
            'unit' => '£',
            'formula' => 'Land + build + professional fees + contingency',
            'variables' => [
                ['name' => 'Build', 'description' => 'Construction and fit-out.'],
            ],
            'plain_summary' => 'Direct costs to deliver the scheme before finance interest.',
            'xelox_slug' => '099-development-gdc-gross-development-costs',
        ],
        'equity_required' => [
            'display_name' => 'Equity required',
            'unit' => '£',
            'formula' => 'Total project cost − Development loan',
            'variables' => [
                ['name' => 'Development loan', 'description' => 'Senior debt drawn on LTC/LTV caps.'],
            ],
            'plain_summary' => 'Your cash in the deal before profit.',
            'xelox_slug' => '100-development-equity-how-much-cash-you-must-put-in',
        ],
        'sell_profit' => [
            'display_name' => 'Development profit (sell)',
            'unit' => '£',
            'formula' => 'GDV − Total project cost − Exit costs',
            'variables' => [
                ['name' => 'GDV', 'description' => 'Gross development value.'],
            ],
            'plain_summary' => 'Profit if you sell all units on completion.',
            'xelox_slug' => '101-development-profit-on-a-sell-exit',
        ],
        'sell_margin_pct' => [
            'display_name' => 'Development margin',
            'unit' => '%',
            'formula' => '(Profit ÷ GDV) × 100',
            'variables' => [
                ['name' => 'Profit', 'description' => 'Sell exit profit.'],
                ['name' => 'GDV', 'description' => 'Gross development value.'],
            ],
            'plain_summary' => 'Profit as a share of GDV. Lenders often want 20%+ on small schemes.',
            'xelox_slug' => '102-development-margin-profit-as-a-percentage-of-gdv',
        ],
        'is_viable' => [
            'display_name' => 'Development viability',
            'unit' => '',
            'formula' => 'Margin and profit vs platform hurdles',
            'variables' => [
                ['name' => 'Margin', 'description' => 'Sell margin %.'],
            ],
            'plain_summary' => 'Whether the scheme clears minimum profit and margin rules.',
            'xelox_slug' => '102-development-margin-profit-as-a-percentage-of-gdv',
        ],
    ],

    'dscr' => [
        'dscr' => [
            'display_name' => 'Debt service coverage ratio',
            'unit' => 'x',
            'formula' => 'Annual NOI ÷ Annual debt service',
            'variables' => [
                ['name' => 'NOI', 'description' => 'Net operating income.'],
                ['name' => 'Debt service', 'description' => 'Mortgage principal and interest per year.'],
            ],
            'plain_summary' => 'How many times income covers the mortgage. Commercial lenders often want 1.25x or more.',
            'xelox_slug' => '115-dscr-debt-service-coverage-how-lenders-stress-your-deal',
        ],
        'passes_1_25x' => [
            'display_name' => '1.25x DSCR pass',
            'unit' => '',
            'formula' => 'DSCR ≥ 1.25',
            'variables' => [
                ['name' => 'DSCR', 'description' => 'Coverage ratio.'],
            ],
            'plain_summary' => 'Illustrative pass against a common lender hurdle.',
            'xelox_slug' => '115-dscr-debt-service-coverage-how-lenders-stress-your-deal',
        ],
    ],

    'bridging' => [
        'interest_cost' => [
            'display_name' => 'Bridging interest',
            'unit' => '£',
            'formula' => 'Loan × annual rate × (months ÷ 12)',
            'variables' => [
                ['name' => 'Loan', 'description' => 'Gross loan amount.'],
            ],
            'plain_summary' => 'Interest over the bridge term. Rolled interest is not compounded in this model.',
            'xelox_slug' => '116-bridging-interest-cost',
        ],
        'total_financing_cost' => [
            'display_name' => 'Total bridging cost',
            'unit' => '£',
            'formula' => 'Interest + arrangement + exit + broker',
            'variables' => [
                ['name' => 'Fees', 'description' => 'Arrangement and exit fees.'],
            ],
            'plain_summary' => 'All-in cost of the bridge before you repay principal.',
            'xelox_slug' => '117-bridging-total-cost-interest-plus-fees',
        ],
        'cost_as_pct_of_loan' => [
            'display_name' => 'Cost as % of loan',
            'unit' => '%',
            'formula' => '(Total cost ÷ Loan) × 100',
            'variables' => [
                ['name' => 'Total cost', 'description' => 'Interest and fees.'],
            ],
            'plain_summary' => 'Quick comparison across lenders and terms.',
            'xelox_slug' => '117-bridging-total-cost-interest-plus-fees',
        ],
    ],

    'mortgage' => [
        'monthly_payment' => [
            'display_name' => 'Monthly mortgage payment',
            'unit' => '£',
            'formula' => 'Amortisation or interest-only formula',
            'variables' => [
                ['name' => 'Loan', 'description' => 'Principal.'],
                ['name' => 'Rate', 'description' => 'Annual interest rate.'],
            ],
            'plain_summary' => 'What you pay the lender each month.',
            'xelox_slug' => '118-mortgage-monthly-payment',
        ],
        'total_interest_paid' => [
            'display_name' => 'Total interest paid',
            'unit' => '£',
            'formula' => 'Total paid − Principal (repayment) or interest × months (IO)',
            'variables' => [
                ['name' => 'Term', 'description' => 'Years on the loan.'],
            ],
            'plain_summary' => 'Lifetime interest cost of the loan.',
            'xelox_slug' => '119-mortgage-total-interest-over-the-term',
        ],
    ],

    'ltv' => [
        'ltv_pct' => [
            'display_name' => 'Loan to value',
            'unit' => '%',
            'formula' => '(Loan ÷ Property value) × 100',
            'variables' => [
                ['name' => 'Loan', 'description' => 'Mortgage balance.'],
                ['name' => 'Value', 'description' => 'Current or purchase value.'],
            ],
            'plain_summary' => 'How leveraged the property is.',
            'xelox_slug' => '029-loan-to-value-the-single-most-important-number-in-property-finance',
        ],
        'equity_amount' => [
            'display_name' => 'Equity in property',
            'unit' => '£',
            'formula' => 'Property value − Loan',
            'variables' => [
                ['name' => 'Value', 'description' => 'Property value.'],
            ],
            'plain_summary' => 'Your share of value before selling costs.',
            'xelox_slug' => '029-loan-to-value-the-single-most-important-number-in-property-finance',
        ],
    ],

    'breakeven_occupancy' => [
        'breakeven_occupancy_pct' => [
            'display_name' => 'Breakeven occupancy',
            'unit' => '%',
            'formula' => '(Opex + Debt service) ÷ Gross potential income × 100',
            'variables' => [
                ['name' => 'Opex', 'description' => 'Annual operating expenses.'],
                ['name' => 'Debt service', 'description' => 'Annual mortgage.'],
            ],
            'plain_summary' => 'Minimum occupancy to cover all costs. Compare to your forecast occupancy.',
            'xelox_slug' => '062-r2r-break-even-occupancy-how-many-rooms-must-be-full-to-avoid-losing-m',
        ],
    ],

    'coc_roe' => [
        'coc_pct' => [
            'display_name' => 'Cash-on-cash return',
            'unit' => '%',
            'formula' => '(Annual cash flow ÷ Cash invested) × 100',
            'variables' => [
                ['name' => 'Cash flow', 'description' => 'Pre-tax annual cash flow.'],
            ],
            'plain_summary' => 'Return on the cash you put in.',
            'xelox_slug' => '055-cash-on-cash-return-how-hard-your-deposit-is-working',
        ],
        'roe_pct' => [
            'display_name' => 'Return on equity',
            'unit' => '%',
            'formula' => '(Net income ÷ Current equity) × 100',
            'variables' => [
                ['name' => 'Equity', 'description' => 'Current equity in the asset.'],
            ],
            'plain_summary' => 'Return on your equity stake after appreciation or paydown.',
            'xelox_slug' => '056-return-on-equity-roe',
        ],
    ],

    'income_multiples' => [
        'noi_annual' => [
            'display_name' => 'Net operating income',
            'unit' => '£',
            'formula' => 'Gross rent − Operating expenses',
            'variables' => [
                ['name' => 'Gross rent', 'description' => 'Annual rent.'],
            ],
            'plain_summary' => 'Income before debt.',
            'xelox_slug' => '053-hmo-noi-net-operating-income-for-a-multi-let-property',
        ],
        'cap_rate_pct' => [
            'display_name' => 'Cap rate',
            'unit' => '%',
            'formula' => '(NOI ÷ Price) × 100',
            'variables' => [
                ['name' => 'NOI', 'description' => 'Net operating income.'],
            ],
            'plain_summary' => 'Commercial-style yield on NOI.',
            'xelox_slug' => '125-cap-rate-capitalisation-rate',
        ],
        'grm' => [
            'display_name' => 'Gross rent multiplier',
            'unit' => 'x',
            'formula' => 'Price ÷ Annual gross rent',
            'variables' => [
                ['name' => 'Price', 'description' => 'Purchase price.'],
            ],
            'plain_summary' => 'How many years of gross rent equal the price. Lower can mean better value if opex is stable.',
            'xelox_slug' => '126-gross-rent-multiplier-grm',
        ],
    ],

    'strategy_finder' => [
        'top_strategy' => [
            'display_name' => 'Best fit strategy',
            'unit' => '',
            'formula' => 'Highest total score across capital, goal, time, risk, and skills',
            'variables' => [
                ['name' => 'Scores', 'description' => 'Weighted matrix for seven UK strategies.'],
            ],
            'plain_summary' => 'The strategy that best matches your profile today. Run the dedicated calculator next to model real numbers.',
            'xelox_slug' => '124-strategy-finder-matching-your-profile-to-a-deal-strategy',
        ],
        'top_strategy_score' => [
            'display_name' => 'Match score',
            'unit' => '/100',
            'formula' => 'Capital + Goal + Time + Risk + Skills',
            'variables' => [
                ['name' => 'Each dimension', 'description' => 'Up to 25 points per strategy per question.'],
            ],
            'plain_summary' => 'Higher is a stronger fit. Compare top three scores, not just the winner.',
            'xelox_slug' => '124-strategy-finder-matching-your-profile-to-a-deal-strategy',
        ],
        'typical_monthly_income' => [
            'display_name' => 'Typical monthly income',
            'unit' => '£',
            'formula' => 'Illustrative projection for your capital band',
            'variables' => [
                ['name' => 'Strategy', 'description' => 'Top matched strategy.'],
            ],
            'plain_summary' => 'Template income for your capital bracket; plug real deals into the strategy calculator.',
            'xelox_slug' => '124-strategy-finder-matching-your-profile-to-a-deal-strategy',
        ],
        'typical_setup_capital' => [
            'display_name' => 'Typical entry capital',
            'unit' => '£',
            'formula' => 'Deposit or setup from platform templates',
            'variables' => [
                ['name' => 'Capital band', 'description' => 'Your selected bracket.'],
            ],
            'plain_summary' => 'Cash you typically need to start or enter the strategy at your level.',
            'xelox_slug' => '124-strategy-finder-matching-your-profile-to-a-deal-strategy',
        ],
        'can_start_top_strategy' => [
            'display_name' => 'Can start today',
            'unit' => '',
            'formula' => 'Capital midpoint ≥ typical entry cost',
            'variables' => [
                ['name' => 'Capital gap', 'description' => 'Shortfall if not ready.'],
            ],
            'plain_summary' => 'Whether your capital band typically covers entry cost for the top strategy.',
            'xelox_slug' => '124-strategy-finder-matching-your-profile-to-a-deal-strategy',
        ],
    ],

    'npv_irr' => [
        'npv' => [
            'display_name' => 'Net present value',
            'unit' => '£',
            'formula' => 'Sum of discounted cash flows',
            'variables' => [
                ['name' => 'Discount rate', 'description' => 'Your required return.'],
            ],
            'plain_summary' => 'Value today of future cash flows. Positive NPV means the deal beats your hurdle rate.',
            'xelox_slug' => '132-npv-net-present-value',
        ],
        'irr_pct' => [
            'display_name' => 'Internal rate of return',
            'unit' => '%',
            'formula' => 'Rate where NPV = 0',
            'variables' => [
                ['name' => 'Cash flows', 'description' => 'Series including initial outlay.'],
            ],
            'plain_summary' => 'Annualised return implied by the cash flow series.',
            'xelox_slug' => '133-irr-internal-rate-of-return',
        ],
    ],

  // ─────────────────────────────────────────────────────────────────
  // Propcalc utility / quick tools
  // ─────────────────────────────────────────────────────────────────

    'rental_yield' => [
        'gross_yield_pct' => [
            'display_name' => 'Gross yield',
            'unit' => '%',
            'formula' => '(Monthly rent × 12 ÷ Purchase price) × 100',
            'variables' => [
                ['name' => 'Monthly rent', 'description' => 'Gross rent per month.'],
                ['name' => 'Purchase price', 'description' => 'Property price used as the denominator.'],
            ],
            'plain_summary' => 'Rent as a percentage of price before any costs.',
            'xelox_slug' => '042-btl-gross-yield-the-first-number-you-should-know-on-any-buy-to-let',
        ],
        'net_yield_pct' => [
            'display_name' => 'Net yield',
            'unit' => '%',
            'formula' => '((Effective annual rent − Annual expenses) ÷ Purchase price) × 100',
            'variables' => [
                ['name' => 'Effective rent', 'description' => 'Gross rent minus void allowance.'],
                ['name' => 'Annual expenses', 'description' => 'Mortgage interest, insurance, maintenance, fees, etc.'],
            ],
            'plain_summary' => 'Yield after void and running costs, still before tax.',
            'xelox_slug' => '043-btl-net-yield-the-number-that-actually-matters',
        ],
        'monthly_net_income' => [
            'display_name' => 'Monthly net income',
            'unit' => '£',
            'formula' => '(Effective annual rent − Annual expenses) ÷ 12',
            'variables' => [
                ['name' => 'Effective rent', 'description' => 'Annual rent after void.'],
                ['name' => 'Annual expenses', 'description' => 'All annual operating costs entered.'],
            ],
            'plain_summary' => 'Average monthly surplus after costs.',
            'xelox_slug' => '044-btl-monthly-cashflow-the-operating-reality-of-every-buy-to-let',
        ],
    ],

    'btl_roi' => [
        'cash_on_cash_pct' => [
            'display_name' => 'Cash-on-cash return',
            'unit' => '%',
            'formula' => '(Annual cashflow ÷ Total cash invested) × 100',
            'variables' => [
                ['name' => 'Annual cashflow', 'description' => 'Monthly cashflow × 12.'],
                ['name' => 'Total cash invested', 'description' => 'Deposit + SDLT + refurb + legal/survey.'],
            ],
            'plain_summary' => 'Return on the actual cash you put into the deal.',
            'xelox_slug' => '048-btl-roi-return-on-investment-for-your-buy-to-let',
        ],
        'gross_yield_pct' => [
            'display_name' => 'Gross yield',
            'unit' => '%',
            'formula' => '(Monthly rent × 12 ÷ Purchase price) × 100',
            'variables' => [
                ['name' => 'Monthly rent', 'description' => 'Gross rent.'],
                ['name' => 'Purchase price', 'description' => 'Agreed purchase price.'],
            ],
            'plain_summary' => 'Rent versus price before mortgage and costs.',
            'xelox_slug' => '042-btl-gross-yield-the-first-number-you-should-know-on-any-buy-to-let',
        ],
        'monthly_cashflow' => [
            'display_name' => 'Monthly cashflow',
            'unit' => '£',
            'formula' => 'Rent − Mortgage − Service charge − Agent − Maintenance − Insurance',
            'variables' => [
                ['name' => 'Rent', 'description' => 'Monthly rent.'],
                ['name' => 'Mortgage', 'description' => 'Monthly mortgage payment (IO or repayment).'],
            ],
            'plain_summary' => 'What is left each month after major costs.',
            'xelox_slug' => '044-btl-monthly-cashflow-the-operating-reality-of-every-buy-to-let',
        ],
    ],

    'void_period' => [
        'lost_rent_total' => [
            'display_name' => 'Lost rent',
            'unit' => '£',
            'formula' => '(Monthly rent ÷ 4.33) × Void weeks',
            'variables' => [
                ['name' => 'Monthly rent', 'description' => 'Contract rent while vacant.'],
                ['name' => 'Void weeks', 'description' => 'Weeks without a paying tenant.'],
            ],
            'plain_summary' => 'Income you miss while the property is empty.',
            'xelox_slug' => '022-void-allowance-the-cost-new-landlords-always-forget',
        ],
        'total_void_cost' => [
            'display_name' => 'Total void cost',
            'unit' => '£',
            'formula' => 'Lost rent + Running costs + Preparation costs',
            'variables' => [
                ['name' => 'Lost rent', 'description' => 'Rent lost over the void period.'],
                ['name' => 'Running costs', 'description' => 'Mortgage, utilities, etc. while empty.'],
                ['name' => 'Preparation', 'description' => 'Cleaning, marketing, checks between tenancies.'],
            ],
            'plain_summary' => 'Full cost of a void period including turnover.',
            'xelox_slug' => '022-void-allowance-the-cost-new-landlords-always-forget',
        ],
    ],

    'skip_hire' => [
        'estimated_cubic_yards' => [
            'display_name' => 'Estimated waste volume',
            'unit' => 'yd³',
            'formula' => 'Rooms×2 + Walls×1.5 + Units×3 + Flooring×0.08 + Bags×0.05',
            'variables' => [
                ['name' => 'Rooms stripped', 'description' => 'Rooms cleared to shell.'],
                ['name' => 'Waste type', 'description' => 'Mixed waste or rubble/soil (capped for weight).'],
            ],
            'plain_summary' => 'Illustrative cubic yards from your strip-out inputs.',
            'xelox_slug' => '042-btl-gross-yield-the-first-number-you-should-know-on-any-buy-to-let',
        ],
        'total_estimate' => [
            'display_name' => 'Total skip estimate',
            'unit' => '£',
            'formula' => 'Skip hire (location adjusted) + Permit allowance',
            'variables' => [
                ['name' => 'Recommended skip', 'description' => 'Smallest standard skip that fits the volume.'],
                ['name' => 'Location', 'description' => 'Regional cost multiplier.'],
            ],
            'plain_summary' => 'Indicative hire plus allowance for highway permits if needed.',
            'xelox_slug' => '042-btl-gross-yield-the-first-number-you-should-know-on-any-buy-to-let',
        ],
    ],

    'cgt' => [
        'gross_gain' => [
            'display_name' => 'Gross capital gain',
            'unit' => '£',
            'formula' => 'Sale proceeds − Purchase price − Purchase fees − Improvements − Sale fees',
            'variables' => [
                ['name' => 'Sale price', 'description' => 'Amount received on disposal.'],
                ['name' => 'Cost base', 'description' => 'Purchase plus allowable costs.'],
            ],
            'plain_summary' => 'Gain before reliefs and annual exempt amount.',
            'xelox_slug' => '042-btl-gross-yield-the-first-number-you-should-know-on-any-buy-to-let',
        ],
        'cgt_due' => [
            'display_name' => 'CGT due (illustrative)',
            'unit' => '£',
            'formula' => 'Taxable gain after PRR and allowance × CGT rate',
            'variables' => [
                ['name' => 'Taxable gain', 'description' => 'After private residence relief and £3,000 allowance.'],
                ['name' => 'Rate', 'description' => '18% basic or 24% higher residential rate.'],
            ],
            'plain_summary' => 'Illustrative UK residential CGT; not tax advice.',
            'xelox_slug' => '042-btl-gross-yield-the-first-number-you-should-know-on-any-buy-to-let',
        ],
    ],

    'mortgage_affordability' => [
        'max_loan_amount' => [
            'display_name' => 'Maximum loan',
            'unit' => '£',
            'formula' => '(Gross income × Multiplier) − (Annual commitments × 0.5)',
            'variables' => [
                ['name' => 'Gross income', 'description' => 'Your income plus joint income if any.'],
                ['name' => 'Multiplier', 'description' => 'Illustrative income multiple (default 4.5×).'],
                ['name' => 'Commitments', 'description' => 'Monthly credit/loans annualised; half deducted.'],
            ],
            'plain_summary' => 'Indicative borrowing before lender-specific rules.',
            'xelox_slug' => '029-loan-to-value-the-single-most-important-number-in-property-finance',
        ],
        'max_purchase_price' => [
            'display_name' => 'Maximum purchase price',
            'unit' => '£',
            'formula' => 'Maximum loan + Deposit',
            'variables' => [
                ['name' => 'Maximum loan', 'description' => 'From income multiple model.'],
                ['name' => 'Deposit', 'description' => 'Cash you have for deposit.'],
            ],
            'plain_summary' => 'Price you could target with this deposit and income.',
            'xelox_slug' => '029-loan-to-value-the-single-most-important-number-in-property-finance',
        ],
        'stressed_monthly_payment' => [
            'display_name' => 'Stressed monthly payment',
            'unit' => '£',
            'formula' => 'Repayment mortgage at (interest rate + 3%) on max loan',
            'variables' => [
                ['name' => 'Max loan', 'description' => 'Full borrowing amount.'],
                ['name' => 'Term', 'description' => 'Mortgage term in years.'],
            ],
            'plain_summary' => 'Simplified stress test: rate +3% on repayment basis.',
            'xelox_slug' => '029-loan-to-value-the-single-most-important-number-in-property-finance',
        ],
    ],

    'mini_refurb' => [
        'refurb_total_estimate' => [
            'display_name' => 'Refurb total estimate',
            'unit' => '£',
            'formula' => '(Room costs × Quality tier) + Contingency',
            'variables' => [
                ['name' => 'Room counts', 'description' => 'Bedrooms, bathrooms, receptions, kitchen.'],
                ['name' => 'Quality tier', 'description' => 'Light, standard, or full spec.'],
                ['name' => 'Contingency', 'description' => 'Percentage on top of subtotal.'],
            ],
            'plain_summary' => 'Quick estimate from catalogue averages; use BRR refurb builder for line items.',
            'xelox_slug' => '042-btl-gross-yield-the-first-number-you-should-know-on-any-buy-to-let',
        ],
    ],

    'snagging_list' => [
        'checklist_item_count' => [
            'display_name' => 'Snagging checklist',
            'unit' => 'items',
            'formula' => 'Standard UK handover inspection list',
            'variables' => [
                ['name' => 'Property', 'description' => 'Address on the PDF header.'],
                ['name' => 'Inspector', 'description' => 'Optional name on the report.'],
            ],
            'plain_summary' => '23 standard snagging items for new build or refurb handover; pass/fail on the PDF.',
            'xelox_slug' => '042-btl-gross-yield-the-first-number-you-should-know-on-any-buy-to-let',
        ],
    ],
];
