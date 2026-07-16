<?php

declare(strict_types=1);

use App\Services\Deals\Calculators\DealCalculatorRegistry;
use App\Services\Deals\DealCalculatorRunService;

it('runs every registered calculator slug with a minimal valid payload', function () {
    $runner = app(DealCalculatorRunService::class);
    $payloads = [
        'btl' => ['purchase_price' => 200_000, 'monthly_rent' => 1000, 'monthly_mortgage' => 0],
        'commercial' => [
            'purchase_price' => 200_000,
            'passing_rent_annual' => 12_000,
            'erv_annual' => 14_000,
            'mortgage_amount' => 0,
        ],
        'brr' => ['purchase_price' => 180_000, 'refurb_cost' => 20_000, 'post_refurb_value' => 240_000],
        'hmo' => ['purchase_price' => 300_000, 'rooms' => 4, 'rent_per_room_monthly' => 500],
        'r2r' => ['rent_from_subtenants_monthly' => 2000, 'rent_to_landlord_monthly' => 1500],
        'sa' => ['nightly_rate' => 80, 'occupancy_pct' => 70],
        'flip' => ['purchase_price' => 150_000, 'refurb_cost' => 25_000, 'selling_price' => 220_000],
        'bmv_no_money_down' => [
            'market_value' => 300_000,
            'purchase_price' => 190_000,
            'remortgage_ltv' => 0.75,
            'bridging_arrangement_fee_pct' => 0.02,
            'legal_fees' => 2500,
            'valuation_fee' => 500,
            'is_additional_property' => true,
        ],
        'development' => [
            'purchase_price' => 150_000,
            'build_cost_per_unit' => 60_000,
            'unit_count' => 7,
            'average_unit_value' => 140_000,
            'average_monthly_rent' => 750,
            'professional_fees' => 50_000,
            'project_months' => 18,
            'finance_rate_monthly' => 0.0105,
            'exit_preference' => 'both',
        ],
        'npv_irr' => ['cash_flows' => [-100_000, 10_000, 110_000], 'discount_rate_annual' => 0.08],
        'dscr' => ['annual_noi' => 40_000, 'annual_debt_service' => 30_000],
        'income_multiples' => ['purchase_price' => 240_000, 'monthly_rent' => 1200],
        'coc_roe' => ['annual_pre_tax_cash_flow' => 9000, 'total_cash_invested' => 60_000],
        'ltv' => ['loan_amount' => 150_000, 'property_value' => 200_000],
        'breakeven_occupancy' => [
            'annual_operating_expenses' => 6000,
            'annual_debt_service' => 12_000,
            'annual_gross_potential_income' => 24_000,
        ],
        'sdlt' => ['purchase_price' => 300_000, 'profile' => 'standard'],
        'bridging' => ['loan_amount' => 200_000, 'annual_interest_rate' => 0.1, 'term_months' => 12],
        'mortgage' => ['loan_amount' => 180_000, 'annual_interest_rate' => 0.055, 'term_years' => 25, 'interest_only' => false],
    ];

    foreach (DealCalculatorRegistry::STRATEGIES as $slug) {
        expect($payloads)->toHaveKey($slug);
        $out = $runner->validateAndRun($slug, $payloads[$slug]);
        expect($out)->toHaveKeys(['strategy', 'outputs', 'assumptions', 'duration_ms'])
            ->and($out['strategy'])->toBe($slug)
            ->and($out['outputs'])->toBeArray()->not->toBeEmpty();
    }
});
