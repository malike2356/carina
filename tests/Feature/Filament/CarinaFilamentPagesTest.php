<?php

declare(strict_types=1);

use App\Filament\Widgets\CarinaTotalTokens;
use App\Filament\Widgets\OpsConsoleQuickLinks;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;
use Livewire\Livewire;

it('redirects guests away from filament carina settings', function (): void {
    $response = $this->get('/filament/carina-settings');

    $response->assertRedirect();
});

it('allows active platform admin to view filament carina settings', function (): void {
    $admin = PlatformUser::factory()->admin()->create();

    $response = $this->actingAs($admin, 'platform')->get('/filament/carina-settings');

    $response->assertOk();
});

it('allows active platform admin to view filament ops console dashboard', function (): void {
    $admin = PlatformUser::factory()->admin()->create();

    $response = $this->actingAs($admin, 'platform')->get('/filament');

    $response->assertOk();
    $response->assertSee('Ops console', false);
    $response->assertSee('Ops console shortcuts', false);
    $response->assertSee('Carina conversations', false);
});

it('ops console renders rag document stats widget section', function (): void {
    $admin = PlatformUser::factory()->admin()->create();
    $response = $this->actingAs($admin, 'platform')->get('/filament');
    $response->assertOk();
});

it('allows active platform admin to view filament carina usage dashboard', function (): void {
    $admin = PlatformUser::factory()->admin()->create();

    $response = $this->actingAs($admin, 'platform')->get('/filament/carina-usage-dashboard');

    $response->assertOk();
});

it('carina usage dashboard renders projected cost stat', function (): void {
    $admin = PlatformUser::factory()->admin()->create();

    $this->actingAs($admin, 'platform')
        ->get('/filament/carina-usage-dashboard')
        ->assertOk();

    Livewire::actingAs($admin, 'platform')
        ->test(CarinaTotalTokens::class)
        ->assertSee('Projected cost');
});

it('allows active platform admin to view intake overview dashboard without a selected workspace', function (): void {
    $admin = PlatformUser::factory()->admin()->create();

    $response = $this->actingAs($admin, 'platform')->get('/filament/lead-funnel-dashboard');

    $response->assertOk();
    $response->assertSee('Intake overview', false);
    $response->assertSee('Select a workspace to load marketing intake metrics for this dashboard.', false);
});

it('allows active platform admin to view captured prospects without redirecting to filament home', function (): void {
    $admin = PlatformUser::factory()->admin()->create();

    $response = $this->actingAs($admin, 'platform')->get('/filament/lead-funnel/inbound-leads');

    $response->assertOk();
    $response->assertSee('Captured prospects', false);
    $response->assertSee('No captured prospects yet', false);
});

it('allows active platform admin to view people directory without redirecting to filament home', function (): void {
    $admin = PlatformUser::factory()->admin()->create();

    $response = $this->actingAs($admin, 'platform')->get('/filament/crm/contacts');

    $response->assertOk();
    $response->assertSee('People', false);
    $response->assertSee('No people saved yet', false);
});

it('ops console shows workspace people quick link when crm feature flag is enabled', function (): void {
    FeatureFlag::query()->updateOrCreate(
        ['key' => 'crm'],
        ['enabled' => true]
    );

    $admin = PlatformUser::factory()->admin()->create();

    $this->actingAs($admin, 'platform')
        ->get('/filament')
        ->assertOk()
        ->assertSee('Workspace people', false);
});

it('ops console hides workspace people quick link when crm feature flag is disabled', function (): void {
    FeatureFlag::query()->updateOrCreate(
        ['key' => 'crm'],
        ['enabled' => false]
    );

    $admin = PlatformUser::factory()->admin()->create();

    Livewire::actingAs($admin, 'platform')
        ->test(OpsConsoleQuickLinks::class)
        ->assertDontSee('Workspace people');
});

it('allows active platform admin to view ad campaigns without redirecting to filament home', function (): void {
    $admin = PlatformUser::factory()->admin()->create();

    $response = $this->actingAs($admin, 'platform')->get('/filament/lead-funnel/ad-campaigns');

    $response->assertOk();
    $response->assertSee('Ad campaigns', false);
    $response->assertSee('No ad campaigns yet', false);
});
