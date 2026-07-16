<?php

declare(strict_types=1);

use App\Services\Deals\Calculators\BrrCalculator;
use App\Services\Property\PropertyFinancialService;

it('brr calculator models capital recycle and hold phase with granular opex', function () {
    $calc = new BrrCalculator(new PropertyFinancialService);
    $result = $calc->calculate([
        'purchase_price' => 200000,
        'refurb_cost' => 25000,
        'post_refurb_value' => 280000,
        'refinance_ltv' => 0.75,
        'monthly_rent' => 1200,
        'refinance_rate_annual' => 0.055,
        'management_pct' => 0.10,
        'maintenance_pct_rent' => 0.05,
        'insurance_monthly' => 25,
        'void_weeks_per_year' => 2,
    ]);

    $o = $result['outputs'];

    expect($o['capital_recycled_pass'])->toBeBool()
        ->and($o['refinance_gross'])->toBe(210000.0)
        ->and($o['monthly_operating_costs'])->toBeGreaterThan(0)
        ->and($o['hold_deal_stacks'])->toBeBool()
        ->and($o['positive_cashflow_pass'])->toBe($o['hold_deal_stacks'])
        ->and($o['breakeven_rent_monthly'])->toBeGreaterThan(0)
        ->and($result['stress_tests'])->toBeArray()->not->toBeEmpty()
        ->and($o['five_year_schedule'])->toBeArray()->toHaveCount(5)
        ->and($o['five_year_total_return'])->toBeGreaterThan(0);
});

it('brr stacks on capital recycle when hold rent omitted', function () {
    $calc = new BrrCalculator(new PropertyFinancialService);
    $result = $calc->calculate([
        'purchase_price' => 200000,
        'refurb_cost' => 25000,
        'post_refurb_value' => 280000,
    ]);

    expect($result['outputs']['deal_stacks'])->toBe($result['outputs']['capital_recycled_pass'])
        ->and($result['outputs'])->not->toHaveKey('monthly_cashflow');
});
