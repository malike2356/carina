<?php

declare(strict_types=1);

use App\Models\Central\AiProvider;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformSetting;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
});

afterEach(function (): void {
    Http::allowStrayRequests();
});

it('feeds live PropertyData into the Carina chat request so the model can use it', function (): void {
    Http::preventStrayRequests();

    Config::set('ai.tavily.enabled', false);
    Config::set('ai.tavily.api_key', '');

    PlatformSetting::query()->updateOrCreate(
        ['key' => 'propertydata_platform_api_key'],
        [
            'group' => 'ai',
            'value' => 'pd-carina-chat-test-key',
            'type' => 'string',
            'label' => 'Test',
            'description' => null,
            'is_encrypted' => false,
            'is_public' => false,
        ]
    );

    PlatformSetting::query()->updateOrCreate(
        ['key' => 'carina_tavily_enabled'],
        [
            'group' => 'ai',
            'value' => '0',
            'type' => 'boolean',
            'label' => 'Tavily off for test',
            'description' => null,
            'is_encrypted' => false,
            'is_public' => false,
        ]
    );

    Cache::flush();

    $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
    $groq->update([
        'api_key' => 'gsk-carina-propertydata-test',
        'api_base_url' => 'https://api.carina-propertydata.invalid/openai/v1',
        'is_enabled' => true,
    ]);

    Http::fake([
        'https://api.propertydata.co.uk/yields*' => Http::response(['status' => 'success', 'data' => ['long_let' => ['gross_yield' => '6.25%']]], 200),
        'https://api.propertydata.co.uk/sold-prices*' => Http::response(['status' => 'success', 'data' => [['price' => 245000, 'date' => '2024-06-01']]], 200),
        'https://api.propertydata.co.uk/rents*' => Http::response(['status' => 'success', 'data' => ['long_let' => ['average' => 254]]], 200),
        'https://api.propertydata.co.uk/valuation-sale*' => Http::response(['status' => 'success', 'data' => ['estimate' => 240000]], 200),
        'https://api.carina-propertydata.invalid/openai/v1/chat/completions' => function (Request $request) {
            $body = $request->json();
            $messages = is_array($body) ? ($body['messages'] ?? []) : [];
            $system = '';
            foreach ($messages as $m) {
                if (($m['role'] ?? '') === 'system') {
                    $system = is_string($m['content'] ?? null) ? (string) $m['content'] : (string) json_encode($m['content']);

                    break;
                }
            }
            expect($system)->toContain('PropertyData')
                ->and($system)->toContain('average_yields')
                ->and($system)->toContain('6.25');

            return Http::response([
                'choices' => [['message' => ['content' => 'From the feed: gross yield around 6.25% for B1 1AA; use figures as indicative only.']]],
                'usage' => ['prompt_tokens' => 40, 'completion_tokens' => 20],
            ], 200);
        },
    ]);

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Carina PD Chat '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@carina-propertydata-chat.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $message = 'What are typical buy to let gross yields and comparable sold prices around B1 1AA for underwriting this area?';

    $this->postJson('http://'.$host.'/api/carina/chat', [
        'message' => $message,
    ])->assertOk()
        ->assertJsonPath('message', 'From the feed: gross yield around 6.25% for B1 1AA; use figures as indicative only.');

    Http::assertSent(fn (Request $r): bool => str_contains($r->url(), 'api.carina-propertydata.invalid'));
});
