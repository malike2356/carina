<?php

declare(strict_types=1);

/**
 * Section 13 -- Feature/Carina/AiRouterTest
 */

use App\Models\Central\AiProvider;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformSetting;
use App\Models\Central\TenantAiSetting;
use App\Services\Ai\AiRuntimeResolutionService;
use App\Services\Ai\Dto\AiRuntimeBundle;
use App\Services\Carina\AiRouterService;
use Illuminate\Support\Facades\Http;

afterEach(function (): void {
    Http::allowStrayRequests();
});

function aiRouterWithBundle(AiRuntimeBundle $bundle): AiRouterService
{
    $runtime = Mockery::mock(AiRuntimeResolutionService::class);
    $runtime->shouldReceive('resolve')->with('tenant-test')->andReturn($bundle);

    return new AiRouterService($runtime);
}

it('test_selects_provider_from_tenant_byok_config', function (): void {
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'byok_ai')->update(['enabled' => true]);

    PlatformSetting::query()->updateOrCreate(
        ['key' => 'byok_enabled'],
        ['group' => 'ai', 'value' => '1', 'type' => 'boolean', 'label' => 'BYOK', 'description' => null, 'is_encrypted' => false, 'is_public' => false],
    );

    $tenant = createCentralTenant();

    $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
    $groq->update(['api_key' => null, 'api_base_url' => null]);

    TenantAiSetting::query()->create([
        'tenant_id' => $tenant->id,
        'default_ai_provider_id' => $groq->id,
        'provider_overrides' => [
            'groq' => [
                'api_key' => 'gsk-byok-tenant-only',
                'base_url' => 'https://api.byok-tenant.invalid/openai/v1',
                'model' => 'custom-chat',
            ],
        ],
    ]);

    $bundle = app(AiRuntimeResolutionService::class)->resolve((string) $tenant->id);

    expect($bundle->providers['groq']['api_key'] ?? null)->toBe('gsk-byok-tenant-only')
        ->and($bundle->providers['groq']['model'] ?? null)->toBe('custom-chat');

    $router = app(AiRouterService::class);
    $picked = $router->selectEmbeddingProvider((string) $tenant->id);

    expect($picked['provider'])->toBe('groq')
        ->and($picked['api_key'])->toBe('gsk-byok-tenant-only');

    $chatPick = $router->selectProvider((string) $tenant->id);
    expect($chatPick['provider'])->toBe('groq')
        ->and($chatPick['api_key'])->toBe('gsk-byok-tenant-only');
});

it('test_falls_back_to_platform_default_when_no_byok', function (): void {
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'byok_ai')->update(['enabled' => false]);

    $tenant = createCentralTenant();

    $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
    $groq->update([
        'api_key' => 'gsk-platform-registry',
        'api_base_url' => 'https://api.platform-groq.invalid/openai/v1',
        'is_enabled' => true,
    ]);

    $bundle = app(AiRuntimeResolutionService::class)->resolve((string) $tenant->id);

    expect($bundle->providers['groq']['api_key'] ?? null)->toBe('gsk-platform-registry');
});

it('test_returns_correct_model_for_chat_use_case', function (): void {
    $bundle = new AiRuntimeBundle([
        'openai' => [
            'api_key' => 'k',
            'base_url' => 'https://api.openai.example/v1',
            'model' => 'gpt-4o-mini',
            'embedding_model' => 'text-embedding-ada-002',
            'image_model' => 'dall-e-3',
        ],
    ], ['openai']);

    $router = aiRouterWithBundle($bundle);
    $cfg = $router->selectProvider('tenant-test')['cfg'];

    expect($router->getModel('openai', 'chat', $cfg))->toBe('gpt-4o-mini');
});

it('select_embedding_provider_skips_deepseek_and_prefers_openai_in_embedding_priority_order', function (): void {
    $bundle = new AiRuntimeBundle([
        'deepseek' => [
            'api_key' => 'sk-deepseek',
            'base_url' => 'https://api.deepseek.com/v1',
            'model' => 'deepseek-chat',
        ],
        'openai' => [
            'api_key' => 'sk-openai',
            'base_url' => 'https://api.openai.com/v1',
            'model' => 'gpt-4o-mini',
        ],
    ], ['deepseek', 'openai']);

    $router = aiRouterWithBundle($bundle);
    $picked = $router->selectEmbeddingProvider('tenant-test');

    expect($picked['provider'])->toBe('openai')
        ->and($picked['api_key'])->toBe('sk-openai');
});

