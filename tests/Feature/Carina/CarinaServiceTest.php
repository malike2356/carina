<?php

declare(strict_types=1);

/**
 * Section 13 -- Feature/Carina/CarinaServiceTest (Pest)
 */

use App\Models\Carina\CarinaMessage;
use App\Models\Central\AiProvider;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\TenantRole;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Factories\Tenant\UserFactory;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
});

afterEach(function (): void {
    Http::allowStrayRequests();
    Config::set('carina.rate_limits', [
        'tenant_hourly' => 500,
        'tenant_daily' => 5000,
        'user_hourly' => 100,
        'user_daily' => 1000,
    ]);
});

it('test_chat_returns_response_for_valid_tenant', function (): void {
    Http::preventStrayRequests();

    $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
    $groq->update([
        'api_key' => 'gsk-test-key',
        'api_base_url' => 'https://api.carina-test.invalid/openai/v1',
        'is_enabled' => true,
    ]);

    Http::fake([
        'https://api.carina-test.invalid/openai/v1/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => 'Hello from tests']]],
            'usage' => ['prompt_tokens' => 5, 'completion_tokens' => 7],
        ], 200),
    ]);

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Carina Chat '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@carina-chat.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/api/carina/chat', [
        'message' => 'Say hello',
    ])->assertOk()
        ->assertJsonPath('message', 'Hello from tests')
        ->assertJsonStructure(['message', 'conversation_id', 'tokens_used', 'incognito']);
});

it('test_chat_enforces_tenant_isolation_across_users', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Carina Iso '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@carina-iso.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);

    $owner = User::query()->firstOrFail();
    TenantRole::findOrCreate('staff', 'web');
    $other = UserFactory::new()->createOne([
        'email' => 'staff-'.uniqid().'@example.test',
        'password' => bcrypt('secret-secret-secret'),
    ]);
    $other->syncRoles(['staff']);

    $conv = CarinaConversation::query()->create([
        'tenant_id' => $tenant->getTenantKey(),
        'user_id' => $owner->id,
        'title' => 'Private owner thread',
    ]);

    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($other, 'web');

    $this->getJson('http://'.$host.'/api/carina/conversations/'.$conv->id)
        ->assertNotFound();

    Http::preventStrayRequests();
    $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
    $groq->update([
        'api_key' => 'gsk-iso-2',
        'api_base_url' => 'https://api.carina-iso.invalid/openai/v1',
        'is_enabled' => true,
    ]);
    Http::fake([
        'https://api.carina-iso.invalid/openai/v1/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => 'X']]],
            'usage' => ['prompt_tokens' => 1, 'completion_tokens' => 1],
        ], 200),
    ]);

    $this->postJson('http://'.$host.'/api/carina/chat', [
        'conversation_id' => $conv->id,
        'message' => 'Hi',
    ])->assertForbidden();
});

it('test_chat_throws_when_rate_limit_exceeded', function (): void {
    Http::preventStrayRequests();

    Config::set('carina.rate_limits', [
        'tenant_hourly' => 1,
        'tenant_daily' => 100,
        'user_hourly' => 100,
        'user_daily' => 100,
    ]);

    $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
    $groq->update([
        'api_key' => 'gsk-rl',
        'api_base_url' => 'https://api.carina-rl.invalid/openai/v1',
        'is_enabled' => true,
    ]);

    Http::fake([
        'https://api.carina-rl.invalid/openai/v1/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => 'Once']]],
            'usage' => ['prompt_tokens' => 1, 'completion_tokens' => 1],
        ], 200),
    ]);

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Carina RL '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@carina-rl.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/api/carina/chat', ['message' => 'First'])->assertOk();

    $second = $this->postJson('http://'.$host.'/api/carina/chat', ['message' => 'Second']);
    $second->assertStatus(429);
    expect((int) $second->json('retry_after'))->toBeGreaterThan(0);
    expect($second->headers->get('Retry-After'))->not->toBeEmpty();
});

