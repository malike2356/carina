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

it('allows active platform admin to view filament carina usage dashboard', function (): void {
    $admin = PlatformUser::factory()->admin()->create();

    $response = $this->actingAs($admin, 'platform')->get('/filament/carina-usage-dashboard');

    $response->assertOk();
});
