<?php

use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;
use App\Services\UI\Contracts\ThemeServiceInterface;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'admin_design_system_lab')->update([
        'enabled' => true,
        'tenant_overrides' => null,
    ]);

    $this->superAdmin = PlatformUser::factory()->superAdmin()->create();
});

it('renders the theme settings page for super_admin', function () {
    $this->actingAs($this->superAdmin, 'platform')
        ->get(route('admin.ui.theme'))
        ->assertOk()
        ->assertViewIs('central.admin.ui.theme')
        ->assertViewHas('theme')
        ->assertViewHas('themes')
        ->assertViewHas('fonts')
        ->assertViewHas('presets');
});

it('allows theme page to platform admins with UI lab permission', function () {
    $admin = PlatformUser::factory()->admin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.ui.theme'))
        ->assertOk();
});

it('allows components preview to platform admins with UI lab permission', function () {
    $admin = PlatformUser::factory()->admin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.ui.components'))
        ->assertOk();
});

it('updates theme settings', function () {
    $this->actingAs($this->superAdmin, 'platform')
        ->put(route('admin.ui.theme.update'), [
            'primary_color' => '#7c3aed',
            'mode' => 'dark',
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    $theme = app(ThemeServiceInterface::class)->getTheme();
    expect($theme['primary_color'])->toBe('#7c3aed');
    expect($theme['mode'])->toBe('dark');
});

it('rejects invalid hex color', function () {
    $this->actingAs($this->superAdmin, 'platform')
        ->put(route('admin.ui.theme.update'), ['primary_color' => 'not-a-color'])
        ->assertSessionHasErrors('primary_color');
});

it('rejects invalid font id', function () {
    $this->actingAs($this->superAdmin, 'platform')
        ->put(route('admin.ui.theme.update'), ['font' => 'not-a-real-font-stack'])
        ->assertSessionHasErrors('font');
});

it('persists a google font selection', function () {
    $this->actingAs($this->superAdmin, 'platform')
        ->put(route('admin.ui.theme.update'), ['font' => 'dm_sans'])
        ->assertRedirect()
        ->assertSessionHas('success');

    expect(app(ThemeServiceInterface::class)->getTheme()['font'])->toBe('dm_sans');
});

it('returns accessibility report as JSON', function () {
    $this->actingAs($this->superAdmin, 'platform')
        ->getJson(route('admin.ui.accessibility'))
        ->assertOk()
        ->assertJsonStructure([
            'status',
            'checks' => [
                '*' => ['id', 'label', 'pass'],
            ],
        ]);
});

it('renders the component library preview for super_admin', function () {
    $this->actingAs($this->superAdmin, 'platform')
        ->get(route('admin.ui.components'))
        ->assertOk()
        ->assertViewIs('central.admin.ui.components');
});
