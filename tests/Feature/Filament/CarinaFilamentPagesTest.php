<?php

declare(strict_types=1);

use App\Models\Central\PlatformUser;

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

it('allows active platform admin to view filament carina usage dashboard', function (): void {
    $admin = PlatformUser::factory()->admin()->create();

    $response = $this->actingAs($admin, 'platform')->get('/filament/carina-usage-dashboard');

    $response->assertOk();
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

it('allows active platform admin to view ad campaigns without redirecting to filament home', function (): void {
    $admin = PlatformUser::factory()->admin()->create();

    $response = $this->actingAs($admin, 'platform')->get('/filament/lead-funnel/ad-campaigns');

    $response->assertOk();
    $response->assertSee('Ad campaigns', false);
    $response->assertSee('No ad campaigns yet', false);
});
