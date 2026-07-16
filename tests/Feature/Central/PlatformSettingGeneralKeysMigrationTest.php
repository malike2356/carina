<?php

declare(strict_types=1);

use App\Http\Controllers\Central\Admin\SettingsController;
use App\Models\Central\PlatformSetting;

it('renames legacy general platform_setting keys to canonical names', function () {
    PlatformSetting::query()->whereIn('key', ['app_name', 'platform_name', 'tenant_max_active', 'max_tenants'])->delete();

    PlatformSetting::query()->create([
        'group' => 'general',
        'key' => 'app_name',
        'value' => 'LegacyBrand',
        'type' => 'string',
        'label' => null,
        'description' => null,
        'is_encrypted' => false,
        'is_public' => false,
    ]);

    app(SettingsController::class)->groupedPlatformSettingsForView();

    expect(PlatformSetting::query()->where('key', 'app_name')->exists())->toBeFalse()
        ->and(PlatformSetting::query()->where('key', 'platform_name')->value('value'))->toBe('LegacyBrand');
});

it('drops legacy row when canonical general key already exists', function () {
    PlatformSetting::query()->whereIn('key', ['app_name', 'platform_name'])->delete();

    PlatformSetting::query()->create([
        'group' => 'general',
        'key' => 'platform_name',
        'value' => 'Canonical',
        'type' => 'string',
        'label' => null,
        'description' => null,
        'is_encrypted' => false,
        'is_public' => false,
    ]);
    PlatformSetting::query()->create([
        'group' => 'general',
        'key' => 'app_name',
        'value' => 'Dup',
        'type' => 'string',
        'label' => null,
        'description' => null,
        'is_encrypted' => false,
        'is_public' => false,
    ]);

    app(SettingsController::class)->groupedPlatformSettingsForView();

    expect(PlatformSetting::query()->where('key', 'app_name')->exists())->toBeFalse()
        ->and(PlatformSetting::query()->where('key', 'platform_name')->value('value'))->toBe('Canonical');
});
