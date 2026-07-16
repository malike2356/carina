<?php

declare(strict_types=1);

use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;

it('shows the tenant settings hub for an authenticated user after onboarding', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Hub Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hub.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/settings')
        ->assertOk()
        ->assertSee('Settings', false)
        ->assertSee('Manage your workspace', false)
        ->assertSee('My profile', false);
});
