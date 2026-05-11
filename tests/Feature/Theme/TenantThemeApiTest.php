<?php

declare(strict_types=1);

use App\Models\Central\ThemePreset;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\ThemePresetSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->seed(ThemePresetSeeder::class);
});

it('returns tenant theme payload on api theme endpoint', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Theme API '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@theme-api.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);

    $user = User::query()->firstOrFail();
    $user->password = Hash::make('secret');
    $user->save();

    completeTenantWorkspaceOnboarding();

    tenancy()->end();

    $this->actingAs($user, 'web');

    $response = $this->getJson('http://'.$host.'/api/theme');

    $response->assertOk();
    $response->assertJsonStructure(['variables', 'client', 'presets']);

    expect($response->json('client.preset_slug'))->toBe('propreneur-default');
});

it('selects a dark preset for the workspace', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Theme Pick '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@theme-pick.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';
    $darkId = ThemePreset::query()->where('slug', 'dark-mode')->value('id');

    tenancy()->initialize($tenant);

    $user = User::query()->firstOrFail();
    $user->password = Hash::make('secret');
    $user->save();

    completeTenantWorkspaceOnboarding();

    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/api/theme/preset', ['preset_id' => $darkId])
        ->assertOk()
        ->assertJsonPath('client.mode', 'dark');
});