it('test_returns_correct_model_for_embedding_use_case', function (): void {
    $bundle = new AiRuntimeBundle([
        'openai' => [
            'api_key' => 'k',
            'base_url' => 'https://api.openai.example/v1',
            'model' => 'gpt-4o-mini',
            'embedding_model' => 'text-embedding-3-small',
        ],
    ], ['openai']);

    $router = aiRouterWithBundle($bundle);
    $cfg = $router->selectProvider('tenant-test')['cfg'];

    expect($router->getModel('openai', 'embedding', $cfg))->toBe('text-embedding-3-small');
});

it('test_returns_correct_model_for_image_use_case', function (): void {
    $bundle = new AiRuntimeBundle([
        'openai' => [
            'api_key' => 'k',
            'base_url' => 'https://api.openai.example/v1',
            'model' => 'gpt-4o-mini',
            'image_model' => 'dall-e-3',
        ],
    ], ['openai']);

    $router = aiRouterWithBundle($bundle);
    $cfg = $router->selectProvider('tenant-test')['cfg'];

    expect($router->getModel('openai', 'image', $cfg))->toBe('dall-e-3');
});

it('test_retries_on_429_up_to_three_times', function (): void {
    Http::preventStrayRequests();

    $bundle = new AiRuntimeBundle([
        'groq' => [
            'api_key' => 'gsk-test',
            'base_url' => 'https://api.groq.example/openai/v1',
            'model' => 'llama-3',
        ],
    ], ['groq']);

    Http::fake([
        'https://api.groq.example/openai/v1/chat/completions' => Http::sequence()
            ->push(['error' => 'rate'], 429)
            ->push([
                'choices' => [['message' => ['content' => 'Final reply']]],
                'usage' => ['prompt_tokens' => 3, 'completion_tokens' => 4],
            ], 200),
    ]);

    $router = aiRouterWithBundle($bundle);
    $result = $router->routeRequest([
        'messages' => [['role' => 'user', 'content' => 'Hi']],
        'system' => 'You are Carina.',
    ], 'tenant-test', 'chat');

    expect($result['content'])->toBe('Final reply');
});

it('test_retries_on_500_up_to_three_times', function (): void {
    Http::preventStrayRequests();

    $bundle = new AiRuntimeBundle([
        'groq' => [
            'api_key' => 'gsk-test',
            'base_url' => 'https://api.groq.example/openai/v1',
            'model' => 'llama-3',
        ],
    ], ['groq']);

    Http::fake([
        'https://api.groq.example/openai/v1/chat/completions' => Http::sequence()
            ->push(['error' => 'boom'], 500)
            ->push([
                'choices' => [['message' => ['content' => 'Recovered']]],
                'usage' => ['prompt_tokens' => 1, 'completion_tokens' => 1],
            ], 200),
    ]);

    $router = aiRouterWithBundle($bundle);
    $result = $router->routeRequest([
        'messages' => [['role' => 'user', 'content' => 'Hi']],
        'system' => 'Sys',
    ], 'tenant-test', 'chat');

    expect($result['content'])->toBe('Recovered');
});

it('test_throws_after_max_retries_exceeded', function (): void {
    Http::preventStrayRequests();

    $bundle = new AiRuntimeBundle([
        'groq' => [
            'api_key' => 'gsk-test',
            'base_url' => 'https://api.groq.example/openai/v1',
            'model' => 'llama-3',
        ],
    ], ['groq']);

    Http::fake([
        'https://api.groq.example/openai/v1/chat/completions' => Http::response(['error' => 'rate'], 429),
    ]);

    $router = aiRouterWithBundle($bundle);

    expect(fn () => $router->routeRequest([
        'messages' => [['role' => 'user', 'content' => 'Hi']],
        'system' => 'Sys',
    ], 'tenant-test', 'chat'))
        ->toThrow(RuntimeException::class, 'failed after retries');
});
