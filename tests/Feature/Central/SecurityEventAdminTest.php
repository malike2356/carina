<?php

declare(strict_types=1);

use App\Models\Central\PlatformPermission;
use App\Models\Central\PlatformUser;
use App\Models\Central\SecurityActivityLog;
use App\Models\Central\SecurityEvent;

it('shows platform security dashboard for scout-view', function (): void {
    $user = PlatformUser::factory()->admin()->create();
    $user->givePermissionTo(PlatformPermission::findOrCreate('scout-view', 'platform'));

    SecurityEvent::query()->create([
        'event' => 'anomaly_detected',
        'severity' => SecurityEvent::SEVERITY_CRITICAL,
        'context' => [],
        'resolved' => false,
    ]);

    $this->actingAs($user, 'platform')
        ->get(route('admin.platform.security.dashboard'))
        ->assertOk()
        ->assertSee('Security overview', false);
});

it('forbids security events index without scout access', function (): void {
    $admin = PlatformUser::factory()->admin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.platform.security.events.index'))
        ->assertForbidden();
});

it('allows security events index for scout-view', function (): void {
    $user = PlatformUser::factory()->admin()->create();
    $user->givePermissionTo(PlatformPermission::findOrCreate('scout-view', 'platform'));

    SecurityEvent::query()->create([
        'event' => 'prompt_injection_attempt',
        'severity' => SecurityEvent::SEVERITY_HIGH,
        'context' => ['ip' => '127.0.0.1'],
        'resolved' => false,
    ]);

    $this->actingAs($user, 'platform')
        ->get(route('admin.platform.security.events.index'))
        ->assertOk()
        ->assertSee('prompt_injection_attempt');
});

it('resolves a security event and logs platform activity', function (): void {
    $user = PlatformUser::factory()->admin()->create();
    $user->givePermissionTo(PlatformPermission::findOrCreate('scout-view', 'platform'));

    $event = SecurityEvent::query()->create([
        'event' => 'cross_tenant_probe',
        'severity' => SecurityEvent::SEVERITY_CRITICAL,
        'context' => [],
        'resolved' => false,
    ]);

    $this->actingAs($user, 'platform')
        ->patch(route('admin.platform.security.events.resolve', $event), [
            'resolution_note' => 'False positive from internal scan.',
        ])
        ->assertRedirect();

    $event->refresh();
    expect($event->resolved)->toBeTrue()
        ->and($event->resolution_note)->toBe('False positive from internal scan.')
        ->and($event->resolved_by)->toBe((string) $user->id);

    expect(SecurityActivityLog::query()
        ->where('title', 'Security event resolved')
        ->exists())->toBeTrue();
});

it('prune command deletes only old resolved events', function (): void {
    SecurityEvent::query()->create([
        'event' => 'old_resolved',
        'severity' => SecurityEvent::SEVERITY_INFO,
        'context' => [],
        'resolved' => true,
        'resolved_at' => now()->subDays(40),
    ]);
    SecurityEvent::query()->create([
        'event' => 'old_unresolved',
        'severity' => SecurityEvent::SEVERITY_INFO,
        'context' => [],
        'resolved' => false,
    ]);
    SecurityEvent::query()->create([
        'event' => 'fresh_resolved',
        'severity' => SecurityEvent::SEVERITY_INFO,
        'context' => [],
        'resolved' => true,
        'resolved_at' => now()->subDays(5),
    ]);

    $this->artisan('security:prune-events', ['--days' => 30])->assertSuccessful();

    expect(SecurityEvent::query()->where('event', 'old_resolved')->exists())->toBeFalse()
        ->and(SecurityEvent::query()->where('event', 'old_unresolved')->exists())->toBeTrue()
        ->and(SecurityEvent::query()->where('event', 'fresh_resolved')->exists())->toBeTrue();
});
