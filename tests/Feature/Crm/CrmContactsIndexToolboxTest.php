<?php

declare(strict_types=1);

use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('shows CRM import export toolbox on contacts index', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'CRM Index UI '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@crm-index-ui.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/contacts')
        ->assertOk()
        ->assertSee('Import / export', false)
        ->assertSee('Import contacts from CSV', false)
        ->assertSee('crmContactsToolbox', false);
});
