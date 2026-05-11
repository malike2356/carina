<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformPermission;
use App\Models\Central\PlatformUser;
use App\Services\Carina\CarinaService;
use App\Services\Security\PatchScanService;
use App\Services\Security\SastScanService;

it('forbids SCOUT without scout-view or access-scout', function () {
    $admin = PlatformUser::factory()->admin()->create();
    expect($admin->hasPlatformPermission('access-scout'))->toBeFalse()
        ->and($admin->hasPlatformPermission('scout-view'))->toBeFalse()
        ->and($admin->isSuperAdmin())->toBeFalse();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.scout.index'))
        ->assertForbidden();
});

it('allows SCOUT index for scout-view only', function () {
    $user = PlatformUser::factory()->admin()->create();
    $user->givePermissionTo(PlatformPermission::findOrCreate('scout-view', 'platform'));

    $this->actingAs($user, 'platform')
        ->get(route('admin.scout.index'))
        ->assertOk();
});

it('forbids activity log without scout-triage', function () {
    $user = PlatformUser::factory()->admin()->create();
    $user->givePermissionTo(PlatformPermission::findOrCreate('scout-view', 'platform'));

    $this->actingAs($user, 'platform')
        ->post(route('admin.scout.activity.store'), [
            'category' => 'note',
            'title' => 'Should fail',
            'body' => null,
        ])
        ->assertForbidden();
});

it('forbids remediation actions without scout-remediate', function () {
    $user = PlatformUser::factory()->admin()->create();
    $user->givePermissionTo(PlatformPermission::findOrCreate('scout-view', 'platform'));

    $this->actingAs($user, 'platform')
        ->post(route('admin.scout.actions.apply'), ['action' => 'config_clear'])
        ->assertForbidden();
});

it('allows composer audit for scout-audit without scout-remediate', function () {
    $this->mock(PatchScanService::class, function ($mock): void {
        $mock->shouldReceive('scan')->once()->andReturn([]);
    });

    $user = PlatformUser::factory()->admin()->create();
    $user->givePermissionTo(PlatformPermission::findOrCreate('scout-view', 'platform'));
    $user->givePermissionTo(PlatformPermission::findOrCreate('scout-audit', 'platform'));

    $this->actingAs($user, 'platform')
        ->post(route('admin.scout.actions.apply'), ['action' => 'composer_audit'])
        ->assertRedirect();
});

it('forbids composer audit without scout-audit', function () {
    $user = PlatformUser::factory()->admin()->create();
    $user->givePermissionTo(PlatformPermission::findOrCreate('scout-view', 'platform'));
    $user->givePermissionTo(PlatformPermission::findOrCreate('scout-remediate', 'platform'));

    $this->actingAs($user, 'platform')
        ->post(route('admin.scout.actions.apply'), ['action' => 'composer_audit'])
        ->assertForbidden();
});

it('allows sast scan for scout-audit without scout-remediate', function () {
    $this->mock(SastScanService::class, function ($mock): void {
        $mock->shouldReceive('scan')->once()->andReturn([]);
    });

    $user = PlatformUser::factory()->admin()->create();
    $user->givePermissionTo(PlatformPermission::findOrCreate('scout-view', 'platform'));
    $user->givePermissionTo(PlatformPermission::findOrCreate('scout-audit', 'platform'));

    $this->actingAs($user, 'platform')
        ->post(route('admin.scout.actions.apply'), ['action' => 'sast_scan'])
        ->assertRedirect();
});

it('forbids sast scan without scout-audit', function () {
    $user = PlatformUser::factory()->admin()->create();
    $user->givePermissionTo(PlatformPermission::findOrCreate('scout-view', 'platform'));
    $user->givePermissionTo(PlatformPermission::findOrCreate('scout-remediate', 'platform'));

    $this->actingAs($user, 'platform')
        ->post(route('admin.scout.actions.apply'), ['action' => 'sast_scan'])
        ->assertForbidden();
});

it('allows SCOUT for super admin', function () {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.scout.index'))
        ->assertOk()
        ->assertSee('SCOUT', false);
});

it('allows SCOUT when access-scout is granted', function () {
    $user = PlatformUser::factory()->admin()->create();
    $user->givePermissionTo(PlatformPermission::findOrCreate('access-scout', 'platform'));

    $this->actingAs($user, 'platform')
        ->get(route('admin.scout.index'))
        ->assertOk();
});

it('records activity from SCOUT form', function () {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.scout.activity.store'), [
            'category' => 'note',
            'title' => 'Quarterly review scheduled',
            'body' => 'External firm booked.',
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('security_activity_logs', [
        'title' => 'Quarterly review scheduled',
        'category' => 'note',
    ], 'central');
});

it('runs SCOUT config clear action and logs activity', function () {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.scout.actions.apply'), [
            'action' => 'config_clear',
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('security_activity_logs', [
        'title' => 'SCOUT action: config cache cleared',
        'category' => 'remediation',
    ], 'central');
});

it('runs SCOUT optimize clear action and logs activity', function () {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.scout.actions.apply'), [
            'action' => 'optimize_clear',
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('security_activity_logs', [
        'title' => 'SCOUT action: optimize clear',
        'category' => 'remediation',
    ], 'central');
});

it('runs SCOUT composer audit action and logs row count', function () {
    $this->mock(PatchScanService::class, function ($mock): void {
        $mock->shouldReceive('scan')->once()->andReturn([['id' => 'pkg-1']]);
    });

    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.scout.actions.apply'), [
            'action' => 'composer_audit',
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('security_activity_logs', [
        'title' => 'SCOUT action: Composer dependency audit',
        'category' => 'audit',
    ], 'central');
});

it('runs SCOUT sast scan action and logs row count', function () {
    $this->mock(SastScanService::class, function ($mock): void {
        $mock->shouldReceive('scan')->once()->andReturn([]);
    });

    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.scout.actions.apply'), [
            'action' => 'sast_scan',
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('security_activity_logs', [
        'title' => 'SCOUT action: PHPStan static analysis',
        'category' => 'audit',
    ], 'central');
});

it('posts SCOUT Carina message and returns assistant reply JSON', function () {
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => true]);

    $this->mock(CarinaService::class, function ($mock): void {
        $mock->shouldReceive('platformChat')
            ->once()
            ->andReturn('Hardening summary: set APP_DEBUG=false in production.');
    });

    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->postJson(route('admin.scout.carina.message'), [
            'message' => 'What should I fix first?',
        ])
        ->assertOk()
        ->assertJson([
            'reply' => 'Hardening summary: set APP_DEBUG=false in production.',
        ]);
});
