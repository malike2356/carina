<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

function teamSettingsHost(Tenant $tenant): string
{
    return $tenant->domains->first()->domain.'.propreneur.test';
}

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('renders team settings for tenant admin when workspace admin api flag is on', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Team UI '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@team-ui.test',
        'plan' => 'starter',
    ]);

    $host = teamSettingsHost($tenant);

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $this->get("http://{$host}/settings/team")
        ->assertOk()
        ->assertSee('Workspace team', false)
        ->assertSee('workspaceTeam', false);
});

it('returns 404 for team settings when workspace admin api flag is off', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Team Off '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@team-off.test',
        'plan' => 'starter',
    ]);

    $host = teamSettingsHost($tenant);

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    FeatureFlag::query()->where('key', 'tenant_workspace_admin_api')->update(['enabled' => false]);

    $this->actingAs($admin, 'web');

    $this->get("http://{$host}/settings/team")->assertNotFound();
});

it('forbids team settings for non workspace admins', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Team Member '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@team-member-ui.test',
        'plan' => 'starter',
    ]);

    $host = teamSettingsHost($tenant);

    tenancy()->initialize($tenant);
    $staff = User::factory()->create(['email' => 'staff@team-member-ui.test']);
    $staff->syncRoles(['team_member']);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($staff, 'web');

    $this->get("http://{$host}/settings/team")->assertForbidden();
});
