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
        ->assertSee('id="calculator-workspace"', false)
        ->assertSee('#calculator-workspace', false)
        ->assertSee('Run calculator', false)
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
