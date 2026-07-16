<?php

declare(strict_types=1);

use App\Models\Central\ThemePreset;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\ThemePresetSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function (): void {
    $this->seed(ThemePresetSeeder::class);
});

it('workspace admin can save logo_url and favicon_url via appearance update', function (): void {
    $preset = ThemePreset::query()->firstOrFail();
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Branding Save '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@branding-save.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    $admin->password = Hash::make('secret');
    $admin->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $response = $this->actingAs($admin, 'web')
        ->from('http://'.$host.'/settings/appearance')
        ->put('http://'.$host.'/settings/appearance', [
            'theme_preset_id' => $preset->id,
            'logo_url' => 'https://example.com/logo.png',
            'favicon_url' => 'https://example.com/favicon.ico',
        ]);

    $response->assertRedirect('http://'.$host.'/settings/appearance');

    $tenant->refresh();
    expect($tenant->logo_url)->toBe('https://example.com/logo.png');
    expect($tenant->favicon_url)->toBe('https://example.com/favicon.ico');
});

it('appearance update clears branding when empty values are submitted', function (): void {
    $preset = ThemePreset::query()->firstOrFail();
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Branding Clear '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@branding-clear.test',
        'plan' => 'starter',
    ]);

    $tenant->fill([
        'logo_url' => 'https://old.com/logo.png',
        'favicon_url' => 'https://old.com/fav.ico',
    ])->save();

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    $admin->password = Hash::make('secret');
    $admin->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web')
        ->put('http://'.$host.'/settings/appearance', [
            'theme_preset_id' => $preset->id,
            'logo_url' => '',
            'favicon_url' => '',
        ]);

    $tenant->refresh();
    expect($tenant->logo_url)->toBeNull();
    expect($tenant->favicon_url)->toBeNull();
});
