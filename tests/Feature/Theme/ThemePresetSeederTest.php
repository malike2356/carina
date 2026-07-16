<?php

declare(strict_types=1);

use App\Models\Central\ThemePreset;
use Database\Seeders\ThemePresetSeeder;

it('seeds core presets plus workspace catalog from JSON', function () {
    $this->seed(ThemePresetSeeder::class);

    expect(ThemePreset::query()->count())->toBe(10);
    expect(ThemePreset::query()->where('slug', 'propreneur-default')->exists())->toBeTrue();
    expect(ThemePreset::query()->where('slug', 'dark-mode')->exists())->toBeTrue();
    expect(ThemePreset::query()->where('slug', 'high-contrast')->exists())->toBeTrue();
    expect(ThemePreset::query()->where('slug', 'forest')->exists())->toBeTrue();
    expect(ThemePreset::query()->where('slug', 'property-gold')->exists())->toBeTrue();
    expect(ThemePreset::query()->where('slug', 'property-blue')->exists())->toBeTrue();
    expect(ThemePreset::query()->where('is_default', true)->count())->toBe(1);
});
