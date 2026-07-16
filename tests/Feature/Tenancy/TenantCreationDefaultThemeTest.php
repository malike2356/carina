<?php

declare(strict_types=1);

use App\Models\Central\TenantThemeOverride;
use App\Models\Central\ThemePreset;
use App\Services\Tenancy\TenantCreationService;
use App\Services\Theme\TenantThemeService;
use Database\Seeders\ThemePresetSeeder;

beforeEach(function (): void {
    $this->seed(ThemePresetSeeder::class);
    $this->service = app(TenantCreationService::class);
});

it('provisions a default light theme override when a tenant is created', function (): void {
    $tenant = $this->service->createTenant([
        'company_name' => 'Theme Provision Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@theme-provision.test',
        'plan' => 'starter',
    ]);

    $override = TenantThemeOverride::query()
        ->where('tenant_id', (string) $tenant->id)
        ->where('is_active', true)
        ->first();

    expect($override)->not->toBeNull();

    $preset = ThemePreset::query()->find($override->preset_id);
    expect($preset)->not->toBeNull()
        ->and($preset->is_dark_mode)->toBeFalse();

    $payload = app(TenantThemeService::class)->getClientPayloadForTenant($tenant);
    expect($payload['mode'])->toBe('light');
});
