<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\User;
use App\Services\Deals\Calculators\SaVsBtlCalculatorService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true, 'tenant_overrides' => null]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

function saVsBtlBaseInputs(): array
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

it('shows the SA vs BTL calculator page', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'SA BTL '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@sa-btl.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/deals/calculators/sa-vs-btl')
        ->assertOk()
        ->assertSee('SA vs BTL Strategy Calculator', false)
        ->assertSee('Side-by-side comparison', false);
});

it('returns higher SA ROI when nightly rate and occupancy are strong', function (): void {
    $service = app(SaVsBtlCalculatorService::class);
    $base = saVsBtlBaseInputs();

    $result = $service->calculate($base);

    expect($result['sa']['net_roi_pct'])->toBeGreaterThan($result['btl']['net_roi_pct'])
        ->and($result['comparison']['better_roi_model'])->toBe('sa');
});

it('allows high SA fees to narrow or reverse the gap versus BTL', function (): void {
    $service = app(SaVsBtlCalculatorService::class);
    $base = saVsBtlBaseInputs();
    $base['nightly_rate'] = 70;
    $base['occupancy_pct'] = 55;
    $base['sa_management_fee_pct'] = 25;
    $base['platform_commission_pct'] = 15;
    $base['cleaning_cost_per_stay'] = 80;

    $result = $service->calculate($base);

    expect($result['sa']['net_annual_income'])->toBeLessThan($result['btl']['net_annual_income']);
});

it('produces zero SA gross revenue at zero occupancy without division errors', function (): void {
    $service = app(SaVsBtlCalculatorService::class);
    $base = saVsBtlBaseInputs();
    $base['occupancy_pct'] = 0;
    $base['nightly_rate'] = 150;

    $result = $service->calculate($base);

    expect($result['sa']['gross_annual_income'])->toBe(0.0)
        ->and($result['sa']['net_annual_income'])->toBeLessThanOrEqual(0.0);
});

it('calculates via HTTP and saves snapshot on linked deal', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'SA BTL API '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@sa-btl-api.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $deal = DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Compare me',
        'metrics' => ['asking_price' => 180000, 'monthly_rent' => 1100],
        'status' => 'draft',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $payload = array_merge(saVsBtlBaseInputs(), ['deal_analysis_id' => $deal->id]);

    $this->postJson('http://'.$host.'/deals/calculators/sa-vs-btl/calculate', $payload)
        ->assertOk()
        ->assertJsonPath('saved_to_deal', true)
        ->assertJsonStructure(['result' => ['btl', 'sa', 'comparison', 'shared']]);

    tenancy()->initialize($tenant);
    $fresh = DealAnalysis::query()->findOrFail($deal->id);
    expect(data_get($fresh->metrics, 'sa_vs_btl_last.result.comparison.better_roi_model'))->not->toBeNull();
    tenancy()->end();
});
