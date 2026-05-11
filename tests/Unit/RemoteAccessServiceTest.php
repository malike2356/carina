<?php

declare(strict_types=1);

use App\Enums\RemoteAccessConsentMethod;
use App\Models\Central\PlatformUser;
use App\Models\Central\RemoteAccessLog;
use App\Services\RemoteAccess\RemoteAccessService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Notification;

it('creates access log and token payload', function () {
    Notification::fake();
    $admin = PlatformUser::factory()->superAdmin()->create();
    $tenant = createCentralTenant(['allow_remote_access' => true]);

    $svc = app(RemoteAccessService::class);
    $session = app('session')->driver();
    $session->start();
    $request = Request::create('/admin', 'GET', [], [], [], ['REMOTE_ADDR' => '127.0.0.1']);
    $request->setLaravelSession($session);

    $result = $svc->beginAccess(
        $admin,
        $tenant,
        'Testing support access',
        RemoteAccessConsentMethod::TenantToggle,
        $request,
        false,
    );

    expect($result['log'])->toBeInstanceOf(RemoteAccessLog::class);
    expect($result['token'])->not->toBeEmpty();

    $decoded = json_decode(Crypt::decryptString($result['token']), true);
    expect($decoded['tenant_id'])->toBe((string) $tenant->getKey());
    expect((int) $decoded['log_id'])->toBe((int) $result['log']->getKey());
});

it('terminates stale entry tokens without tenant session', function () {
    Notification::fake();

    $admin = PlatformUser::factory()->superAdmin()->create();
    $tenant = createCentralTenant();

    $log = RemoteAccessLog::on('central')->create([
        'platform_user_id' => $admin->getKey(),
        'tenant_id' => $tenant->getKey(),
        'access_started_at' => now()->subMinutes(30),
        'reason' => 'test',
        'consent_method' => RemoteAccessConsentMethod::TenantToggle,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'test',
    ]);

    $svc = app(RemoteAccessService::class);
    $svc->runScheduledCleanup();

    $log->refresh();
    expect($log->access_ended_at)->not->toBeNull();
});
