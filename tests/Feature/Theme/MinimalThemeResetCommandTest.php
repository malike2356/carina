<?php

declare(strict_types=1);

use App\Models\Central\PlatformSetting;
use App\Models\Central\TenantThemeOverride;
use App\Models\Central\ThemePreset;
use App\Services\Theme\MinimalThemeResetService;
use App\Services\UI\Contracts\ThemeServiceInterface;
use Database\Seeders\ThemePresetSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->seed(ThemePresetSeeder::class);
});

it('resets ui settings, presets, and tenant overrides via artisan', function () {
    PlatformSetting::query()->updateOrCreate(
        ['key' => 'ui.font'],
        ['group' => 'ui', 'value' => 'dm-sans', 'type' => 'string']
    );

    $tenantId = 'treset-'.Str::lower(Str::random(12));
    $slug = 'treset-'.Str::lower(Str::random(8));
    $now = now();
    DB::connection('central')->table('tenants')->insert([
        'id' => $tenantId,
        'slug' => $slug,
        'company_name' => 'Test',
        'owner_name' => 'Owner',
        'owner_email' => 'owner@example.test',
        'plan' => 'starter',
        'is_active' => true,
        'trial_ends_at' => null,
        'created_at' => $now,
        'updated_at' => $now,
    ]);

    $dark = ThemePreset::query()->where('slug', 'dark-mode')->firstOrFail();
    TenantThemeOverride::query()->create([
        'tenant_id' => $tenantId,
        'preset_id' => $dark->id,
        'overrides' => [],
        'is_active' => true,
    ]);

    expect(ThemePreset::query()->count())->toBeGreaterThan(1);

    $this->artisan('theme:reset-minimal', ['--force' => true])->assertSuccessful();

    expect(PlatformSetting::query()->where('key', 'like', 'ui.%')->count())->toBe(0)
        ->and(ThemePreset::query()->count())->toBe(1)
        ->and(ThemePreset::query()->where('slug', 'propreneur-default')->where('is_default', true)->exists())->toBeTrue()
        ->and(TenantThemeOverride::query()->count())->toBe(0);

    $theme = app(ThemeServiceInterface::class)->getTheme();
    expect($theme['font'])->toBe('inter')
        ->and($theme['mode'])->toBe('system')
        ->and($theme['border_radius'])->toBe('md')
        ->and($theme['primary_color'])->toBe('#1a365d');
});

it('applies minimal preset variables on the lone preset', function () {
    app(MinimalThemeResetService::class)->apply();

    $preset = ThemePreset::query()->where('slug', 'propreneur-default')->firstOrFail();
    expect($preset->variables['--color-primary'] ?? null)->toBe('71 85 105');
});
