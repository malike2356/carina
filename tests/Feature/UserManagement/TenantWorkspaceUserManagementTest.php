<?php

declare(strict_types=1);

use App\Mail\Tenant\UserInvitationMail;
use App\Models\Central\Tenant;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use App\Services\UserManagement\RolePermissionService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

function userMgmtTenantHost(Tenant $tenant): string
{
    return $tenant->domains->first()->domain.'.propreneur.test';
}

it('allows tenant admin to create list update and delete users via json api', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'User API '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@user-api.test',
        'plan' => 'starter',
    ]);

    $host = userMgmtTenantHost($tenant);

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    $admin->password = Hash::make('secret');
    $admin->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $create = $this->postJson("http://{$host}/api/users", [
        'name' => 'Team Member One',
        'email' => 'member@user-api.test',
        'password' => 'password1!',
        'password_confirmation' => 'password1!',
        'role_name' => 'team_member',
    ]);

    $create->assertCreated()
        ->assertJsonPath('data.email', 'member@user-api.test');

    $memberId = $create->json('data.id');

    $this->getJson("http://{$host}/api/users")->assertOk();

    $this->putJson("http://{$host}/api/users/{$memberId}", [
        'name' => 'Team Member Updated',
    ])->assertOk()->assertJsonPath('data.name', 'Team Member Updated');

    $this->deleteJson("http://{$host}/api/users/{$memberId}")->assertNoContent();
});

it('returns 422 when tenant admin deletes own account via api', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Self Delete '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@self-delete.test',
        'plan' => 'starter',
    ]);

    $host = userMgmtTenantHost($tenant);

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $this->deleteJson("http://{$host}/api/users/{$admin->id}")
        ->assertStatus(422)
        ->assertJsonPath('message', 'You cannot delete your own account.');
});

it('blocks non tenant admin roles from workspace admin api', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Team Member Block '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@team-block.test',
        'plan' => 'starter',
    ]);

    $host = userMgmtTenantHost($tenant);

    tenancy()->initialize($tenant);
    $staff = User::factory()->create([
        'email' => 'staff@team-block.test',
        'password' => Hash::make('secret'),
    ]);
    app(RolePermissionService::class)->assignRole($staff, 'team_member');
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($staff, 'web');

    $this->getJson("http://{$host}/api/users")->assertForbidden();
});

it('sends invitation mail accepts invite and rejects invalid tokens', function () {
    Mail::fake();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Invite Flow '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@invite-flow.test',
        'plan' => 'starter',
    ]);

    $host = userMgmtTenantHost($tenant);

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    $admin->password = Hash::make('secret');
    $admin->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $this->postJson("http://{$host}/api/invitations", [
        'email' => 'invitee@invite-flow.test',
        'role_name' => 'viewer',
    ])->assertOk()->assertJsonPath('message', 'Invitation sent.');

    Mail::assertSent(UserInvitationMail::class);

    $plainToken = null;
    Mail::assertSent(UserInvitationMail::class, function (UserInvitationMail $mail) use (&$plainToken): bool {
        $plainToken = $mail->plainToken;

        return $mail->invitation->email === 'invitee@invite-flow.test';
    });

    expect($plainToken)->not->toBeEmpty();

    Auth::guard('web')->logout();

    $this->get("http://{$host}/invitations/{$plainToken}")->assertOk();

    $this->post("http://{$host}/invitations/{$plainToken}/accept", [
        'name' => 'Invited Viewer',
        'password' => 'newpass1!',
        'password_confirmation' => 'newpass1!',
    ])->assertRedirect(route('tenant.login'));

    tenancy()->initialize($tenant);
    try {
        $created = User::query()->where('email', 'invitee@invite-flow.test')->firstOrFail();
        expect($created->hasRole('viewer'))->toBeTrue();
        expect($created->accepted_at)->not->toBeNull();
    } finally {
        tenancy()->end();
    }

    $this->get("http://{$host}/invitations/notarealtoken")->assertRedirect(route('tenant.login'));
});