it('test_get_conversation_throws_404_for_wrong_tenant', function (): void {
    $svc = app(TenantCreationService::class);
    $tenantA = $svc->createTenant([
        'company_name' => 'TA '.uniqid(),
        'owner_name' => 'O',
        'owner_email' => 'a-'.uniqid().'@iso.test',
        'plan' => 'starter',
    ]);
    $tenantB = $svc->createTenant([
        'company_name' => 'TB '.uniqid(),
        'owner_name' => 'O',
        'owner_email' => 'b-'.uniqid().'@iso.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenantB);
    $userB = User::query()->firstOrFail();
    $convB = CarinaConversation::query()->create([
        'tenant_id' => $tenantB->getTenantKey(),
        'user_id' => $userB->id,
        'title' => 'B thread',
    ]);
    $targetId = $convB->id;
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    tenancy()->initialize($tenantA);
    CarinaConversation::query()->whereKey($targetId)->delete();
    $userA = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $hostA = $tenantA->domains->first()->domain.'.propreneur.test';

    $this->actingAs($userA, 'web');

    $this->getJson('http://'.$hostA.'/api/carina/conversations/'.$targetId)
        ->assertNotFound();
});

it('test_save_message_creates_record_with_all_fields', function (): void {
    Http::preventStrayRequests();

    $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
    $groq->update([
        'api_key' => 'gsk-fields',
        'api_base_url' => 'https://api.carina-fields.invalid/openai/v1',
        'is_enabled' => true,
    ]);

    Http::fake([
        'https://api.carina-fields.invalid/openai/v1/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => 'Assistant body']]],
            'usage' => ['prompt_tokens' => 11, 'completion_tokens' => 22],
        ], 200),
    ]);

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Carina Fields '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@fields.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    Config::set('carina.rate_limits', [
        'tenant_hourly' => 500,
        'tenant_daily' => 5000,
        'user_hourly' => 500,
        'user_daily' => 5000,
    ]);

    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/api/carina/chat', [
        'message' => 'Hello fields',
    ])->assertOk();

    tenancy()->initialize($tenant);

    $assistant = CarinaMessage::query()->where('role', 'assistant')->orderByDesc('id')->first();

    expect($assistant)->not->toBeNull()
        ->and($assistant->content)->toBe('Assistant body')
        ->and((int) $assistant->input_tokens)->toBe(11)
        ->and((int) $assistant->output_tokens)->toBe(22)
        ->and($assistant->provider_used)->not->toBeNull()
        ->and($assistant->model_used)->not->toBeNull();

    tenancy()->end();
});

it('test_get_history_returns_ordered_messages_asc', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Hist '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hist.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $conv = CarinaConversation::query()->create([
        'tenant_id' => $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Ordered',
    ]);

    CarinaMessage::query()->create([
        'carina_conversation_id' => $conv->id,
        'role' => 'user',
        'content' => 'first',
        'input_tokens' => 0,
        'output_tokens' => 0,
    ]);
    CarinaMessage::query()->create([
        'carina_conversation_id' => $conv->id,
        'role' => 'assistant',
        'content' => 'second',
        'input_tokens' => 1,
        'output_tokens' => 1,
    ]);

    completeTenantWorkspaceOnboarding();
    $conversationId = $conv->id;
    tenancy()->end();

    $this->actingAs($user, 'web');

    $json = $this->getJson('http://'.$host.'/api/carina/conversations/'.$conversationId)
        ->assertOk()
        ->json('conversation.messages');

    expect($json)->toBeArray();
    expect($json)->toHaveCount(2);
    expect($json[0]['content'])->toBe('first');
    expect($json[1]['content'])->toBe('second');
});

it('test_get_history_respects_limit_parameter', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Lim '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@lim.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $conv = CarinaConversation::query()->create([
        'tenant_id' => $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Limited',
    ]);

    foreach (['m1', 'm2', 'm3'] as $txt) {
        CarinaMessage::query()->create([
            'carina_conversation_id' => $conv->id,
            'role' => 'user',
            'content' => $txt,
            'input_tokens' => 0,
            'output_tokens' => 0,
        ]);
    }

    completeTenantWorkspaceOnboarding();
    $conversationId = $conv->id;
    tenancy()->end();

    $this->actingAs($user, 'web');

    $msgs = $this->getJson('http://'.$host.'/api/carina/conversations/'.$conversationId.'?limit=2')
        ->assertOk()
        ->json('conversation.messages');

    expect($msgs)->toHaveCount(2)
        ->and($msgs[0]['content'])->toBe('m1')
        ->and($msgs[1]['content'])->toBe('m2');
});

it('test_stream_chat_returns_sse_response', function (): void {
    carina_assert_stream_chat_returns_sse($this);
});
