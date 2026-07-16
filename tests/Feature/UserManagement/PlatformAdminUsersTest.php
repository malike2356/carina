<?php

declare(strict_types=1);

use App\Models\Central\PlatformUser;
use Illuminate\Support\Facades\Auth;

it('allows authorised platform admins to view the user manager', function () {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.users.index'))
        ->assertOk();
});

it('blocks platform support staff without manage-platform-users from user manager', function () {
    $support = PlatformUser::factory()->create([
        'role' => PlatformUser::ROLE_SUPPORT,
    ]);

    $this->actingAs($support, 'platform')
        ->get(route('admin.users.index'))
        ->assertForbidden();
});

it('allows super admin to impersonate another active platform user', function () {
    $super = PlatformUser::factory()->superAdmin()->create();
    $target = PlatformUser::factory()->admin()->create(['is_active' => true]);

    $this->actingAs($super, 'platform')
        ->post(route('admin.users.impersonate', $target))
        ->assertRedirect(route('admin.dashboard'));

    expect(Auth::guard('platform')->id())->toBe($target->id);
    expect(session('platform_impersonator_id'))->toBe($super->id);
});

it('blocks impersonation without impersonate permission', function () {
    $admin = PlatformUser::factory()->admin()->create(['is_active' => true]);
    $target = PlatformUser::factory()->admin()->create(['is_active' => true]);

    $this->actingAs($admin, 'platform')
        ->post(route('admin.users.impersonate', $target))
        ->assertForbidden();
});

it('allows platform admin with manage permission to delete another user', function () {
    $admin = PlatformUser::factory()->superAdmin()->create();
    $victim = PlatformUser::factory()->admin()->create();

    $this->actingAs($admin, 'platform')
        ->delete(route('admin.users.destroy', $victim))
        ->assertRedirect(route('admin.users.index'));

    expect(PlatformUser::query()->whereKey($victim->id)->exists())->toBeFalse();
});
