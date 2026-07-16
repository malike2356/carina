<?php

declare(strict_types=1);

use App\Services\Deals\DevelopmentCalculatorService;

function developmentViableInputs(): array
{
    return [
        'purchase_price' => 150000,
        'build_cost_per_unit' => 60000,
        'unit_count' => 7,
        'average_unit_value' => 140000,
        'average_monthly_rent' => 750,
        'professional_fees' => 50000,
        'project_months' => 18,
        'finance_rate_monthly' => 0.0105,
        'exit_preference' => 'both',
    ];
}

it('calculates a viable development deal correctly', function (): void {
    $service = new DevelopmentCalculatorService;
    $result = $service->calculate(developmentViableInputs());

    expect($result['gdv']['total'])->toBe(980000.0)
        ->and($result['viability']['is_viable'])->toBeTrue()
        ->and($result['exit_sell']['profit'])->toBeGreaterThan(150000);
});

it('flags a non-viable deal', function (): void {
    $service = new DevelopmentCalculatorService;
    $result = $service->calculate([
        'purchase_price' => 500000,
        'build_cost_per_unit' => 80000,
        'unit_count' => 5,
        'average_unit_value' => 120000,
        'average_monthly_rent' => 600,
        'professional_fees' => 60000,
        'project_months' => 24,
        'finance_rate_monthly' => 0.013,
        'exit_preference' => 'sell',
    ]);

    expect($result['viability']['is_viable'])->toBeFalse();
});

it('returns supported housing exit when requested', function (): void {
    $service = new DevelopmentCalculatorService;
    $inputs = developmentViableInputs();
    $inputs['supported_housing_exit'] = true;
    $inputs['supported_housing_monthly_rent'] = 850;
    $inputs['supported_housing_lease_years'] = 15;

    $result = $service->calculate($inputs);

    expect($result['exit_supported_housing'])->not->toBeNull()
        ->and($result['exit_supported_housing']['lease_years'])->toBe(15)
        ->and($result['exit_supported_housing']['total_contracted_income'])->toBeGreaterThan(0);
});
