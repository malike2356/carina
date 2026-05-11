<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use Database\Seeders\Central\FeatureFlagSeeder;

it('upserts the platform scaffold feature flags idempotently', function () {
    $this->seed(FeatureFlagSeeder::class);
    $first = FeatureFlag::on('central')->count();

    $this->seed(FeatureFlagSeeder::class);
    $second = FeatureFlag::on('central')->count();

    expect($first)->toBe($second)->toBeGreaterThanOrEqual(30);
    expect(FeatureFlag::on('central')->where('key', 'platform_admin_search')->value('enabled'))->toBeTrue();
    expect(FeatureFlag::on('central')->where('key', 'trial_expiry_enforcement')->exists())->toBeTrue();
    expect(FeatureFlag::on('central')->where('key', 'central_theme_presets')->exists())->toBeTrue();
});

it('does not reset enabled when syncing catalogue again', function () {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => false]);

    FeatureFlag::syncFromCatalogue();

    expect(FeatureFlag::query()->where('key', 'deal_engine')->value('enabled'))->toBeFalse();
});
