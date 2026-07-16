<?php

declare(strict_types=1);

use App\Services\Deals\CalculatorWorking\CalculatorWorkingService;
use App\Services\Deals\Calculators\DealCalculatorRegistry;

it('supports show working for all utility calculator slugs', function (string $slug) {
    $service = app(CalculatorWorkingService::class);
    expect($service->supports($slug))->toBeTrue();
})->with(DealCalculatorRegistry::UTILITY_TOOL_SLUGS);

it('builds non-empty working steps for rental yield', function () {
    $service = app(CalculatorWorkingService::class);
    $result = $service->buildFor('rental_yield', [
        'purchase_price' => 200000,
        'monthly_rent' => 1200,
        'void_weeks_per_year' => 2,
        'annual_insurance' => 400,
    ]);

    expect($result['supported'])->toBeTrue()
        ->and($result['working'])->not->toBeEmpty()
        ->and(collect($result['working'])->pluck('key'))->toContain('gross_yield_pct', 'net_yield_pct');
});

it('builds working for snagging list checklist', function () {
    $service = app(CalculatorWorkingService::class);
    $result = $service->buildFor('snagging_list', [
        'property_address' => '1 Test Street',
    ]);

    expect($result['supported'])->toBeTrue()
        ->and($result['working'])->toHaveCount(1)
        ->and($result['working'][0]['key'])->toBe('checklist_item_count');
});

it('returns working via public endpoint for void period', function () {
    $response = $this->postJson(route('public.calculators.working', ['slug' => 'void_period']), [
        'monthly_rent' => 1200,
        'void_weeks' => 3,
        'weekly_mortgage' => 200,
    ]);

    $response->assertOk()
        ->assertJsonPath('supported', true)
        ->assertJsonPath('strategy', 'void_period');

    expect($response->json('working'))->not->toBeEmpty();
});
