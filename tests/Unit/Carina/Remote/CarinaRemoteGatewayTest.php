<?php

declare(strict_types=1);

use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\CarinaRemoteApiKey;
use App\Models\Tenant\CarinaRemoteChannelMapping;
use App\Models\Tenant\CarinaRemoteSession;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaAgentService;
use App\Services\Carina\Remote\CarinaRemoteGateway;
use App\Services\Tenancy\TenantCreationService;
use Database\Factories\Tenant\UserFactory;
use Illuminate\Support\Carbon;

it('resolves user from channel mapping', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Remote GW '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@remote-gw.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $user = UserFactory::new()->createOne();
    CarinaRemoteChannelMapping::query()->create([
        'channel' => 'telegram',
        'external_id' => '12345',
        'user_id' => $user->id,
    ]);

    [$plain, $apiKey] = CarinaRemoteApiKey::mint('test', $user->id);

    $this->mock(CarinaAgentService::class, function ($mock): void {
        $mock->shouldReceive('agentChat')->once()->andReturn([
            'reply' => 'Hello',
            'requires_confirmation' => false,
            'steps_used' => 1,
        ]);
    });

    $result = app(CarinaRemoteGateway::class)->dispatch(
        'telegram',
        '12345',
        'Hi',
        $apiKey,
    );

    expect($result->ok)->toBeTrue()
        ->and($result->reply)->toBe('Hello');

    tenancy()->end();
});

it('falls back to api key user when external id is empty on http', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Remote HTTP '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@remote-http.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $user = User::query()->firstOrFail();
    [$plain, $apiKey] = CarinaRemoteApiKey::mint('http key', $user->id);

    $this->mock(CarinaAgentService::class, function ($mock): void {
        $mock->shouldReceive('agentChat')->once()->andReturn([
            'reply' => 'HTTP ok',
            'requires_confirmation' => false,
            'steps_used' => 1,
        ]);
    });

    $result = app(CarinaRemoteGateway::class)->dispatch('http', '', 'Ping', $apiKey);

    expect($result->ok)->toBeTrue();

    tenancy()->end();
});

it('reuses session within four hour ttl', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Remote TTL '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@remote-ttl.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $user = User::query()->firstOrFail();
    [$plain, $apiKey] = CarinaRemoteApiKey::mint('ttl', $user->id);

    $conversation = CarinaConversation::query()->create([
        'type' => 'remote',
        'tenant_id' => $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Remote',
    ]);

    $sessionKey = hash('sha256', 'http:key:'.$apiKey->id);
    CarinaRemoteSession::query()->create([
        'session_key' => $sessionKey,
        'channel' => 'http',
        'user_id' => $user->id,
        'api_key_id' => $apiKey->id,
        'conversation_id' => $conversation->id,
        'last_active_at' => now()->subHours(1),
    ]);

    $this->mock(CarinaAgentService::class, function ($mock): void {
        $mock->shouldReceive('agentChat')->once()->andReturn([
            'reply' => 'Still here',
            'requires_confirmation' => false,
            'steps_used' => 1,
        ]);
    });

    app(CarinaRemoteGateway::class)->dispatch('http', '', 'Again', $apiKey);

    expect(CarinaConversation::query()->count())->toBe(1);

    tenancy()->end();
});

it('creates new conversation when session expired', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Remote Expire '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@remote-expire.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $user = User::query()->firstOrFail();
    [$plain, $apiKey] = CarinaRemoteApiKey::mint('expire', $user->id);

    $oldConversation = CarinaConversation::query()->create([
        'type' => 'remote',
        'tenant_id' => $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Old',
    ]);

    $sessionKey = hash('sha256', 'http:key:'.$apiKey->id);
    CarinaRemoteSession::query()->create([
        'session_key' => $sessionKey,
        'channel' => 'http',
        'user_id' => $user->id,
        'api_key_id' => $apiKey->id,
        'conversation_id' => $oldConversation->id,
        'last_active_at' => Carbon::now()->subHours(5),
    ]);

    $this->mock(CarinaAgentService::class, function ($mock): void {
        $mock->shouldReceive('agentChat')->once()->andReturn([
            'reply' => 'Fresh',
            'requires_confirmation' => false,
            'steps_used' => 1,
        ]);
    });

    app(CarinaRemoteGateway::class)->dispatch('http', '', 'New context', $apiKey);

    expect(CarinaConversation::query()->count())->toBe(2);

    tenancy()->end();
});

it('returns unauthorized when no user resolved', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Remote Unauth '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@remote-unauth.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    [$plain, $apiKey] = CarinaRemoteApiKey::mint('no user', null);

    $result = app(CarinaRemoteGateway::class)->dispatch('telegram', '999', 'Hi', $apiKey);

    expect($result->ok)->toBeFalse()
        ->and($result->errorCode)->toBe('unauthorized');

    tenancy()->end();
});
