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
        ->toHaveKeys(['strategy', 'outputs', 'assumptions', 'working', 'attribution', 'attribution_url', 'attribution_link_label', 'supported']);

    expect($result['strategy'])->toBe('btl');
    expect($result['supported'])->toBeTrue();
    expect($result['attribution'])->toContain('Xelox Properties');
    expect($result['attribution_url'])->toBe('https://xeloxproperties.co.uk/blog/');

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
        ->and($gross['xelox_slug'])->toContain('042-btl-gross-yield')
        ->and($gross['steps'])->not->toBeEmpty()
        ->and($gross['variables'])->not->toBeEmpty();

    // Per-step URLs are deliberately not exposed; only the slug is kept as
    // internal metadata. Citation links live on the single attribution.
    expect($gross)->not->toHaveKey('xelox_url');
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
        ->and($total['xelox_slug'])->toContain('035-standard-residential-sdlt');

    $effective = collect($result['working'])->firstWhere('key', 'effective_rate_pct');
    expect($effective)->not->toBeNull()
        ->and($effective['display_name'])->toBe('Effective SDLT Rate');
});

it('exposes the working route map on the registry', function () {
    $maps = DealCalculatorRegistry::publicHttpRouteMaps();
    expect($maps)->toHaveKeys(['calculate', 'sensitivity', 'working']);
    expect($maps['working'])->toHaveKeys([
        'btl', 'brr', 'hmo', 'r2r', 'sa', 'flip', 'bmv_no_money_down', 'commercial', 'development',
        'strategy_finder',
        'npv_irr', 'dscr', 'income_multiples', 'coc_roe', 'ltv', 'breakeven_occupancy',
        'sdlt', 'bridging', 'mortgage',
    ]);
});

it('builds show-working for every registered calculator strategy', function (string $slug) {
    $service = app(CalculatorWorkingService::class);
    expect($service->supports($slug))->toBeTrue();

    $payloads = [
        'btl' => ['purchase_price' => 250000, 'monthly_rent' => 1500, 'monthly_mortgage' => 850],
        'brr' => ['purchase_price' => 200000, 'refurb_cost' => 25000, 'post_refurb_value' => 280000],
        'hmo' => ['purchase_price' => 320000, 'rooms' => 5, 'rent_per_room_monthly' => 650],
        'r2r' => ['rent_per_room_monthly' => 700, 'subtenant_count' => 4, 'rent_to_landlord_monthly' => 1600],
        'sa' => ['nightly_rate' => 120, 'occupancy_pct' => 70],
        'flip' => ['purchase_price' => 180000, 'refurb_cost' => 35000, 'selling_price' => 265000],
        'bmv_no_money_down' => ['market_value' => 300000, 'purchase_price' => 190000],
        'commercial' => ['purchase_price' => 500000, 'monthly_rent' => 4000],
        'development' => [
            'purchase_price' => 400000, 'build_cost_per_unit' => 120000, 'unit_count' => 4,
            'average_unit_value' => 200000, 'average_monthly_rent' => 900, 'professional_fees' => 40000,
            'project_months' => 18, 'exit_preference' => 'sell',
        ],
        'strategy_finder' => [
            'capital_bucket' => '5k_to_25k',
            'primary_goal' => 'passive_income',
            'weekly_hours' => '2_to_5',
            'risk_tolerance' => 'medium',
            'pro_skills' => 'sales',
        ],
        'npv_irr' => ['cash_flows' => [-100000, 12000, 12000, 130000], 'discount_rate_annual' => 0.08],
        'dscr' => ['annual_noi' => 24000, 'annual_debt_service' => 18000],
        'income_multiples' => ['purchase_price' => 240000, 'monthly_rent' => 1200],
        'coc_roe' => ['annual_pre_tax_cash_flow' => 6000, 'total_cash_invested' => 60000],
        'ltv' => ['loan_amount' => 180000, 'property_value' => 250000],
        'breakeven_occupancy' => [
            'annual_operating_expenses' => 12000,
            'annual_debt_service' => 10000,
            'annual_gross_potential_income' => 30000,
        ],
        'sdlt' => ['purchase_price' => 300000, 'profile' => 'additional_property'],
        'bridging' => ['loan_amount' => 200000, 'annual_interest_rate' => 0.11, 'term_months' => 12],
        'mortgage' => ['loan_amount' => 180000, 'annual_interest_rate' => 0.055, 'term_years' => 25],
    ];

    $result = $service->buildFor($slug, $payloads[$slug]);
    expect($result['supported'])->toBeTrue()
        ->and($result['working'])->not->toBeEmpty();
})->with([
    'btl', 'brr', 'hmo', 'r2r', 'sa', 'flip', 'bmv_no_money_down', 'commercial', 'development',
    'strategy_finder',
    'npv_irr', 'dscr', 'income_multiples', 'coc_roe', 'ltv', 'breakeven_occupancy',
    'sdlt', 'bridging', 'mortgage',
]);

