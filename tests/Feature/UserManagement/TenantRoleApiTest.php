<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\TenantRole;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use App\Services\UserManagement\RolePermissionService;
use Illuminate\Support\Facades\Hash;

function tenantRoleApiHost(Tenant $tenant): string
{
    return $tenant->domains->first()->domain.'.propreneur.test';
}

it('lists roles for tenant admins with manage-roles permission', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Roles Index '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@roles-index.test',
        'plan' => 'starter',
    ]);

    $host = tenantRoleApiHost($tenant);

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $response = $this->getJson("http://{$host}/api/roles");

    $response->assertOk();
    $names = collect($response->json('data'))->pluck('name')->all();
    expect($names)->toContain('tenant_admin', 'team_member', 'viewer', 'mentor', 'mentee');
});

it('forbids role api for users without manage-roles', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Roles Deny '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@roles-deny.test',
        'plan' => 'starter',
    ]);

    $host = tenantRoleApiHost($tenant);

    tenancy()->initialize($tenant);
    $member = User::factory()->create([
        'email' => 'member@roles-deny.test',
        'password' => Hash::make('secret'),
    ]);
    app(RolePermissionService::class)->assignRole($member, 'team_member');
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($member, 'web');

    $this->getJson("http://{$host}/api/roles")->assertForbidden();
});

it('creates updates assigns revokes and deletes a custom role', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Roles CRUD '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@roles-crud.test',
        'plan' => 'starter',
    ]);

    $host = tenantRoleApiHost($tenant);

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    $subject = User::factory()->create([
        'email' => 'subject@roles-crud.test',
        'password' => Hash::make('secret'),
    ]);
    app(RolePermissionService::class)->assignRole($subject, 'viewer');
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $create = $this->postJson("http://{$host}/api/roles", [
        'name' => 'custom_auditor',
    ]);

    $create->assertCreated();
    $roleId = $create->json('data.id');

    $show = $this->getJson("http://{$host}/api/roles/{$roleId}");
    $show->assertOk()->assertJsonPath('data.name', 'custom_auditor');

    $this->putJson("http://{$host}/api/roles/{$roleId}", [
        'name' => 'custom_auditor_renamed',
        'permissions' => ['view-users'],
    ])->assertOk()->assertJsonPath('data.name', 'custom_auditor_renamed');

    $this->postJson("http://{$host}/api/roles/{$roleId}/assign", [
        'user_id' => $subject->id,
    ])->assertOk();

    tenancy()->initialize($tenant);
    expect($subject->fresh()->hasRole('custom_auditor_renamed'))->toBeTrue();
    tenancy()->end();

    $this->deleteJson("http://{$host}/api/roles/{$roleId}/users/{$subject->id}")
        ->assertOk();

    tenancy()->initialize($tenant);
    expect($subject->fresh()->hasRole('custom_auditor_renamed'))->toBeFalse();
    tenancy()->end();

    $this->deleteJson("http://{$host}/api/roles/{$roleId}")->assertNoContent();

    tenancy()->initialize($tenant);
    expect(TenantRole::query()->where('name', 'custom_auditor_renamed')->exists())->toBeFalse();
    tenancy()->end();
});

it('rejects deleting built-in workspace roles', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Roles Builtin '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@roles-builtin.test',
        'plan' => 'starter',
    ]);

    $host = tenantRoleApiHost($tenant);

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $builtInId = TenantRole::query()->where('name', 'tenant_admin')->where('guard_name', 'web')->value('id');
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $this->deleteJson("http://{$host}/api/roles/{$builtInId}")
        ->assertStatus(422)
        ->assertJsonPath('message', 'Built-in roles cannot be deleted.');
});
