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

    // ---- Lock assumptions across calculators ----
    'lock_assumptions_across_calculators' => 0,
];
