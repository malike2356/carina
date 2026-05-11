<?php

declare(strict_types=1);

/**
 * Section 13 -- Feature/Carina/TokenTrackingTest
 */

use App\Models\Central\AiProvider;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\CarinaMessage;
use App\Models\Tenant\User;
use App\Services\Carina\TokenTrackingService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Redis;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
});

afterEach(function (): void {
    Http::allowStrayRequests();
    Config::set('cache.default', 'array');
});

it('test_records_tokens_on_most_recent_message', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Tok Track '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@tok-track.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $user = User::query()->firstOrFail();

    $conv = CarinaConversation::query()->create([
        'tenant_id' => $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Thread',
    ]);

    CarinaMessage::query()->create([
        'carina_conversation_id' => $conv->id,
        'role' => 'assistant',
        'content' => 'Prev',
        'input_tokens' => 1,
        'output_tokens' => 2,
    ]);

    CarinaMessage::query()->create([
        'carina_conversation_id' => $conv->id,
        'role' => 'assistant',
        'content' => 'Latest',
        'input_tokens' => 0,
        'output_tokens' => 0,
    ]);

    app(TokenTrackingService::class)->recordTokens((int) $conv->id, 10, 20, 'groq', 'llama');

    $latest = CarinaMessage::query()->where('carina_conversation_id', $conv->id)->orderByDesc('id')->first();

    expect($latest?->tokens_used)->toBe(30);
    expect($latest?->provider_used)->toBe('groq');

    tenancy()->end();
});

it('test_get_conversation_tokens_sums_all_messages', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Tok Sum '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@tok-sum.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $user = User::query()->firstOrFail();

    $conv = CarinaConversation::query()->create([
        'tenant_id' => $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Thread',
    ]);

    CarinaMessage::query()->create([
        'carina_conversation_id' => $conv->id,
        'role' => 'assistant',
        'content' => 'A',
        'input_tokens' => 5,
        'output_tokens' => 5,
        'tokens_used' => null,
    ]);

    CarinaMessage::query()->create([
        'carina_conversation_id' => $conv->id,
        'role' => 'assistant',
        'content' => 'B',
        'input_tokens' => 3,
        'output_tokens' => 7,
        'tokens_used' => null,
    ]);

    $total = app(TokenTrackingService::class)->getConversationTokens((int) $conv->id);

    expect($total['total'])->toBe(20);

    tenancy()->end();
});

it('test_get_tenant_usage_scoped_to_tenant_only', function (): void {
    $tenantSvc = app(TenantCreationService::class);

    $tA = $tenantSvc->createTenant([
        'company_name' => 'Tok A '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'a-'.uniqid().'@scope.test',
        'plan' => 'starter',
    ]);

    $tB = $tenantSvc->createTenant([
        'company_name' => 'Tok B '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'b-'.uniqid().'@scope.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tA);
    $userA = User::query()->firstOrFail();
    $convA = CarinaConversation::query()->create([
        'tenant_id' => $tA->getTenantKey(),
        'user_id' => $userA->id,
        'title' => 'A',
    ]);
    CarinaMessage::query()->create([
        'carina_conversation_id' => $convA->id,
        'role' => 'assistant',
        'content' => 'x',
        'input_tokens' => 50,
        'output_tokens' => 50,
    ]);
    tenancy()->end();

    $tracker = app(TokenTrackingService::class);

    tenancy()->initialize($tA);
    expect($tracker->getTenantTokenUsage($tA->getTenantKey(), 'monthly')['total_tokens'])->toBe(100);
    tenancy()->end();

    tenancy()->initialize($tB);
    expect($tracker->getTenantTokenUsage($tB->getTenantKey(), 'monthly')['total_tokens'])->toBe(0);
    tenancy()->end();
});

it('test_tenant_usage_is_cached_in_redis', function (): void {
    try {
        Redis::connection()->ping();
        Config::set('cache.default', 'redis');
    } catch (Throwable) {
        expect(true)->toBeTrue();

        return;
    }

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Tok Redis '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@redis-cache.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $user = User::query()->firstOrFail();

    $conv = CarinaConversation::query()->create([
        'tenant_id' => $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Cache',
    ]);

    CarinaMessage::query()->create([
        'carina_conversation_id' => $conv->id,
        'role' => 'assistant',
        'content' => 'seed',
        'input_tokens' => 10,
        'output_tokens' => 10,
    ]);

    $tid = $tenant->getTenantKey();
    $tracker = app(TokenTrackingService::class);

    $first = $tracker->getTenantTokenUsage($tid, 'monthly');

    CarinaMessage::query()->create([
        'carina_conversation_id' => $conv->id,
        'role' => 'assistant',
        'content' => 'more',
        'input_tokens' => 100,
        'output_tokens' => 0,
    ]);

    $stale = $tracker->getTenantTokenUsage($tid, 'monthly');

    expect($stale['total_tokens'])->toBe($first['total_tokens']);

    $tracker->invalidateTenantUsageCache($tid);

    $fresh = $tracker->getTenantTokenUsage($tid, 'monthly');

    expect($fresh['total_tokens'])->toBeGreaterThan($first['total_tokens']);

    tenancy()->end();
});

it('test_cache_invalidated_on_carina_message_sent_event', function (): void {
    Http::preventStrayRequests();

    $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
    $groq->update([
        'api_key' => 'gsk-tok-inv',
        'api_base_url' => 'https://api.tok-inv.invalid/openai/v1',
        'is_enabled' => true,
    ]);

    Http::fake([
        'https://api.tok-inv.invalid/openai/v1/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => 'Reply']]],
            'usage' => ['prompt_tokens' => 5, 'completion_tokens' => 5],
        ], 200),
    ]);

    Config::set('carina.rate_limits', [
        'tenant_hourly' => 500,
        'tenant_daily' => 5000,
        'user_hourly' => 500,
        'user_daily' => 5000,
    ]);

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Tok Inv '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@tok-inv.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $conv = CarinaConversation::query()->create([
        'tenant_id' => $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Warm cache',
    ]);

    CarinaMessage::query()->create([
        'carina_conversation_id' => $conv->id,
        'role' => 'assistant',
        'content' => 'old',
        'input_tokens' => 2,
        'output_tokens' => 2,
    ]);

    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $tid = $tenant->getTenantKey();

    tenancy()->initialize($tenant);
    $before = app(TokenTrackingService::class)->getTenantTokenUsage($tid, 'monthly');
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/api/carina/chat', [
        'message' => 'Next',
    ])->assertOk();

    tenancy()->initialize($tenant);
    $after = app(TokenTrackingService::class)->getTenantTokenUsage($tid, 'monthly');
    tenancy()->end();

    expect($after['total_tokens'])->toBeGreaterThan($before['total_tokens']);
});
