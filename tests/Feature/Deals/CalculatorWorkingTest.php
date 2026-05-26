<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Services\Deals\Calculators\DealCalculatorRegistry;
use App\Services\Deals\CalculatorWorking\CalculatorWorkingService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('builds show-working steps for the BTL calculator', function () {
    $service = app(CalculatorWorkingService::class);

    $result = $service->buildFor('btl', [
        'purchase_price' => 250_000,
        'monthly_rent' => 1_500,
        'monthly_mortgage' => 500,
    ]);

    expect($result)
        ->toHaveKeys(['strategy', 'outputs', 'assumptions', 'working', 'attribution', 'supported']);

    expect($result['strategy'])->toBe('btl');
    expect($result['supported'])->toBeTrue();
    expect($result['attribution'])->toContain('Xelox Properties');

    $keys = collect($result['working'])->pluck('key')->all();
    expect($keys)->toContain(
        'gross_yield_pct',
        'annual_costs_total',
        'net_yield_pct',
        'monthly_cashflow',
        'roi_pct',
        'stamp_duty_computed',
        'mortgage_stress_pass',
    );

    $gross = collect($result['working'])->firstWhere('key', 'gross_yield_pct');
    expect($gross['display_name'])->toBe('BTL Gross Yield')
        ->and($gross['unit'])->toBe('%')
        ->and($gross['formula'])->toContain('Monthly Rent')
        ->and($gross['xelox_url'])->toContain('042-btl-gross-yield')
        ->and($gross['steps'])->not->toBeEmpty()
        ->and($gross['variables'])->not->toBeEmpty();
});

it('builds show-working steps for the SDLT calculator with profile-specific bands', function () {
    $service = app(CalculatorWorkingService::class);

    $result = $service->buildFor('sdlt', [
        'purchase_price' => 300_000,
        'profile' => 'standard',
    ]);

    expect($result['supported'])->toBeTrue();

    // Under the registry's standard residential bands (0% up to £250k, 5% to
    // £925k…) a £300k purchase produces £2,500 of SDLT — 5% on the £50k slice.
    $total = collect($result['working'])->firstWhere('key', 'sdlt_total');
    expect($total)->not->toBeNull()
        ->and($total['value'])->toContain('2,500')
        ->and($total['formula'])->toContain('0% × £0–£250k')
        ->and($total['xelox_url'])->toContain('035-standard-residential-sdlt');

    $effective = collect($result['working'])->firstWhere('key', 'effective_rate_pct');
    expect($effective)->not->toBeNull()
        ->and($effective['display_name'])->toBe('Effective SDLT Rate');
});

it('exposes the working route map on the registry', function () {
    $maps = DealCalculatorRegistry::publicHttpRouteMaps();
    expect($maps)->toHaveKeys(['calculate', 'sensitivity', 'working']);
    expect($maps['working'])->toHaveKeys(['btl', 'hmo', 'sdlt', 'brr', 'sa']);
});

it('rejects unsupported strategies with 404 on the public working endpoint', function () {
    $response = $this->postJson(route('public.calculators.working', ['slug' => 'nope-not-a-strategy']), [
        'purchase_price' => 100_000,
    ]);
    $response->assertNotFound();
});

it('returns working JSON via the public working endpoint for BTL', function () {
    $response = $this->postJson(route('public.calculators.working', ['slug' => 'btl']), [
        'purchase_price' => 250_000,
        'monthly_rent' => 1_500,
    ]);

    $response->assertOk()
        ->assertJsonPath('strategy', 'btl')
        ->assertJsonPath('supported', true)
        ->assertJsonStructure(['working', 'attribution', 'outputs', 'assumptions']);

    expect($response->json('working'))->not->toBeEmpty();
});

it('returns 422 with validation errors when required BTL inputs are missing', function () {
    $response = $this->postJson(route('public.calculators.working', ['slug' => 'btl']), []);
    $response->assertStatus(422)
        ->assertJsonStructure(['errors' => ['purchase_price', 'monthly_rent']]);
});
