<?php

declare(strict_types=1);

use App\Models\Central\PlatformUser;

it('renders the platform admin dashboard with metrics and module shortcuts for super admin', function (): void {
    $user = PlatformUser::factory()->superAdmin()->create();

    $response = $this->actingAs($user, 'platform')->get(route('admin.dashboard'));

    $response->assertOk();
    $response->assertSee('Platform Overview', false);
    $response->assertSee('Workspace domains', false);
    $response->assertSee('Active subscriptions', false);
    $response->assertSee('Operations &amp; modules', false);
    $response->assertSee('SCOUT', false);
});
