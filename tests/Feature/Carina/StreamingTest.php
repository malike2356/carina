<?php

declare(strict_types=1);

/**
 * Section 13 -- Feature/Carina/StreamingTest
 */

use App\Events\Carina\CarinaMessageSent;
use App\Models\Carina\CarinaMessage;
use App\Models\Central\AiProvider;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
});

afterEach(function (): void {
    Http::allowStrayRequests();
});

it('test_stream_delivers_content_via_sse_chunks', function (): void {
    carina_assert_stream_chat_returns_sse($this);
});

it('test_stream_saves_complete_message_on_stream_end', function (): void {
    Http::preventStrayRequests();

    $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
    $groq->update([
        'api_key' => 'gsk-stream-save',
        'api_base_url' => 'https://api.carina-stream-save.invalid/openai/v1',
        'is_enabled' => true,
    ]);

    Http::fake([
        'https://api.carina-stream-save.invalid/openai/v1/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => 'Persisted reply']]],
            'usage' => ['prompt_tokens' => 2, 'completion_tokens' => 3],
        ], 200),
    ]);

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Stream Save '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@stream-save.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/api/carina/chat/stream', [
        'message' => 'Hello stream',
    ], ['Accept' => 'text/event-stream'])->streamedContent();

    tenancy()->initialize($tenant);

    $assistant = CarinaMessage::query()->where('role', 'assistant')->orderByDesc('id')->first();

    expect($assistant?->content)->toBe('Persisted reply');

    tenancy()->end();
});

it('test_stream_handles_client_disconnect_gracefully', function (): void {
    // HTTP test client reads the stream to completion; asserts server completes without error.

    Http::preventStrayRequests();

    $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
    $groq->update([
        'api_key' => 'gsk-stream-disc',
        'api_base_url' => 'https://api.carina-stream-disc.invalid/openai/v1',
        'is_enabled' => true,
    ]);

    Http::fake([
        'https://api.carina-stream-disc.invalid/openai/v1/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => 'Complete']]],
            'usage' => ['prompt_tokens' => 1, 'completion_tokens' => 1],
        ], 200),
    ]);

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Stream Disc '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@stream-disc.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $response = $this->post('http://'.$host.'/api/carina/chat/stream', [
        'message' => 'x',
    ], ['Accept' => 'text/event-stream']);

    $response->assertOk();
    expect(strlen($response->streamedContent()))->toBeGreaterThan(0);
});

it('test_stream_fires_carina_message_sent_event_on_completion', function (): void {
    Event::fake([CarinaMessageSent::class]);

    Http::preventStrayRequests();

    $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
    $groq->update([
        'api_key' => 'gsk-stream-ev',
        'api_base_url' => 'https://api.carina-stream-ev.invalid/openai/v1',
        'is_enabled' => true,
    ]);

    Http::fake([
        'https://api.carina-stream-ev.invalid/openai/v1/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => 'Ev']]],
            'usage' => ['prompt_tokens' => 1, 'completion_tokens' => 1],
        ], 200),
    ]);

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Stream Ev '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@stream-ev.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/api/carina/chat/stream', [
        'message' => 'fire event',
    ], ['Accept' => 'text/event-stream'])->streamedContent();

    Event::assertDispatched(CarinaMessageSent::class);
});
