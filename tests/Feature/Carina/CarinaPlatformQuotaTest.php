<?php

declare(strict_types=1);

use App\Models\Central\AiProvider;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaPlatformQuotaService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Redis;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
    Config::set('carina.platform_quota.trial_messages', 2);
    Config::set('carina.platform_quota.free_messages', 1);
});

afterEach(function (): void {
    Http::allowStrayRequests();
});

it('tracks trial platform quota and blocks when exhausted', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Quota '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@quota.test',
        'plan' => 'starter',
    ]);

    $tenantId = (string) $tenant->getTenantKey();
    Redis::del('carina:platform_msgs:'.$tenantId.':lifetime');

    tenancy()->initialize($tenant);

    $quota = app(CarinaPlatformQuotaService::class);
    expect($quota->status($tenantId))
        ->toMatchArray([
            'unlimited' => false,
            'limit' => 2,
            'used' => 0,
            'remaining' => 2,
            'phase' => 'trial',
            'exhausted' => false,
            'uses_tenant_key' => false,
        ]);

    $quota->recordConsumption($tenantId);
    $quota->recordConsumption($tenantId);

    expect($quota->status($tenantId)['exhausted'])->toBeTrue();

    expect(fn () => $quota->assertCanConsume($tenantId))
        ->toThrow(\App\Exceptions\Carina\CarinaPlatformQuotaExceededException::class);

    tenancy()->end();
});

it('does not count consumption when tenant uses their own AI key', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'BYOK Quota '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@byok-quota.test',
        'plan' => 'starter',
    ]);

    $tenantId = (string) $tenant->getTenantKey();

    tenancy()->initialize($tenant);

    \App\Models\Central\TenantAiSetting::query()->create([
        'tenant_id' => $tenantId,
        'provider_overrides' => [
            'openai' => ['api_key' => 'sk-test-byok-key'],
        ],
    ]);

    $quota = app(CarinaPlatformQuotaService::class);
    expect($quota->status($tenantId)['uses_tenant_key'])->toBeTrue();

    $quota->recordConsumption($tenantId);
    $quota->recordConsumption($tenantId);

    expect($quota->status($tenantId)['unlimited'])->toBeTrue();
    $quota->assertCanConsume($tenantId);

    tenancy()->end();
});

it('returns 402 on carina chat when platform quota is exhausted', function (): void {
    Http::preventStrayRequests();

    $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
    $groq->update([
        'api_key' => 'gsk-quota-test',
        'api_base_url' => 'https://api.carina-quota.invalid/openai/v1',
        'is_enabled' => true,
    ]);

    Config::set('carina.platform_quota.trial_messages', 1);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Chat Quota '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@chat-quota.test',
        'plan' => 'starter',
    ]);

    $tenantId = (string) $tenant->getTenantKey();
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    Redis::del('carina:platform_msgs:'.$tenantId.':lifetime');

    Http::fake([
        'https://api.carina-quota.invalid/openai/v1/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => 'Once']]],
            'usage' => ['prompt_tokens' => 1, 'completion_tokens' => 1],
        ], 200),
    ]);

    tenancy()->initialize($tenant);
    /** @var User $user */
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/api/carina/chat', [
        'message' => 'First message',
    ])->assertOk();

    $this->postJson('http://'.$host.'/api/carina/chat', [
        'message' => 'Second message',
    ])
        ->assertStatus(402)
        ->assertJsonPath('code', 'carina_platform_quota_exhausted');
});
