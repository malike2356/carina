<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Calculator configuration
    |--------------------------------------------------------------------------
    | Single source of truth for calculator defaults and rate bands. Values
    | set via Platform Settings (admin) override these. Money defaults are
    | in pounds; calculators convert to pence internally.
    */

    // ---- SDLT ----
    'sdlt_bands_residential' => [
        ['up_to' => 250000, 'rate' => 0],
        ['up_to' => 925000, 'rate' => 5],
        ['up_to' => 1500000, 'rate' => 10],
        ['up_to' => null, 'rate' => 12],
    ],
    'sdlt_first_time_buyer_threshold' => 425000,
    'sdlt_additional_surcharge_pct' => 3,

    // ---- Mortgage ----
    'mortgage_default_ltv_pct' => 75,
    'mortgage_default_rate_pct' => 5.5,
    'mortgage_default_term_years' => 25,

    // ---- Bridging ----
    'bridging_default_monthly_rate_pct' => 0.75,
    'bridging_default_arrangement_fee_pct' => 2,
    'bridging_default_exit_fee_pct' => 0,

    // ---- R2R (Rent-to-Rent) ----
    'r2r_ten_percent_rule_pct' => 10,
    'r2r_default_occupancy_pct' => 90,
    'r2r_default_management_pct' => 10,
    'r2r_default_deposit_weeks' => 5,
    'r2r_min_monthly_income_pct' => 50,

    // ---- HMO Yield ----
    'hmo_default_occupancy_pct' => 95,
    'hmo_default_management_pct' => 10,

    // ---- Flip / Development & BRR (shared purchase/refinance defaults) ----
    'default_legal_purchase' => 1500,
    'default_survey_cost' => 600,
    'default_broker_fee' => 500,
    'default_legal_remortgage' => 800,
    'flip_default_agent_fee_pct' => 1.25,
    'brr_default_ltv' => 75,
    'brr_default_refinance_rate' => 5.5,
    'brr_default_term_years' => 25,
    'brr_default_management_pct' => 10,
    'brr_default_void_weeks_pa' => 2,
    'brr_default_maintenance_pa' => 0,

    // ---- Sourcing fee ----
    'sourcing_default_tax_rate_pct' => 20,

    // ---- Serviced accommodation ----
    'sa_default_occupancy_pct' => 75,
    'sa_default_ota_commission_pct' => 15,
    'sa_default_management_pct' => 0,

    // ---- Shared scenario defaults (fallback across calculators) ----
    'scenario_default_management_pct' => 10,
    'scenario_default_occupancy_pct' => 90,
    'scenario_default_void_weeks_pa' => 2,
    'scenario_default_cost_model' => 'exclude_mortgage',

    // ---- Single Let ----
    'single_let_default_management_pct' => 10,
    'single_let_default_maintenance_voids_pct' => 5,

    // ---- Area comparison (composite score weights, must sum to 100) ----
    'area_comparison_weights' => [
        'yield' => 30,
        'price_growth' => 25,
        'demand' => 20,
        'liquidity' => 15,
        'affordability' => 10,
    ],

    // ---- Outcome rules (cross-calculator PASS/FAIL thresholds) ----
    'outcome_min_roi_pct' => 10,
    'outcome_min_net_monthly_cashflow' => 0,

    /*
    |--------------------------------------------------------------------------
    | Illustrative UI benchmarks (financial tools + quick verdict bands)
    |--------------------------------------------------------------------------
    | Used for Pass/Fail chips in the results panel only. They are NOT lender
    | offers or tax advice. Core calculator maths lives in each engine; Show
    | working exposes formulas. Admins can override via Platform Settings when
    | mapped in CalculatorConfigService.
    */
    'illustrative_dscr_min' => 1.25,
    'illustrative_ltv_btl_band_pct' => 75,
    'illustrative_ltv_upper_band_pct' => 80,
    'illustrative_breakeven_strong_pct' => 70,
    'illustrative_breakeven_moderate_pct' => 75,
    'illustrative_cap_rate_min_pct' => 4,
    'illustrative_coc_strong_pct' => 8,
    'illustrative_coc_moderate_pct' => 5,
    'illustrative_bridging_cost_max_pct_of_loan' => 8,

    // Quick "deal verdict" bands (results panel triage only; not saved to deals)
    'verdict_yield_strong_pct' => 8,
    'verdict_yield_marginal_pct' => 5,
    'verdict_brr_recycled_strong_pct' => 75,
    'verdict_brr_recycled_marginal_pct' => 50,
    'verdict_sa_revenue_strong' => 40000,
    'verdict_sa_revenue_marginal' => 20000,
    'verdict_r2r_profit_strong' => 6000,
    'verdict_r2r_profit_marginal' => 2400,
    'verdict_r2r_margin_strong_pct' => 20,
    'verdict_flip_roi_strong_pct' => 20,
    'verdict_flip_roi_marginal_pct' => 10,
    'verdict_flip_profit_strong' => 20000,

    // ---- Lock assumptions across calculators ----
    'lock_assumptions_across_calculators' => 0,
];
