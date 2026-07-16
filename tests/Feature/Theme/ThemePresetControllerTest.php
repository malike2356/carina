<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;
use App\Models\Central\ThemePreset;
use Database\Seeders\Central\FeatureFlagSeeder;
use Database\Seeders\ThemePresetSeeder;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'admin_design_system_lab')->update([
        'enabled' => true,
        'tenant_overrides' => null,
    ]);
    FeatureFlag::query()->where('key', 'central_theme_presets')->update([
        'enabled' => true,
        'tenant_overrides' => null,
    ]);

    $this->seed(ThemePresetSeeder::class);
    $this->superAdmin = PlatformUser::factory()->superAdmin()->create();
});

it('redirects presets index to unified theme page when design system lab is on', function () {
    $this->actingAs($this->superAdmin, 'platform')
        ->get(route('admin.theme.presets.index'))
        ->assertRedirect(route('admin.ui.theme').'#workspace-presets');
});

it('shows presets on unified theme page', function () {
    $this->actingAs($this->superAdmin, 'platform')
        ->get(route('admin.ui.theme'))
        ->assertOk()
        ->assertSee('Workspace theme presets')
        ->assertSee('Propreneur Default');
});

it('lists presets on standalone index when design system lab is off', function () {
    FeatureFlag::query()->where('key', 'admin_design_system_lab')->update(['enabled' => false]);

    try {
        $this->actingAs($this->superAdmin, 'platform')
            ->get(route('admin.theme.presets.index'))
            ->assertOk()
            ->assertSee('Propreneur Default');

        $admin = PlatformUser::factory()->admin()->create();
        $this->actingAs($admin, 'platform')
            ->get(route('admin.theme.presets.index'))
            ->assertOk();
    } finally {
        FeatureFlag::query()->where('key', 'admin_design_system_lab')->update([
            'enabled' => true,
            'tenant_overrides' => null,
        ]);
    }
});

it('sets default preset', function () {
    $dark = ThemePreset::query()->where('slug', 'dark-mode')->firstOrFail();

    $this->actingAs($this->superAdmin, 'platform')
        ->post(route('admin.theme.presets.default', $dark))
        ->assertRedirect(route('admin.ui.theme').'#workspace-presets');

    expect(ThemePreset::query()->where('is_default', true)->count())->toBe(1);
    expect($dark->fresh()->is_default)->toBeTrue();
});

it('returns preset preview json', function () {
    $preset = ThemePreset::query()->where('slug', 'propreneur-default')->firstOrFail();

    $this->actingAs($this->superAdmin, 'platform')
        ->getJson(route('admin.theme.presets.preview', $preset))
        ->assertOk()
        ->assertJsonStructure(['variables']);
});
