<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\DealCalculatorLog;
use App\Models\Tenant\User;
use App\Services\Deals\Calculators\DealCalculatorRegistry;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('exposes registered calculators with strategy finder first in playground nav', function () {
    expect(DealCalculatorRegistry::STRATEGIES)->toHaveCount(19)
        ->and(DealCalculatorRegistry::playgroundNav())->toHaveCount(19)
        ->and(DealCalculatorRegistry::playgroundNav()[0]['slug'])->toBe('strategy_finder');
});

it('returns BTL calculator outputs as JSON', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $response = $this->postJson('http://'.$host.'/deals/calculate/btl', [
        'purchase_price' => 250000,
        'monthly_rent' => 1500,
        'monthly_mortgage' => 500,
    ]);

    $response->assertOk()
        ->assertJsonPath('strategy', 'btl')
        ->assertJsonStructure(['outputs', 'assumptions', 'duration_ms']);

    expect((float) $response->json('outputs.monthly_cashflow'))->toBeGreaterThan(0.0);

    tenancy()->initialize($tenant);
    expect(DealCalculatorLog::query()->count())->toBe(1)
        ->and(DealCalculatorLog::query()->first()->created_by)->toBe($user->id);
    tenancy()->end();
});

it('links calculator log to deal when deal_analysis_id is owned by user', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc.test',
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
        'title' => 'Linked calc',
        'metrics' => [],
        'status' => 'draft',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/deals/calculate/btl', [
        'deal_analysis_id' => $deal->id,
        'purchase_price' => 200000,
        'monthly_rent' => 1000,
    ])->assertOk();

    tenancy()->initialize($tenant);
    $log = DealCalculatorLog::query()->firstOrFail();
    expect($log->deal_analysis_id)->toBe($deal->id);
    tenancy()->end();
});

it('returns 403 when deal_analysis_id belongs to another user', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $owner = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $other = User::factory()->create();

    $deal = DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $other->id,
        'strategy' => 'btl',
        'title' => 'Other user deal',
        'metrics' => [],
        'status' => 'draft',
    ]);
    tenancy()->end();

    $this->actingAs($owner, 'web');

    $this->postJson('http://'.$host.'/deals/calculate/btl', [
        'deal_analysis_id' => $deal->id,
        'purchase_price' => 200000,
        'monthly_rent' => 1000,
    ])->assertForbidden();
});

it('returns commercial calculator outputs as JSON', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/deals/calculate/commercial', [
        'purchase_price' => 400000,
        'monthly_rent' => 2800,
        'monthly_mortgage' => 1200,
    ])->assertOk()
        ->assertJsonPath('strategy', 'commercial')
        ->assertJsonStructure(['outputs', 'assumptions', 'duration_ms']);
});

it('returns commercial sensitivity grid as JSON', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/deals/calculate/sensitivity/commercial', [
        'purchase_price' => 350000,
        'monthly_rent' => 2200,
        'monthly_mortgage' => 900,
    ])->assertOk()
        ->assertJsonPath('strategy', 'commercial')
        ->assertJsonStructure(['scenarios']);
});

it('returns BTL sensitivity grid as JSON', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $response = $this->postJson('http://'.$host.'/deals/calculate/sensitivity/btl', [
        'purchase_price' => 200000,
        'monthly_rent' => 1000,
    ]);

    $response->assertOk()
        ->assertJsonPath('strategy', 'btl')
        ->assertJsonStructure(['scenarios']);
});

it('returns NPV and IRR calculator JSON', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();
    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/deals/calculate/npv_irr', [
        'cash_flows' => [-100000, 12000, 12000, 12000, 12000, 130000],
        'discount_rate_annual' => 0.08,
    ])->assertOk()
        ->assertJsonPath('strategy', 'npv_irr')
        ->assertJsonStructure(['outputs', 'assumptions'])
        ->assertJsonPath('outputs.periods', 6);
});

