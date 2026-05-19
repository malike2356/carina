<?php

declare(strict_types=1);

use App\Models\Central\SecurityEvent;
use App\Services\Carina\Security\CarinaToolCallGuard;
use Illuminate\Support\Facades\Cache;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Cache::flush();
});

it('checkBeforeCall allows a clean tool call', function (): void {
    $guard = app(CarinaToolCallGuard::class);
    $result = $guard->checkBeforeCall('create_contact', ['name' => 'Test'], 'tenant-1', 'session-a');

    expect($result['allowed'])->toBeTrue()
        ->and($result['reason'])->toBe('');
});

it('checkBeforeCall blocks a call with a dangerous argument key (raw_sql)', function (): void {
    $guard = app(CarinaToolCallGuard::class);
    $result = $guard->checkBeforeCall(
        'create_journal_entry',
        ['raw_sql' => 'SELECT * FROM users'],
        'tenant-1',
        'session-a',
    );

    expect($result['allowed'])->toBeFalse()
        ->and($result['reason'])->toContain('raw_sql');

    test()->assertDatabaseHas('security_events', [
        'event' => 'dangerous_arg_key',
        'severity' => SecurityEvent::SEVERITY_HIGH,
    ], (string) (new SecurityEvent)->getConnectionName());
});

it('checkBeforeCall blocks after MAX_CALLS_PER_MINUTE calls', function (): void {
    $guard = app(CarinaToolCallGuard::class);
    $tenantId = 'tenant-rate';
    $sessionId = 'session-rate';

    for ($i = 0; $i < 30; $i++) {
        $guard->checkBeforeCall('list_properties', [], $tenantId, $sessionId.'-'.$i);
    }

    $blocked = $guard->checkBeforeCall('list_properties', [], $tenantId, 'session-final');

    expect($blocked['allowed'])->toBeFalse()
        ->and($blocked['reason'])->toContain('rate limit');
});

it('checkBeforeCall blocks after MAX_CALLS_PER_SESSION calls', function (): void {
    $guard = app(CarinaToolCallGuard::class);
    $tenantId = 'tenant-session';
    $sessionId = 'session-limit';

    for ($i = 0; $i < 10; $i++) {
        $guard->checkBeforeCall('search_contacts', [], $tenantId, $sessionId);
    }

    $blocked = $guard->checkBeforeCall('search_contacts', [], $tenantId, $sessionId);

    expect($blocked['allowed'])->toBeFalse()
        ->and($blocked['reason'])->toContain('Maximum tool calls per session');
});

it('validateToolOutput returns valid=true for a normal-sized output', function (): void {
    $guard = app(CarinaToolCallGuard::class);
    $result = $guard->validateToolOutput('search_contacts', ['contacts' => [['name' => 'A']]], 'tenant-1');

    expect($result['valid'])->toBeTrue()
        ->and($result['reason'])->toBe('');
});

it('validateToolOutput returns valid=false and logs for output > 50KB', function (): void {
    $guard = app(CarinaToolCallGuard::class);
    $huge = str_repeat('x', 52000);

    $result = $guard->validateToolOutput('list_properties', $huge, 'tenant-1');

    expect($result['valid'])->toBeFalse()
        ->and($result['reason'])->toBe('oversized');

    test()->assertDatabaseHas('security_events', [
        'event' => 'tool_output_oversized',
        'severity' => SecurityEvent::SEVERITY_HIGH,
    ], (string) (new SecurityEvent)->getConnectionName());
});
