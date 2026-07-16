<?php

declare(strict_types=1);

use App\Models\Central\TenantThemeOverride;
use App\Models\Central\ThemePreset;
use App\Services\Theme\TenantThemeService;
use Database\Seeders\ThemePresetSeeder;

beforeEach(function (): void {
    $this->seed(ThemePresetSeeder::class);
});

it('getClientPayloadForTenant returns light mode for a non-dark preset', function (): void {
    $preset = ThemePreset::query()->where('is_dark_mode', false)->first();
    if ($preset === null) {
        $this->markTestSkipped('No light preset seeded.');
    }

    $tenant = createCentralTenant();
    TenantThemeOverride::query()->updateOrCreate(
        ['tenant_id' => (string) $tenant->id],
        ['preset_id' => $preset->id, 'overrides' => null, 'is_active' => true],
    );

    $service = app(TenantThemeService::class);
    $payload = $service->getClientPayloadForTenant($tenant);

    expect($payload['mode'])->toBe('light');
});

it('getClientPayloadForTenant returns dark mode for a dark preset', function (): void {
    $preset = ThemePreset::query()->where('is_dark_mode', true)->first();
    if ($preset === null) {
        $this->markTestSkipped('No dark preset seeded.');
    }

    $tenant = createCentralTenant();
    TenantThemeOverride::query()->updateOrCreate(
        ['tenant_id' => (string) $tenant->id],
        ['preset_id' => $preset->id, 'overrides' => null, 'is_active' => true],
    );

    $service = app(TenantThemeService::class);
    $payload = $service->getClientPayloadForTenant($tenant);

    expect($payload['mode'])->toBe('dark');
});

it('getClientPayloadForTenant returns light when no override exists and default preset is light', function (): void {
    $preset = ThemePreset::defaultPreset();
    if ($preset === null || $preset->is_dark_mode) {
        $this->markTestSkipped('Default preset is dark or missing - cannot assert light fallback.');
    }

    $tenant = createCentralTenant();
    TenantThemeOverride::query()->where('tenant_id', (string) $tenant->id)->delete();

    $service = app(TenantThemeService::class);
    $payload = $service->getClientPayloadForTenant($tenant);

    expect($payload['mode'])->toBe('light');
});
