<?php

declare(strict_types=1);

use App\Mail\Tenant\UserInvitationMail;
use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaModuleToolDispatcher;
use App\Services\Carina\ToolHandlers\AdminHandler;
use App\Services\Tenancy\TenantCreationService;
use App\Services\UserManagement\RolePermissionService;
use App\Services\UserManagement\TenantUserService;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

/**
 * @return array{0: Tenant, 1: User}
 */
function adminHandlerTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Admin Handler '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@adminhandler.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $user];
}

function adminHandlerConversation(Tenant $tenant, User $user): CarinaConversation
{
    return CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Admin handler test',
    ]);
}

it('subscription_info returns plan and usage snapshot', function (): void {
    [$tenant, $user] = adminHandlerTenant();
    tenancy()->initialize($tenant);

    $conversation = adminHandlerConversation($tenant, $user);

    $result = app(AdminHandler::class)->handle(
        'subscription_info',
        [],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['plan'])->toBe('starter')
        ->and($result->data['usage'])->toHaveKeys(['properties', 'active_tenancies', 'team_members']);

    tenancy()->end();
});

it('invite_team_member sends invitation email for workspace admin', function (): void {
    Mail::fake();

    [$tenant, $user] = adminHandlerTenant();
    tenancy()->initialize($tenant);

    $conversation = adminHandlerConversation($tenant, $user);

    $result = app(AdminHandler::class)->handle(
        'invite_team_member',
        [
            'email' => 'new-member@adminhandler.test',
            'name' => 'New Member',
            'role' => 'viewer',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['role'])->toBe('viewer');

    Mail::assertSent(UserInvitationMail::class, function (UserInvitationMail $mail): bool {
        return $mail->invitation->email === 'new-member@adminhandler.test';
    });

    tenancy()->end();
});

it('invite_team_member is blocked for non-admin users', function (): void {
    [$tenant, $user] = adminHandlerTenant();
    tenancy()->initialize($tenant);

    $staff = User::factory()->create([
        'email' => 'staff@adminhandler.test',
        'password' => Hash::make('secret'),
    ]);
    app(RolePermissionService::class)->assignRole($staff, 'team_member');

    $conversation = adminHandlerConversation($tenant, $staff);

    $result = app(AdminHandler::class)->handle(
        'invite_team_member',
        ['email' => 'blocked@adminhandler.test', 'role' => 'viewer'],
        $staff,
        $conversation,
    );

    expect($result->success)->toBeFalse()
        ->and($result->error)->toBe('forbidden');

    tenancy()->end();
});

it('list_team_members returns workspace users', function (): void {
    [$tenant, $user] = adminHandlerTenant();
    tenancy()->initialize($tenant);

    $conversation = adminHandlerConversation($tenant, $user);

    $result = app(AdminHandler::class)->handle(
        'list_team_members',
        [],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['total'])->toBeGreaterThanOrEqual(1)
        ->and($result->data['members'][0])->toHaveKeys(['id', 'name', 'email', 'roles']);

    tenancy()->end();
});

it('remove_team_member deletes user by email', function (): void {
    [$tenant, $user] = adminHandlerTenant();
    tenancy()->initialize($tenant);

    $member = app(TenantUserService::class)->createUser([
        'name' => 'Remove Me',
        'email' => 'remove-me@adminhandler.test',
        'password' => 'password1!',
        'role_name' => 'viewer',
    ]);

    $conversation = adminHandlerConversation($tenant, $user);

    $result = app(AdminHandler::class)->handle(
        'remove_team_member',
        ['email' => 'remove-me@adminhandler.test'],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and(User::query()->find($member->id))->toBeNull();

    tenancy()->end();
});

it('workspace_settings returns workspace metadata', function (): void {
    [$tenant, $user] = adminHandlerTenant();
    tenancy()->initialize($tenant);

    $conversation = adminHandlerConversation($tenant, $user);

    $result = app(AdminHandler::class)->handle(
        'workspace_settings',
        [],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['workspace_name'])->not->toBeEmpty()
        ->and($result->data['plan'])->toBe('starter');

    tenancy()->end();
});

it('registers admin tools in the dispatcher', function (): void {
    [$tenant, $user] = adminHandlerTenant();
    tenancy()->initialize($tenant);

    $conversation = adminHandlerConversation($tenant, $user);
    $dispatcher = app(CarinaModuleToolDispatcher::class);

    $result = $dispatcher->dispatch('workspace_settings', [], $user, $conversation);

    expect($result->success)->toBeTrue();

    tenancy()->end();
});
