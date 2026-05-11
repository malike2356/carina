<?php

declare(strict_types=1);

use App\Models\Central\PlatformPermission;
use App\Models\Central\PlatformRole;
use App\Models\Central\PlatformUser;

beforeEach(function () {
    $this->roleManager = PlatformUser::factory()->superAdmin()->create();
});

it('shows grouped permission matrix on role edit', function () {
    $role = PlatformRole::query()->where('name', 'support')->where('guard_name', 'platform')->firstOrFail();

    $this->actingAs($this->roleManager, 'platform')
        ->get(route('admin.roles.edit', $role))
        ->assertOk()
        ->assertSee('Permission matrix')
        ->assertSee('Team and access')
        ->assertSee('manage-platform-users');
});

it('syncs permissions from matrix for a custom role', function () {
    $role = PlatformRole::query()->create([
        'name' => 'matrix_tester_'.uniqid(),
        'guard_name' => 'platform',
    ]);

    $names = ['view-saas-tenants', 'use-admin-search'];

    $this->actingAs($this->roleManager, 'platform')
        ->put(route('admin.roles.update', $role), [
            'name' => $role->name,
            'permissions' => $names,
        ])
        ->assertRedirect(route('admin.roles.index'));

    $role->refresh();
    expect($role->permissions->pluck('name')->sort()->values()->all())->toBe(collect($names)->sort()->values()->all());
});

it('clears permissions when matrix submits with none checked', function () {
    $role = PlatformRole::query()->create([
        'name' => 'matrix_empty_'.uniqid(),
        'guard_name' => 'platform',
    ]);
    $role->syncPermissions(PlatformPermission::query()->where('name', 'use-admin-search')->where('guard_name', 'platform')->get());
    expect($role->permissions)->not->toBeEmpty();

    $this->actingAs($this->roleManager, 'platform')
        ->put(route('admin.roles.update', $role), [
            'name' => $role->name,
        ])
        ->assertRedirect(route('admin.roles.index'));

    expect($role->fresh()->permissions)->toBeEmpty();
});

it('does not strip super_admin permissions when saving the role', function () {
    $role = PlatformRole::query()->where('name', 'super_admin')->where('guard_name', 'platform')->firstOrFail();
    $before = $role->permissions()->count();

    $this->actingAs($this->roleManager, 'platform')
        ->put(route('admin.roles.update', $role), [
            'name' => 'super_admin',
        ])
        ->assertRedirect(route('admin.roles.index'));

    expect($role->fresh()->permissions()->count())->toBe($before);
});
