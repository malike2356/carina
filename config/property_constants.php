<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | SDLT Rates (England and Northern Ireland)
    | Source: HMRC - update after each Budget
    | Last updated: October 2024 Budget
    |--------------------------------------------------------------------------
    */
    'sdlt' => [
        'residential' => [
            'standard' => [
                ['up_to' => 250_000, 'rate' => 0.00],
                ['up_to' => 925_000, 'rate' => 0.05],
                ['up_to' => 1_500_000, 'rate' => 0.10],
                ['up_to' => null, 'rate' => 0.12],
            ],
            'additional_property' => [
                ['up_to' => 250_000, 'rate' => 0.05],
                ['up_to' => 925_000, 'rate' => 0.10],
                ['up_to' => 1_500_000, 'rate' => 0.15],
                ['up_to' => null, 'rate' => 0.17],
            ],
            'additional_property_surcharge' => 0.03,
        ],
        'first_time_buyer' => [
            'relief_max_price' => 625_000,
            'nil_rate_threshold' => 425_000,
            'above_nil_rate' => 0.05,
        ],
        'commercial' => [
            ['up_to' => 150_000, 'rate' => 0.00],
            ['up_to' => 250_000, 'rate' => 0.02],
            ['up_to' => null, 'rate' => 0.05],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Income Tax (England and Wales)
    | Last updated: 2024/25 tax year
    |--------------------------------------------------------------------------
    */
    'income_tax' => [
        'personal_allowance' => 12_570,
        'basic_rate_threshold' => 50_270,
        'higher_rate_threshold' => 125_140,
        'rates' => [
            'basic' => 0.20,
            'higher' => 0.40,
            'additional' => 0.45,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Capital Gains Tax
    | Last updated: October 2024 Budget
    |--------------------------------------------------------------------------
    */
    'cgt' => [
        'annual_exemption' => 3_000,
        'residential_rates' => [
            'basic' => 0.18,
            'higher' => 0.24,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Mortgage and Bridging
    | Default assumptions - always overridable by user input
    |--------------------------------------------------------------------------
    */
    'mortgage' => [
        'default_stress_test_rate' => 0.085,
        'default_ltv' => 0.75,
        'stress_test_rate_offset' => 0.03,
        'default_interest_rate' => 0.055,
        'default_term_years' => 25,
    ],

    'bridging' => [
        'default_monthly_rate' => 0.0075,
        'default_ltv' => 0.75,
    ],

    /*
    |--------------------------------------------------------------------------
    | HMO Room Sizes (England - Housing Act 2004)
    |--------------------------------------------------------------------------
    */
    'hmo' => [
        'min_room_size_sqm_single' => 6.51,
        'min_room_size_sqm_double' => 10.22,
        'min_room_size_sqm_child' => 4.64,
    ],

];
