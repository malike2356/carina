<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Deals\Calculators\DealCalculatorRegistry;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update([
        'enabled' => true,
        'tenant_overrides' => null,
    ]);
});

it('shows calculators workbench with hub nav and inline pane', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Hub '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc-hub.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/deals/calculators')
        ->assertOk()
        ->assertSee('All calculators', false)
        ->assertSee('Deal strategies', false)
        ->assertSee('Financial tools', false)
        ->assertSee('Buy-to-Let', false)
        ->assertSee('SDLT', false)
        ->assertSee('Refurb costing', false)
        ->assertSee('SA vs BTL comparison', false)
        ->assertSee('calculatorDrawer(', false)
        ->assertSee('calculator-open', false)
        ->assertSee('data-calc-slug', false)
        ->assertSee('aria-modal="true"', false)
        ->assertDontSee('Quick links', false)
        ->assertDontSee('<iframe', false);
});

it('exposes a non-empty heroicon path for every registered calculator slug', function (): void {
    foreach (DealCalculatorRegistry::STRATEGIES as $slug) {
        expect(DealCalculatorRegistry::iconPath($slug))
            ->toBeString()
            ->not->toBeEmpty();
    }
});

it('exposes a UK brief for every deal strategy slug', function (): void {
    foreach (DealCalculatorRegistry::DEAL_STRATEGY_SLUGS as $slug) {
        expect(DealCalculatorRegistry::ukBrief($slug))
            ->toBeString()
            ->not->toBeEmpty();
    }
});

it('returns no UK brief for financial-tool slugs', function (): void {
    $strategies = DealCalculatorRegistry::DEAL_STRATEGY_SLUGS;
    $tools = array_values(array_diff(DealCalculatorRegistry::STRATEGIES, $strategies));

    foreach ($tools as $slug) {
        expect(DealCalculatorRegistry::ukBrief($slug))->toBe('');
    }
});

it('serves the drawer pane fragment for a strategy slug', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Pane '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc-pane.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $response = $this->get('http://'.$host.'/deals/calculators/btl/pane');
    $response->assertOk()
        ->assertHeader('Content-Type', 'text/html; charset=UTF-8')
        ->assertSee('UK context', false)
        ->assertSee('Run calculator', false)
        ->assertSee('window.__CALC_PANE_CONFIG__', false)
        ->assertDontSee('<html', false);
});

it('returns no UK context block for a financial-tool pane', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Pane Tool '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc-pane-tool.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/deals/calculators/sdlt/pane')
        ->assertOk()
        ->assertSee('Run calculator', false)
        ->assertDontSee('UK context', false);
});

it('redirects legacy calculator slug URL to workbench with model query', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Redirect '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc-redirect.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/deals/calculators/btl')
        ->assertRedirect('http://'.$host.'/deals/calculators?model=btl');
});

it('serves embed pane for BTL inside minimal layout', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Embed '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc-embed.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/deals/calculators/btl/embed')
        ->assertOk()
        ->assertSee('Buy-to-Let', false)
        ->assertSee('Run calculator', false)
        ->assertSee('runSensitivity()', false);
});

it('embeds SDLT without sensitivity button', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Sdlt '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc-sdlt.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/deals/calculators/sdlt/embed')
        ->assertOk()
        ->assertSee('SDLT', false)
        ->assertDontSee('runSensitivity()', false);
});

it('embeds DSCR without sensitivity button', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Dscr '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc-dscr.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/deals/calculators/dscr/embed')
        ->assertOk()
        ->assertSee('DSCR', false)
        ->assertDontSee('runSensitivity()', false);
});
