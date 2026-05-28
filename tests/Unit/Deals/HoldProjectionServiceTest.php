<?php

declare(strict_types=1);

use App\Services\Deals\HoldProjectionService;

it('projects five year cashflow and total return for a simple hold', function () {
    $svc = new HoldProjectionService;
    $result = $svc->project([
        'hold_years' => 5,
        'annual_rent_growth_pct' => 0.02,
        'annual_capital_growth_pct' => 0.02,
        'property_value' => 250000,
        'cash_invested' => 62500,
        'monthly_rent' => 1500,
        'monthly_mortgage' => 850,
        'monthly_insurance' => 25,
        'monthly_council_tax' => 150,
        'monthly_utilities' => 0,
        'monthly_management' => 180,
        'monthly_maintenance' => 208,
        'void_months_per_year' => 1,
        'mortgage_balance' => 187500,
    ]);

    expect($result['hold_years'])->toBe(5)
        ->and($result['schedule'])->toHaveCount(5)
        ->and($result['cumulative_cashflow'])->toBeGreaterThan(0)
        ->and($result['equity_gain'])->toBeGreaterThan(0)
        ->and($result['total_return'])->toBeGreaterThan($result['cumulative_cashflow'])
        ->and($result['cash_flows_for_npv'][0])->toBe(-62500.0);
});