it('builds show-working steps for the R2R calculator with full operating and setup breakdown', function () {
    $service = app(CalculatorWorkingService::class);

    $result = $service->buildFor('r2r', [
        'rent_per_room_monthly' => 700,
        'subtenant_count' => 4,
        'rent_to_landlord_monthly' => 1600,
        'utilities_monthly' => 100,
        'council_tax_monthly' => 90,
        'insurance_monthly' => 25,
        'management_pct_rent' => 0.08,
        'maintenance_pct_rent' => 0.03,
        'cleaning_monthly' => 60,
        'compliance_monthly' => 50,
        'void_months_subrent' => 1,
        'landlord_deposit' => 3200,
        'furnishing_setup' => 4500,
    ]);

    expect($result['supported'])->toBeTrue();

    $keys = collect($result['working'])->pluck('key')->all();
    expect($keys)->toContain(
        'annual_gross_income',
        'rent_difference_monthly',
        'gross_margin_pct',
        'monthly_operating_costs',
        'monthly_profit',
        'annual_profit',
        'net_margin_pct',
        'operating_cost_ratio_pct',
        'breakeven_occupancy_pct',
        'profit_per_door',
        'setup_costs_total',
        'return_on_setup_capital_pct',
        'setup_recovery_months',
        'ten_percent_rule_pass',
        'minimum_income_rule_pass',
    );

    $opex = collect($result['working'])->firstWhere('key', 'monthly_operating_costs');
    $opexVarNames = collect($opex['variables'] ?? [])->pluck('name')->all();
    expect($opex['steps'])->not->toBeEmpty()
        ->and($opexVarNames)->toContain('Management');
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

it('returns working JSON via the public working endpoint for R2R', function () {
    $response = $this->postJson(route('public.calculators.working', ['slug' => 'r2r']), [
        'rent_per_room_monthly' => 700,
        'subtenant_count' => 4,
        'rent_to_landlord_monthly' => 1600,
        'utilities_monthly' => 100,
        'council_tax_monthly' => 90,
        'insurance_monthly' => 25,
        'management_pct_rent' => 0.08,
        'maintenance_pct_rent' => 0.03,
        'cleaning_monthly' => 60,
        'compliance_monthly' => 50,
        'void_months_subrent' => 1,
        'landlord_deposit' => 3200,
        'furnishing_setup' => 4500,
    ]);

    $response->assertOk()
        ->assertJsonPath('strategy', 'r2r')
        ->assertJsonPath('supported', true);

    $keys = collect($response->json('working'))->pluck('key')->all();
    expect($keys)->toContain('monthly_operating_costs', 'breakeven_occupancy_pct', 'setup_costs_total');
});

it('returns 422 with validation errors when required BTL inputs are missing', function () {
    $response = $this->postJson(route('public.calculators.working', ['slug' => 'btl']), []);
    $response->assertStatus(422)
        ->assertJsonStructure(['errors' => ['purchase_price', 'monthly_rent']]);
});
