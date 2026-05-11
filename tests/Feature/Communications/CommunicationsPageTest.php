<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;

it('serves communications hub when feature flag is on', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Comms UI '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@comms-ui.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'communications_hub')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/communications')
        ->assertOk()
        ->assertSee('Sequences', false)
        ->assertSee('investor_deal_won', false);
});
