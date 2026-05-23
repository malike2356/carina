<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Ai\AiRuntimeResolutionService;
use App\Services\Ai\Dto\AiRuntimeBundle;
use App\Services\Billing\Contracts\FeatureGatingServiceInterface;
use App\Services\Carina\CarinaService;
use App\Services\Carina\Contracts\CarinaAgentChatRunner;
use App\Services\Tenancy\TenantCreationService;
use Tests\Support\Stubs\StubCarinaAgentChatRunner;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('starts a conversation and sends a message via the mobile Carina API', function (): void {
    $this->mock(FeatureGatingServiceInterface::class, function ($mock): void {
        $mock->shouldReceive('hasFeature')->andReturnUsing(
            fn (string $tenantId, string $feature): bool => $feature !== BillingModule::CarinaAgent->value
        );
    });

    $this->mock(CarinaService::class, function ($mock): void {
        $mock->shouldReceive('chat')->once()->andReturn('Here is some property investment advice.');
    });

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile Carina '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-carina.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-carina')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $token = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-carina',
        'device_uuid' => '33333333-cccc-cccc-cccc-333333333333',
    ])->assertOk()->json('access_token');

    $headers = ['Authorization' => 'Bearer '.$token];

    $conv = $this->postJson('http://'.$host.'/api/v1/mobile/carina/conversations', [
        'title' => 'Test Conversation',
    ], $headers);
    $conv->assertCreated()
        ->assertJsonPath('data.title', 'Test Conversation')
        ->assertJsonPath('data.message_count', 0);

    $convId = (int) $conv->json('data.id');

    $this->postJson('http://'.$host.'/api/v1/mobile/carina/conversations/'.$convId.'/messages', [
        'content' => 'What is a good BTL yield?',
    ], $headers)
        ->assertOk()
        ->assertJsonPath('data.reply', 'Here is some property investment advice.')
        ->assertJsonPath('data.agent_mode', false)
        ->assertJsonPath('data.requires_confirmation', false)
        ->assertJsonStructure(['data' => ['reply', 'conversation_id', 'tokens_used', 'agent_mode', 'actions']]);
});

it('returns Carina capabilities for the signed-in mobile user', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile Carina Cap '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-carina-cap.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-carina-cap')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $token = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-carina-cap',
        'device_uuid' => '77777777-7777-7777-7777-777777777777',
    ])->assertOk()->json('access_token');

    $this->getJson('http://'.$host.'/api/v1/mobile/carina/capabilities', [
        'Authorization' => 'Bearer '.$token,
    ])
        ->assertOk()
        ->assertJsonPath('data.agent_available', true)
        ->assertJsonStructure(['data' => ['agent_available', 'agent_enabled_for_user', 'eligibility_summary']]);
});

it('uses agent mode on mobile when the user is eligible', function (): void {
    $this->mock(FeatureGatingServiceInterface::class, function ($mock): void {
        $mock->shouldReceive('hasFeature')->andReturn(true);
    });

    $this->app->instance(CarinaAgentChatRunner::class, new StubCarinaAgentChatRunner([
        'reply' => 'I ran the BTL calculator for you.',
        'actions' => [
            ['tool' => 'run_calculator', 'args' => [], 'result' => 'Yield 6.2%', 'success' => true],
        ],
        'requires_confirmation' => false,
        'pending_action' => null,
        'steps_used' => 1,
    ]));

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile Carina Agent '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-carina-agent.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-carina-agent')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $token = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-carina-agent',
        'device_uuid' => '88888888-8888-8888-8888-888888888888',
    ])->assertOk()->json('access_token');

    $headers = ['Authorization' => 'Bearer '.$token];

    $convId = (int) $this->postJson('http://'.$host.'/api/v1/mobile/carina/conversations', [], $headers)
        ->assertCreated()->json('data.id');

    $this->postJson('http://'.$host.'/api/v1/mobile/carina/conversations/'.$convId.'/messages', [
        'content' => 'Run a BTL yield check',
    ], $headers)
        ->assertOk()
        ->assertJsonPath('data.agent_mode', true)
        ->assertJsonPath('data.reply', 'I ran the BTL calculator for you.')
        ->assertJsonCount(1, 'data.actions');
});

it('lists conversations with pagination', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile Carina List '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-carina-list.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-carina-list')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $token = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-carina-list',
        'device_uuid' => '44444444-dddd-dddd-dddd-444444444444',
    ])->assertOk()->json('access_token');

    $headers = ['Authorization' => 'Bearer '.$token];

    $this->getJson('http://'.$host.'/api/v1/mobile/carina/conversations', $headers)
        ->assertOk()
        ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);
});

it('shows and deletes a conversation', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile Carina Delete '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-carina-del.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-carina-del')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $token = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-carina-del',
        'device_uuid' => '55555555-eeee-eeee-eeee-555555555555',
    ])->assertOk()->json('access_token');

    $headers = ['Authorization' => 'Bearer '.$token];

    $convId = (int) $this->postJson('http://'.$host.'/api/v1/mobile/carina/conversations', [], $headers)
        ->assertCreated()->json('data.id');

    $this->getJson('http://'.$host.'/api/v1/mobile/carina/conversations/'.$convId, $headers)
        ->assertOk()
        ->assertJsonStructure(['data' => ['id', 'title', 'messages']]);

    $this->deleteJson('http://'.$host.'/api/v1/mobile/carina/conversations/'.$convId, [], $headers)
        ->assertNoContent();
});

it('transcribes voice audio via the mobile Carina speech endpoint', function (): void {
    Config::set('ai.speech_transcription.provider_priority', ['openai']);
    $this->mock(AiRuntimeResolutionService::class, function ($mock): void {
        $mock->shouldReceive('resolve')->once()->andReturn(new AiRuntimeBundle(
            [
                'openai' => [
                    'api_key' => 'sk-test-key',
                    'base_url' => 'https://api.openai.com/v1',
                    'model' => 'gpt-4o-mini',
                ],
            ],
            ['openai']
        ));
    });
    Http::fake([
        'api.openai.com/*' => Http::response(['text' => 'What is a good BTL yield?'], 200),
    ]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile Carina Voice '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-carina-voice.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-carina-voice')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $token = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-carina-voice',
        'device_uuid' => '66666666-6666-6666-6666-666666666666',
    ])->assertOk()->json('access_token');

    $headers = ['Authorization' => 'Bearer '.$token];

    $this->post('http://'.$host.'/api/v1/mobile/carina/speech-transcribe', [
        'audio' => UploadedFile::fake()->createWithContent('carina-voice.m4a', str_repeat('x', 2048)),
    ], $headers)
        ->assertOk()
        ->assertJsonPath('text', 'What is a good BTL yield?');
});
