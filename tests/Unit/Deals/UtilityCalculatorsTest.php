<?php

declare(strict_types=1);

use App\Services\Deals\Calculators\CgtCalculator;
use App\Services\Deals\Calculators\MiniRefurbCalculator;
use App\Services\Deals\Calculators\RentalYieldCalculator;
use App\Services\Deals\Calculators\SkipHireCalculator;
use App\Services\Deals\Calculators\SnaggingListCalculator;
use App\Services\Deals\Calculators\VoidPeriodCalculator;
use App\Services\Propcalc\SnaggingListPdfService;
use App\Services\Property\PropertyFinancialService;

it('calculates rental yield with void and expenses', function () {
    $result = (new RentalYieldCalculator(app(PropertyFinancialService::class)))->calculate([
        'purchase_price' => 200000,
        'monthly_rent' => 1200,
        'void_weeks_per_year' => 2,
        'annual_insurance' => 400,
    ]);

    expect($result['outputs']['gross_yield_pct'])->toBeGreaterThan(0)
        ->and($result['outputs']['net_yield_pct'])->toBeLessThan($result['outputs']['gross_yield_pct']);
});

it('calculates void period total cost', function () {
    $result = (new VoidPeriodCalculator)->calculate([
        'monthly_rent' => 1200,
        'void_weeks' => 3,
        'weekly_mortgage' => 200,
        'prep_cleaning' => 150,
    ]);

    expect($result['outputs']['total_void_cost'])->toBeGreaterThan(0)
        ->and($result['outputs']['lost_rent_total'])->toBeGreaterThan(0);
});

it('recommends a skip size from waste inputs', function () {
    $result = (new SkipHireCalculator)->calculate([
        'rooms_stripped' => 2,
        'kitchen_bathroom_units' => 1,
        'location' => 'london',
    ]);

    expect($result['outputs']['recommended_skip_yards'])->toBeGreaterThan(0)
        ->and($result['outputs']['total_estimate'])->toBeGreaterThan(0);
});

it('calculates illustrative cgt with prr', function () {
    $result = (new CgtCalculator)->calculate([
        'purchase_date' => '2020-01-01',
        'sale_date' => '2024-06-01',
        'purchase_price' => 150000,
        'sale_price' => 220000,
        'months_lived_in_property' => 24,
        'tax_band' => 'basic',
    ]);

    expect($result['outputs']['gross_gain'])->toBe(70000.0)
        ->and($result['outputs']['cgt_due'])->toBeGreaterThanOrEqual(0);
});

it('generates snagging checklist and pdf', function () {
    $calc = (new SnaggingListCalculator)->calculate([
        'property_address' => '1 Test Street',
        'inspector_name' => 'Tester',
    ]);

    expect($calc['outputs']['checklist_item_count'])->toBe(23)
        ->and($calc['checklist_items'])->toHaveCount(23);

    $pdf = (new SnaggingListPdfService)->renderPdf([
        'property_address' => '1 Test Street',
    ]);
    expect(strlen($pdf))->toBeGreaterThan(500);
});

it('estimates mini refurb from room counts', function () {
    $result = (new MiniRefurbCalculator)->calculate([
        'bedrooms' => 3,
        'bathrooms' => 1,
        'quality' => 'standard',
    ]);

    expect($result['outputs']['refurb_total_estimate'])->toBeGreaterThan(1000);
});
