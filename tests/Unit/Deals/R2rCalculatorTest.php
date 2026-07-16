<?php

declare(strict_types=1);

use App\Services\Deals\Calculators\R2rCalculator;

it('calculates net profit from gross margin minus operating costs', function (): void {
    $calc = new R2rCalculator;
    $result = $calc->calculate([
        'rent_from_subtenants_monthly' => 2200,
        'rent_to_landlord_monthly' => 1600,
        'subtenant_count' => 4,
        'utilities_monthly' => 120,
        'council_tax_monthly' => 100,
        'insurance_monthly' => 30,
        'management_pct_rent' => 0.08,
        'maintenance_pct_rent' => 0.03,
        'void_months_subrent' => 1,
    ]);

    $outputs = $result['outputs'];
    expect($outputs['rent_difference_monthly'])->toBe(600.0)
        ->and($outputs['monthly_profit'])->toBeGreaterThan(0)
        ->and($outputs['annual_profit'])->toBeGreaterThan(0)
        ->and($outputs['deal_stacks'])->toBeTrue()
        ->and($outputs['breakeven_occupancy_pct'])->toBeLessThan(100);
});

it('derives gross rent from rooms and rent per room', function (): void {
    $calc = new R2rCalculator;
    $result = $calc->calculate([
        'rent_per_room_monthly' => 550,
        'subtenant_count' => 4,
        'rent_to_landlord_monthly' => 1600,
    ]);

    expect($result['outputs']['annual_gross_income'])->toBe(26400.0);
});

it('includes setup capital return metrics', function (): void {
    $calc = new R2rCalculator;
    $result = $calc->calculate([
        'rent_from_subtenants_monthly' => 2200,
        'rent_to_landlord_monthly' => 1600,
        'landlord_deposit' => 3000,
        'furnishing_setup' => 5000,
    ]);

    expect($result['outputs']['setup_costs_total'])->toBe(8000.0)
        ->and($result['outputs']['return_on_setup_capital_pct'])->toBeGreaterThan(0)
        ->and($result['outputs']['setup_recovery_months'])->toBeGreaterThan(0);
});
