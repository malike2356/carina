<?php

declare(strict_types=1);

use App\Models\Central\PlatformUser;
use App\Services\Security\KeyRotationService;

it('forbids key rotation for non super admin', function () {
    $admin = PlatformUser::factory()->admin()->create();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.scout.keys.rotate'), [])
        ->assertForbidden();
});

it('rotates keys for super admin using key rotation service', function () {
    $this->mock(KeyRotationService::class, function ($mock): void {
        $mock->shouldReceive('rotate')
            ->once()
            ->andReturn(['app_key' => 'rotated', 'sessions' => 'cleared']);
    });

    $super = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($super, 'platform')
        ->post(route('admin.scout.keys.rotate'), [])
        ->assertRedirect();

    $this->assertDatabaseHas('security_activity_logs', [
        'category' => 'remediation',
        'title' => 'Application key rotation (APP_KEY and auth artefacts)',
    ], 'central');
});
