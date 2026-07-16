<?php

declare(strict_types=1);

use App\Services\Deals\Calculators\SaVsBtlCalculatorService;

/**
 * @return array<string, mixed>
 */
function saVsBtlUnitInputs(): array
{
    return [
        'purchase_price' => 200000,
        'stamp_duty' => 7500,
        'legal_purchase_costs' => 1500,
        'mortgage_amount' => 150000,
        'mortgage_rate_pct' => 5.5,
        'mortgage_term_years' => 25,
        'interest_only' => true,
        'monthly_rent' => 1200,
        'btl_refurb_cost' => 8000,
        'btl_management_fee_type' => 'percent',
        'btl_management_fee_percent' => 10,
        'btl_monthly_maintenance' => 50,
        'btl_void_rate_pct' => 5,
        'btl_annual_insurance' => 400,
        'nightly_rate' => 120,
        'occupancy_pct' => 75,
        'sa_fitout_cost' => 15000,
        'channel_manager_monthly' => 25,
        'dynamic_pricing_monthly' => 15,
        'cleaning_cost_per_stay' => 45,
        'avg_stay_length_nights' => 2,
        'sa_management_fee_pct' => 0,
        'platform_commission_pct' => 3,
        'sa_monthly_maintenance' => 75,
        'sa_annual_insurance' => 500,
    ];
}

it('computes mortgage payment shared across both columns', function (): void {
    $service = app(SaVsBtlCalculatorService::class);

    $result = $service->calculate([
        'purchase_price' => 100000,
        'stamp_duty' => 0,
        'legal_purchase_costs' => 0,
        'mortgage_amount' => 75000,
        'mortgage_rate_pct' => 6,
        'mortgage_term_years' => 25,
        'interest_only' => true,
        'monthly_rent' => 800,
        'nightly_rate' => 90,
        'occupancy_pct' => 70,
    ]);

    expect($result['shared']['monthly_mortgage_payment'])->toBe(375.0);
});

it('returns higher SA ROI when nightly rate and occupancy are strong', function (): void {
    $result = app(SaVsBtlCalculatorService::class)->calculate(saVsBtlUnitInputs());

    expect($result['sa']['net_roi_pct'])->toBeGreaterThan($result['btl']['net_roi_pct'])
        ->and($result['comparison']['better_roi_model'])->toBe('sa');
});

it('allows high SA fees to produce lower net income than BTL', function (): void {
    $inputs = saVsBtlUnitInputs();
    $inputs['nightly_rate'] = 70;
    $inputs['occupancy_pct'] = 55;
    $inputs['sa_management_fee_pct'] = 25;
    $inputs['platform_commission_pct'] = 15;
    $inputs['cleaning_cost_per_stay'] = 80;

    $result = app(SaVsBtlCalculatorService::class)->calculate($inputs);

    expect($result['sa']['net_annual_income'])->toBeLessThan($result['btl']['net_annual_income']);
});

it('produces zero SA gross revenue at zero occupancy', function (): void {
    $inputs = saVsBtlUnitInputs();
    $inputs['occupancy_pct'] = 0;

    $result = app(SaVsBtlCalculatorService::class)->calculate($inputs);

    expect($result['sa']['gross_annual_income'])->toBe(0.0);
});
