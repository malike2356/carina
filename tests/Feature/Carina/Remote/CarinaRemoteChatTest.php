<?php

declare(strict_types=1);

use App\Models\Tenant\CarinaRemoteApiKey;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaAgentService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\RateLimiter;

function remoteChatTenantHost(): string
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Remote Chat '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@remote-chat.test',
        'plan' => 'starter',
    ]);

    test()->tenant = $tenant;
    test()->host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return test()->host;
}

it('returns 200 with reply for valid key', function (): void {
    $host = remoteChatTenantHost();
    tenancy()->initialize(test()->tenant);

    $user = User::query()->firstOrFail();
    [$plain, $key] = CarinaRemoteApiKey::mint('chat test', $user->id);

    $this->mock(CarinaAgentService::class, function ($mock): void {
        $mock->shouldReceive('agentChat')->once()->andReturn([
            'reply' => 'Three deals in negotiation.',
            'requires_confirmation' => false,
            'steps_used' => 2,
        ]);
    });

    tenancy()->end();

    $response = $this->postJson('http://'.$host.'/api/remote/carina/chat', [
        'message' => 'What deals are in negotiation?',
    ], [
        'Authorization' => 'Bearer '.$plain,
    ]);

    $response->assertOk()
        ->assertJsonPath('reply', 'Three deals in negotiation.')
        ->assertJsonPath('steps_used', 2);
});

it('returns 401 for invalid key', function (): void {
    $host = remoteChatTenantHost();

    $this->postJson('http://'.$host.'/api/remote/carina/chat', [
        'message' => 'Hi',
    ], [
        'Authorization' => 'Bearer crm_invalidkey00000000000000000000000000000000000000000000000000',
    ])->assertUnauthorized();
});

it('returns 401 for expired key', function (): void {
    $host = remoteChatTenantHost();
    tenancy()->initialize(test()->tenant);

    [$plain, $key] = CarinaRemoteApiKey::mint('expired', User::query()->firstOrFail()->id);
    $key->forceFill(['expires_at' => now()->subMinute()])->save();

    tenancy()->end();

    $this->postJson('http://'.$host.'/api/remote/carina/chat', [
        'message' => 'Hi',
    ], [
        'Authorization' => 'Bearer '.$plain,
    ])->assertUnauthorized()->assertJsonPath('message', 'API key expired');
});

it('validates message field', function (): void {
    $host = remoteChatTenantHost();
    tenancy()->initialize(test()->tenant);
    [$plain] = CarinaRemoteApiKey::mint('v', User::query()->firstOrFail()->id);
    tenancy()->end();

    $this->postJson('http://'.$host.'/api/remote/carina/chat', [], [
        'Authorization' => 'Bearer '.$plain,
    ])->assertUnprocessable();

    $this->postJson('http://'.$host.'/api/remote/carina/chat', [
        'message' => str_repeat('x', 4001),
    ], [
        'Authorization' => 'Bearer '.$plain,
    ])->assertUnprocessable();
});

it('rate limits per api key prefix', function (): void {
    $host = remoteChatTenantHost();
    tenancy()->initialize(test()->tenant);
    [$plain, $key] = CarinaRemoteApiKey::mint('rl', User::query()->firstOrFail()->id);
    tenancy()->end();

    RateLimiter::clear('carina_remote_api');

    $this->mock(CarinaAgentService::class, function ($mock): void {
        $mock->shouldReceive('agentChat')->andReturn([
            'reply' => 'ok',
            'requires_confirmation' => false,
            'steps_used' => 1,
        ]);
    });

    for ($i = 0; $i < 30; $i++) {
        $this->postJson('http://'.$host.'/api/remote/carina/chat', [
            'message' => 'Ping '.$i,
        ], [
            'Authorization' => 'Bearer '.$plain,
        ])->assertOk();
    }

    $this->postJson('http://'.$host.'/api/remote/carina/chat', [
        'message' => 'One more',
    ], [
        'Authorization' => 'Bearer '.$plain,
    ])->assertStatus(429);
});

it('revoked key returns 401', function (): void {
    $host = remoteChatTenantHost();
    tenancy()->initialize(test()->tenant);
    [$plain, $key] = CarinaRemoteApiKey::mint('revoke', User::query()->firstOrFail()->id);
    $key->forceFill(['is_active' => false])->save();
    tenancy()->end();

    $this->postJson('http://'.$host.'/api/remote/carina/chat', [
        'message' => 'Hi',
    ], [
        'Authorization' => 'Bearer '.$plain,
    ])->assertUnauthorized();
});
