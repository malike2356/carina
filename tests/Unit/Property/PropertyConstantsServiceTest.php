<?php

declare(strict_types=1);

use App\Services\Deals\Calculators\CgtCalculator;
use App\Services\Property\PropertyConstantsService;
use App\Services\Property\PropertyFinancialService;

it('reads SDLT bands from property_constants config', function (): void {
    config([
        'property_constants.sdlt.residential.standard' => [
            ['up_to' => 250_000, 'rate' => 0.00],
            ['up_to' => null, 'rate' => 0.10],
        ],
    ]);

    $svc = new PropertyFinancialService(new PropertyConstantsService);

    expect($svc->stampDutyStandardResidential(300_000))->toBe(5000.0);
});

it('reads CGT rates and exemption from property_constants config', function (): void {
    config([
        'property_constants.cgt.annual_exemption' => 2_000,
        'property_constants.cgt.residential_rates.basic' => 0.10,
        'property_constants.cgt.residential_rates.higher' => 0.20,
    ]);

    $result = (new CgtCalculator(new PropertyConstantsService))->calculate([
        'purchase_date' => '2020-01-01',
        'sale_date' => '2024-06-01',
        'purchase_price' => 200_000,
        'purchase_fees' => 0,
        'improvement_costs' => 0,
        'sale_price' => 250_000,
        'sale_fees' => 0,
        'months_lived_in_property' => 0,
        'tax_band' => 'basic',
    ]);

    expect($result['outputs']['taxable_gain_after_allowance'])->toBe(48_000.0)
        ->and($result['outputs']['cgt_rate_pct'])->toBe(10.0)
        ->and($result['outputs']['cgt_due'])->toBe(4800.0);
});

it('PropertyConstantsService exposes HMO room minimums from config', function (): void {
    config([
        'property_constants.hmo.min_room_size_sqm_single' => 7.0,
    ]);

    expect(app(PropertyConstantsService::class)->hmoRoomSizeMinimums()['single'])->toBe(7.0);
});
