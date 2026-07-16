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

it('filters feature flags by marketing category', function (): void {
    FeatureFlag::syncFromCatalogue();

    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.flags.index', ['category' => 'marketing']))
        ->assertOk()
        ->assertSee('Marketing intake', false)
        ->assertSee('Speed-to-lead', false)
        ->assertDontSee('Deal Engine');
});

it('updates labels and descriptions when syncing the catalogue', function (): void {
    FeatureFlag::syncFromCatalogue();

    $flag = FeatureFlag::query()->where('key', 'community_learning')->first();
    expect($flag)->not->toBeNull()
        ->and($flag->label)->toBe('Community and learning');

    $project = FeatureFlag::query()->where('key', 'project_management')->first();
    expect($project)->not->toBeNull()
        ->and($project->description)->toContain('/projects');
});
