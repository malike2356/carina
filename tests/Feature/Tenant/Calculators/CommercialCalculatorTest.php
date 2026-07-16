<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Deals\CommercialDealCalculatorService;
use App\Services\Property\PropertyFinancialService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('calculates commercial SDLT at two hundred thousand pounds as one thousand', function () {
    $sdlt = app(PropertyFinancialService::class)->stampDutyCommercial(200_000);

    expect($sdlt)->toBe(1000.0);
});

it('calculates commercial SDLT at three hundred thousand pounds as four thousand five hundred', function () {
    $sdlt = app(PropertyFinancialService::class)->stampDutyCommercial(300_000);

    // 0% on £150k + 2% on £100k + 5% on £50k
    expect($sdlt)->toBe(4500.0);
});

it('calculates net initial yield from passing rent minus costs over purchase price', function () {
    $service = app(CommercialDealCalculatorService::class);

    $result = $service->calculate([
        'purchase_price' => 500_000,
        'passing_rent_annual' => 40_000,
        'erv_annual' => 40_000,
        'management_pct_rent' => 0,
        'void_allowance_pct' => 0,
        'maintenance_reserve_pct' => 0,
        'insurance_annual' => 5_000,
        'mortgage_amount' => 0,
    ]);

    // (40000 - 5000) / 500000 = 7%
    expect($result['outputs']['net_initial_yield_pct'])->toBe(7.0);
});

it('calculates WAULT weighted by rent from two tenants', function () {
    $service = app(CommercialDealCalculatorService::class);
    $today = now()->startOfDay();

    $leases = [
        [
            'tenant_name' => 'Anchor tenant',
            'annual_rent' => 30_000,
            'lease_expiry' => $today->copy()->addYears(10)->toDateString(),
        ],
        [
            'tenant_name' => 'Small unit',
            'annual_rent' => 10_000,
            'lease_expiry' => $today->copy()->addYears(2)->toDateString(),
        ],
    ];

    $wault = $service->waultYears($leases);

    // (10 * 30000 + 2 * 10000) / 40000 = 8 years
    expect(round($wault, 1))->toBe(8.0);
});

it('increases capital value when vacancy fill scenario reaches ERV', function () {
    $service = app(CommercialDealCalculatorService::class);

    $result = $service->calculate([
        'purchase_price' => 400_000,
        'passing_rent_annual' => 15_000,
        'erv_annual' => 40_000,
        'vacancy_status' => 'partially_let',
        'number_of_units' => 4,
        'units_occupied' => 2,
        'rent_per_unit_annual' => 10_000,
        'target_yield_pct' => 8,
        'management_pct_rent' => 0,
        'void_allowance_pct' => 0,
        'maintenance_reserve_pct' => 0,
        'mortgage_amount' => 0,
    ]);

    $passingCapital = round(15_000 / 0.08, 2);
    $fillCapital = (float) $result['outputs']['value_add_scenarios']['fill_vacancy']['capital_value'];

    expect($fillCapital)->toBeGreaterThan($passingCapital);
});

it('returns commercial calculator JSON via tenant API', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Commercial Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@commercial.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $response = $this->postJson('http://'.$host.'/deals/calculate/commercial', [
        'purchase_price' => 500_000,
        'passing_rent_annual' => 35_000,
        'erv_annual' => 42_000,
        'mortgage_amount' => 350_000,
        'mortgage_rate_annual' => 0.055,
        'interest_only' => true,
    ]);

    $response->assertOk()
        ->assertJsonPath('strategy', 'commercial')
        ->assertJsonStructure([
            'outputs' => [
                'net_initial_yield_pct',
                'wault_years',
                'stamp_duty_computed',
                'value_add_scenarios',
            ],
        ]);

    expect((float) $response->json('outputs.stamp_duty_computed'))->toBe(14_500.0);
});
