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

it('renders tenant appearance settings page', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Appearance Tenant '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@appearance.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $user->password = Hash::make('secret');
    $user->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/settings/appearance')
        ->assertOk()
        ->assertSee('Workspace Theme');
});

it('updates tenant appearance preset from settings page', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Appearance Update '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@appearance-update.test',
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

    $this->actingAs($user, 'web')
        ->put('http://'.$host.'/settings/appearance', ['theme_preset_id' => $darkId])
        ->assertRedirect('http://'.$host.'/settings/appearance')
        ->assertSessionHas('success');

    $this->actingAs($user, 'web')
        ->getJson('http://'.$host.'/api/theme')
        ->assertOk()
        ->assertJsonPath('client.preset_slug', 'dark-mode');
});
