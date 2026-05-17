<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;
use App\Support\PlatformFeatureCatalogue;
use Database\Seeders\Central\FeatureFlagSeeder;

it('auto-syncs the catalogue when the feature_flags table is empty', function (): void {
    FeatureFlag::query()->delete();

    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.flags.index'))
        ->assertOk()
        ->assertSee('Design System Lab');

    expect(FeatureFlag::query()->count())->toBe(count(PlatformFeatureCatalogue::definitions()));
});

it('filters feature flags by search query', function (): void {
    $this->seed(FeatureFlagSeeder::class);

    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.flags.index', ['q' => 'design system']))
        ->assertOk()
        ->assertSee('Design System Lab')
        ->assertDontSee('Deal Engine');
});