it('returns DSCR calculator JSON', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();
    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/deals/calculate/dscr', [
        'annual_noi' => 50000,
        'annual_debt_service' => 32000,
    ])->assertOk()
        ->assertJsonPath('strategy', 'dscr')
        ->assertJsonPath('outputs.dscr', 1.5625)
        ->assertJsonPath('outputs.passes_1_25x', true);
});

it('returns income multiples calculator JSON', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();
    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/deals/calculate/income_multiples', [
        'purchase_price' => 240000,
        'monthly_rent' => 1200,
        'annual_operating_expenses' => 4800,
    ])->assertOk()
        ->assertJsonPath('strategy', 'income_multiples')
        ->assertJsonPath('outputs.grm', 16.6667);
});

it('returns CoC and ROE calculator JSON', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();
    $this->actingAs($user, 'web');

    $res = $this->postJson('http://'.$host.'/deals/calculate/coc_roe', [
        'annual_pre_tax_cash_flow' => 9000,
        'total_cash_invested' => 60000,
        'annual_net_income_equity' => 8000,
        'current_equity' => 80000,
    ]);

    $res->assertOk()->assertJsonPath('strategy', 'coc_roe');
    $payload = $res->json();
    expect($payload['outputs']['coc_pct'])->toEqual(15.0)
        ->and($payload['outputs']['roe_pct'])->toEqual(10.0);
});

it('returns LTV calculator JSON', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();
    $this->actingAs($user, 'web');

    $ltvRes = $this->postJson('http://'.$host.'/deals/calculate/ltv', [
        'loan_amount' => 187500,
        'property_value' => 250000,
    ]);
    $ltvRes->assertOk()
        ->assertJsonPath('strategy', 'ltv');
    expect((float) $ltvRes->json('outputs.ltv_pct'))->toBe(75.0);
});

it('returns breakeven occupancy calculator JSON', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();
    $this->actingAs($user, 'web');

    $beRes = $this->postJson('http://'.$host.'/deals/calculate/breakeven_occupancy', [
        'annual_operating_expenses' => 6000,
        'annual_debt_service' => 12000,
        'annual_gross_potential_income' => 24000,
    ]);
    $beRes->assertOk()
        ->assertJsonPath('strategy', 'breakeven_occupancy');
    expect((float) $beRes->json('outputs.breakeven_occupancy_pct'))->toBe(75.0);
});

it('returns SDLT calculator JSON', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();
    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/deals/calculate/sdlt', [
        'purchase_price' => 300_000,
        'profile' => 'standard',
    ])->assertOk()
        ->assertJsonPath('strategy', 'sdlt')
        ->assertJsonPath('outputs.sdlt_total', 2500);
});

it('returns bridging calculator JSON', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();
    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/deals/calculate/bridging', [
        'loan_amount' => 200_000,
        'annual_interest_rate' => 0.1,
        'term_months' => 12,
    ])->assertOk()
        ->assertJsonPath('strategy', 'bridging')
        ->assertJsonPath('outputs.interest_cost', 20_000);
});

it('returns mortgage calculator JSON', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();
    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/deals/calculate/mortgage', [
        'loan_amount' => 180_000,
        'annual_interest_rate' => 0.06,
        'term_years' => 25,
        'interest_only' => true,
    ])->assertOk()
        ->assertJsonPath('strategy', 'mortgage')
        ->assertJsonPath('outputs.interest_only', true);
});

it('returns 422 when sensitivity is requested for a financial-only calculator', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();
    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/deals/calculate/sensitivity/npv_irr', [
        'cash_flows' => [-100, 40, 40, 40],
        'discount_rate_annual' => 0.1,
    ])->assertStatus(422)
        ->assertJsonPath('message', 'No sensitivity grid is defined for this calculator.');

    $this->postJson('http://'.$host.'/deals/calculate/sensitivity/sdlt', [
        'purchase_price' => 300_000,
        'profile' => 'standard',
    ])->assertStatus(422);
});
