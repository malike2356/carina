<?php

declare(strict_types=1);

use App\Models\Central\SecurityEvent;
use App\Services\Security\SecurityEventService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    SecurityEvent::query()->delete();
});

afterEach(function (): void {
    SecurityEvent::flushEventListeners();
    SecurityEvent::query()->delete();
});

function securityEventConnection(): string
{
    return (string) (new SecurityEvent)->getConnectionName();
}

it('record() writes a row to security_events on the central DB', function (): void {
    $service = app(SecurityEventService::class);
    $service->record('test_event', null, ['foo' => 'bar'], SecurityEvent::SEVERITY_LOW);

    $this->assertDatabaseHas('security_events', [
        'event' => 'test_event',
        'severity' => SecurityEvent::SEVERITY_LOW,
        'actor_type' => 'system',
    ], securityEventConnection());
});

it('record() does not throw when the DB write fails', function (): void {
    Log::spy();

    SecurityEvent::creating(function (): void {
        throw new RuntimeException('simulated failure');
    });

    app(SecurityEventService::class)->record('failed_write', null);

    Log::shouldHaveReceived('error')
        ->once()
        ->with('security_event_write_failed', Mockery::on(fn (array $ctx): bool => ($ctx['event'] ?? '') === 'failed_write'));
});

it('record() includes ip and user_agent from the request context', function (): void {
    $request = Request::create(
        'http://propreneur.test/admin/security/events',
        'GET',
        [],
        [],
        [],
        [
            'REMOTE_ADDR' => '203.0.113.50',
            'HTTP_USER_AGENT' => 'SecurityEventTestAgent/2.0',
        ],
    );
    $this->app->instance('request', $request);

    app(SecurityEventService::class)->record('request_context_probe', null);

    $row = SecurityEvent::query()->where('event', 'request_context_probe')->first();
    expect($row)->not->toBeNull()
        ->and($row->context['ip'] ?? null)->toBe('203.0.113.50')
        ->and($row->context['user_agent'] ?? null)->toBe('SecurityEventTestAgent/2.0')
        ->and($row->context['method'] ?? null)->toBe('GET');
});

it('critical() writes a critical-severity row and logs at critical level', function (): void {
    Log::spy();

    app(SecurityEventService::class)->critical('brute_force_login', 'tenant-uuid-1', ['attempts' => 5]);

    Log::shouldHaveReceived('critical')
        ->once()
        ->with('security.brute_force_login', Mockery::on(fn (array $ctx): bool => ($ctx['tenant_id'] ?? null) === 'tenant-uuid-1'));

    $this->assertDatabaseHas('security_events', [
        'event' => 'brute_force_login',
        'severity' => SecurityEvent::SEVERITY_CRITICAL,
        'tenant_id' => 'tenant-uuid-1',
    ], securityEventConnection());
});

it('unresolvedHighPriority() returns only high/critical unresolved events', function (): void {
    SecurityEvent::query()->create([
        'event' => 'open_critical',
        'severity' => SecurityEvent::SEVERITY_CRITICAL,
        'context' => [],
        'resolved' => false,
    ]);
    SecurityEvent::query()->create([
        'event' => 'open_high',
        'severity' => SecurityEvent::SEVERITY_HIGH,
        'context' => [],
        'resolved' => false,
    ]);
    SecurityEvent::query()->create([
        'event' => 'open_low',
        'severity' => SecurityEvent::SEVERITY_LOW,
        'context' => [],
        'resolved' => false,
    ]);
    SecurityEvent::query()->create([
        'event' => 'resolved_critical',
        'severity' => SecurityEvent::SEVERITY_CRITICAL,
        'context' => [],
        'resolved' => true,
        'resolved_at' => now(),
    ]);

    $results = app(SecurityEventService::class)->unresolvedHighPriority();

    expect($results)->toHaveCount(2)
        ->and($results->pluck('event')->all())->toEqualCanonicalizing(['open_critical', 'open_high']);
});

it('unresolvedHighPriority() filters by tenant_id when provided', function (): void {
    SecurityEvent::query()->create([
        'tenant_id' => 'tenant-a',
        'event' => 'tenant_a_high',
        'severity' => SecurityEvent::SEVERITY_HIGH,
        'context' => [],
        'resolved' => false,
    ]);
    SecurityEvent::query()->create([
        'tenant_id' => 'tenant-b',
        'event' => 'tenant_b_high',
        'severity' => SecurityEvent::SEVERITY_HIGH,
        'context' => [],
        'resolved' => false,
    ]);

    $results = app(SecurityEventService::class)->unresolvedHighPriority('tenant-a');

    expect($results)->toHaveCount(1)
        ->and($results->first()?->event)->toBe('tenant_a_high');
});
