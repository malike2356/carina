<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\CarinaMessage;
use App\Models\Tenant\User;
use App\Services\Ai\TextToSpeechService;
use App\Services\Carina\CarinaAgentService;
use App\Services\Carina\CarinaVoiceSlashCommandService;
use App\Services\Carina\EdgeTtsService;
use App\Services\Tenancy\TenantCreationService;

/**
 * @return array{0: Tenant, 1: User}
 */
function voiceSlashTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Voice Slash '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@voice-slash.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $user];
}

it('synthesises text with /speak command', function (): void {
    [$tenant, $user] = voiceSlashTenant();
    tenancy()->initialize($tenant);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Speak thread',
    ]);

    $tts = Mockery::mock(TextToSpeechService::class);
    $tts->shouldReceive('generate')
        ->once()
        ->with('Hello from Carina.', 'en-GB-SoniaNeural')
        ->andReturn('/tmp/fake-tts.mp3');

    $result = (new CarinaVoiceSlashCommandService($tts, app(EdgeTtsService::class)))->tryHandle('/speak Hello from Carina.', $conversation, $user);

    expect($result)->not->toBeNull()
        ->and($result['audio_path'])->toBe('/tmp/fake-tts.mp3')
        ->and($result['reply'])->toBeNull();

    tenancy()->end();
});

it('/voice lists available voices', function (): void {
    [$tenant, $user] = voiceSlashTenant();
    tenancy()->initialize($tenant);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Voice list thread',
    ]);

    $result = app(CarinaVoiceSlashCommandService::class)->tryHandle('/voice', $conversation, $user);

    expect($result)->not->toBeNull()
        ->and($result['reply'])->toContain('Available TTS voices')
        ->and($result['reply'])->toContain('en-GB-SoniaNeural');

    tenancy()->end();
});

it('/voice <name> updates user tts_voice preference', function (): void {
    [$tenant, $user] = voiceSlashTenant();
    tenancy()->initialize($tenant);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Voice switch thread',
    ]);

    $result = app(CarinaVoiceSlashCommandService::class)->tryHandle('/voice en-GB-RyanNeural', $conversation, $user);
    $user->refresh();

    expect($result)->not->toBeNull()
        ->and($result['reply'])->toContain('Voice updated')
        ->and($user->tts_voice)->toBe('en-GB-RyanNeural');

    tenancy()->end();
});

it('/speak last synthesises the last assistant message', function (): void {
    [$tenant, $user] = voiceSlashTenant();
    tenancy()->initialize($tenant);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Speak last thread',
    ]);

    CarinaMessage::query()->create([
        'carina_conversation_id' => $conversation->id,
        'role' => 'assistant',
        'content' => 'Your portfolio is healthy today.',
    ]);

    $tts = Mockery::mock(TextToSpeechService::class);
    $tts->shouldReceive('generate')
        ->once()
        ->with('Your portfolio is healthy today.', 'en-GB-SoniaNeural')
        ->andReturn('/tmp/fake-last.mp3');

    $result = (new CarinaVoiceSlashCommandService($tts, app(EdgeTtsService::class)))->tryHandle('/speak last', $conversation, $user);

    expect($result)->not->toBeNull()
        ->and($result['audio_path'])->toBe('/tmp/fake-last.mp3');

    tenancy()->end();
});

it('agentChat returns audio_path for /speak via CarinaAgentService', function (): void {
    [$tenant, $user] = voiceSlashTenant();
    tenancy()->initialize($tenant);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Agent speak thread',
    ]);

    $tts = Mockery::mock(TextToSpeechService::class);
    $tts->shouldReceive('generate')
        ->once()
        ->with('Hello from agent.', 'en-GB-SoniaNeural')
        ->andReturn('/tmp/agent-speak.mp3');
    app()->instance(TextToSpeechService::class, $tts);
    app()->forgetInstance(CarinaVoiceSlashCommandService::class);
    app()->forgetInstance(CarinaAgentService::class);

    $result = app(CarinaAgentService::class)->agentChat(
        $conversation,
        '/speak Hello from agent.',
        $user,
    );

    expect($result['audio_path'] ?? null)->toBe('/tmp/agent-speak.mp3')
        ->and($result['reply'])->toBe('')
        ->and($result['steps_used'])->toBe(0);

    tenancy()->end();
});
