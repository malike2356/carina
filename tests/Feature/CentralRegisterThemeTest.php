<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Central\TenantThemeOverride;
use App\Models\Central\ThemePreset;
use Database\Seeders\ThemePresetSeeder;

beforeEach(function (): void {
    $this->seed(ThemePresetSeeder::class);
});

it('applies selected workspace theme preset during central signup', function (): void {
    $preset = ThemePreset::query()->where('slug', 'dark-mode')->firstOrFail();

    $response = $this->post(route('central.register.post'), [
        'company_name' => 'Theme Signup Co',
        'owner_name' => 'Owner',
        'owner_email' => 'owner-theme-signup@test.local',
        'slug' => 'theme-signup-co',
        'password' => 'password123',
        'password_confirmation' => 'password123',
        'theme_preset_id' => $preset->id,
    ]);

    $response->assertStatus(302);

    $tenantId = Tenant::query()
        ->where('slug', 'theme-signup-co')
        ->value('id');

    expect($tenantId)->not->toBeNull();

    $override = TenantThemeOverride::query()
        ->where('tenant_id', (string) $tenantId)
        ->first();

    expect($override)->not->toBeNull();
    expect($override?->preset_id)->toBe($preset->id);
    expect($override?->is_active)->toBeTrue();
});
