<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformCarinaConversation;
use App\Models\Central\PlatformRole;
use App\Models\Central\PlatformUser;
use Spatie\Permission\PermissionRegistrar;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
    $this->superAdmin = PlatformUser::factory()->superAdmin()->create();
});

it('shows platform carina index for super admin', function (): void {
    $this->actingAs($this->superAdmin, 'platform')
        ->get(route('admin.carina.index'))
        ->assertOk()
        ->assertSee('Platform Carina', false);
});

it('starts a conversation and redirects to chat', function (): void {
    $this->actingAs($this->superAdmin, 'platform')
        ->post(route('admin.carina.start'))
        ->assertRedirect();

    expect(PlatformCarinaConversation::query()->count())->toBe(1);
});

it('returns not found when carina_ai feature is disabled', function (): void {
    FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => false]);

    try {
        $this->actingAs($this->superAdmin, 'platform')
            ->get(route('admin.carina.index'))
            ->assertNotFound();
    } finally {
        FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => true]);
    }
});

it('denies platform carina without use-platform-carina permission', function (): void {
    $user = PlatformUser::factory()->admin()->create();
    $role = PlatformRole::query()->where('name', 'admin')->where('guard_name', 'platform')->first();
    expect($role)->not->toBeNull();
    $role->revokePermissionTo('use-platform-carina');
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    try {
        $this->actingAs($user, 'platform')
            ->get(route('admin.carina.index'))
            ->assertForbidden();
    } finally {
        $role->givePermissionTo('use-platform-carina');
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
});
