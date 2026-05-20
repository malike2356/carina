<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
});

it('platform dashboard loads for super admin', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.dashboard'))
        ->assertOk()
        ->assertSee('Active Workspaces')
        ->assertSee('Inactive Workspaces')
        ->assertSee('New workspaces (30d)')
        ->assertSee('Paid subscriptions');
});

it('dashboard redirects for unauthenticated users', function (): void {
    $this->get(route('admin.dashboard'))
        ->assertRedirect(route('central.login'));
});

it('feature flags index loads', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.flags.index'))
        ->assertOk();
});

it('tenant index loads for super admin', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.saas-tenancy.index'))
        ->assertOk();
});

it('carina admin index loads', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.carina.index'))
        ->assertOk();
});

it('quick carina chat opens a new conversation', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.carina.chat'))
        ->assertRedirect();

    expect(\App\Models\Central\PlatformCarinaConversation::query()->where('platform_user_id', $admin->id)->count())->toBe(1);
});

it('platform admin header shows Ask Carina shortcut', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.dashboard'))
        ->assertOk()
        ->assertSee('Ask Carina', false);
});

it('revenue index loads', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.revenue.index'))
        ->assertOk();
});
