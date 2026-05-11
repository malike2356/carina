<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;

it('serves workspace automation settings for tenant admins', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Automation UI '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@automation-ui.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'tenant_workspace_admin_api')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/settings/automation')
        ->assertOk()
        ->assertSee('Workspace automation', false)
        ->assertSee('Run log', false);
});
