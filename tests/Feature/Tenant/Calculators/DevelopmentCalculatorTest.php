<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\User;
use App\Services\Deals\DevelopmentCalculatorService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true, 'tenant_overrides' => null]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

function developmentCalculatorPayload(): array
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

it('shows the development calculator page', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Dev Calc '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@dev-calc.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/deals/development-calculator')
        ->assertOk()
        ->assertSee('Development Deal Analyzer', false);
});

it('calculates via HTTP endpoint', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Dev Calc API '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@dev-calc-api.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/deals/development-calculator/calculate', developmentCalculatorPayload())
        ->assertOk()
        ->assertJsonPath('viability.is_viable', true);
});

it('saves development analysis to deal_analysis metrics', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Dev Calc Save '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@dev-calc-save.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $analysis = DealAnalysis::query()->create([
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Test development save',
        'metrics' => [],
        'status' => 'draft',
    ]);

    $calcResponse = app(DevelopmentCalculatorService::class)
        ->calculate(developmentCalculatorPayload());

    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/deals/development-calculator/save', [
        'deal_analysis_id' => $analysis->id,
        'inputs' => developmentCalculatorPayload(),
        'results' => $calcResponse,
    ])->assertOk()->assertJson(['saved' => true]);

    tenancy()->initialize($tenant);
    $analysis->refresh();
    expect(data_get($analysis->metrics, 'development.results.gdv.total'))->toBe(980000.0);
    tenancy()->end();
});
