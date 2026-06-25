<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\User;
use App\Services\Ai\AiRuntimeResolutionService;
use App\Services\Ai\Dto\AiRuntimeBundle;
use App\Services\Carina\CarinaModuleToolDispatcher;
use App\Services\Carina\CarinaSpeechTranscriptionService;
use App\Services\Carina\ToolHandlers\TranscriptionToolHandler;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    Config::set('ai.speech_transcription.provider_priority', ['openai']);
});

/**
 * @return array{0: Tenant, 1: User}
 */
function transcriptionTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Transcription '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@transcription.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $user];
}

it('calls CarinaSpeechTranscriptionService with downloaded file', function (): void {
    [$tenant, $user] = transcriptionTenant();
    tenancy()->initialize($tenant);

    $audioPath = storage_path('app/temp/transcribe_test_'.uniqid().'.ogg');
    @mkdir(dirname($audioPath), 0755, true);
    file_put_contents($audioPath, str_repeat('a', 1024));

    $this->mock(AiRuntimeResolutionService::class, function ($mock): void {
        $mock->shouldReceive('resolve')->andReturn(new AiRuntimeBundle(
            [
                'openai' => [
                    'api_key' => 'sk-test',
                    'base_url' => 'https://api.openai.com/v1',
                    'model' => 'whisper-1',
                ],
            ],
            ['openai']
        ));
    });

    Http::fake([
        'api.openai.com/*' => Http::response(['text' => 'Standing outside 14 Oak Street'], 200),
    ]);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Transcription thread',
    ]);

    $result = app(TranscriptionToolHandler::class)->handle(
        'transcribe_audio',
        ['file_url' => $audioPath],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['transcript'])->toBe('Standing outside 14 Oak Street');

    @unlink($audioPath);
    tenancy()->end();
});

it('returns error message when transcription fails', function (): void {
    [$tenant, $user] = transcriptionTenant();
    tenancy()->initialize($tenant);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Transcription fail thread',
    ]);

    $result = app(TranscriptionToolHandler::class)->handle(
        'transcribe_audio',
        ['file_url' => '/tmp/does-not-exist-'.uniqid().'.ogg'],
        $user,
        $conversation,
    );

    expect($result->success)->toBeFalse()
        ->and($result->summary)->toContain('file_url');

    tenancy()->end();
});

it('cleans up temp file after URL download transcription', function (): void {
    [$tenant, $user] = transcriptionTenant();
    tenancy()->initialize($tenant);

    $audioUrl = 'https://cdn.example.test/voice_note.ogg';

    $this->mock(AiRuntimeResolutionService::class, function ($mock): void {
        $mock->shouldReceive('resolve')->andReturn(new AiRuntimeBundle(
            [
                'openai' => [
                    'api_key' => 'sk-test',
                    'base_url' => 'https://api.openai.com/v1',
                    'model' => 'whisper-1',
                ],
            ],
            ['openai']
        ));
    });

    Http::fake([
        $audioUrl => Http::response(str_repeat('c', 512), 200),
        'api.openai.com/*' => Http::response(['text' => 'Downloaded voice note'], 200),
    ]);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'URL transcription thread',
    ]);

    $tempDir = storage_path('app/temp');
    $before = glob($tempDir.'/transcribe_*') ?: [];

    $result = app(TranscriptionToolHandler::class)->handle(
        'transcribe_audio',
        ['file_url' => $audioUrl],
        $user,
        $conversation,
    );

    $after = glob($tempDir.'/transcribe_*') ?: [];

    expect($result->success)->toBeTrue()
        ->and($result->data['transcript'])->toBe('Downloaded voice note')
        ->and($result->data['file'])->toBe('voice_note.ogg')
        ->and(count($after))->toBe(count($before));

    tenancy()->end();
});

it('dispatches transcribe_audio via CarinaModuleToolDispatcher', function (): void {
    [$tenant, $user] = transcriptionTenant();
    tenancy()->initialize($tenant);

    $audioPath = storage_path('app/temp/dispatch_test_'.uniqid().'.ogg');
    @mkdir(dirname($audioPath), 0755, true);
    file_put_contents($audioPath, str_repeat('d', 1024));

    $this->mock(AiRuntimeResolutionService::class, function ($mock): void {
        $mock->shouldReceive('resolve')->andReturn(new AiRuntimeBundle(
            [
                'openai' => [
                    'api_key' => 'sk-test',
                    'base_url' => 'https://api.openai.com/v1',
                    'model' => 'whisper-1',
                ],
            ],
            ['openai']
        ));
    });
    app()->forgetInstance(CarinaModuleToolDispatcher::class);

    Http::fake([
        'api.openai.com/*' => Http::response(['text' => 'Dispatcher ok'], 200),
    ]);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Dispatcher thread',
    ]);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'transcribe_audio',
        ['file_url' => $audioPath],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['transcript'])->toBe('Dispatcher ok');

    @unlink($audioPath);
    tenancy()->end();
});

it('transcribePath reads local files for telegram voice flow', function (): void {
    $path = storage_path('app/temp/voice_test_'.uniqid().'.ogg');
    @mkdir(dirname($path), 0755, true);
    file_put_contents($path, str_repeat('b', 2048));

    $this->mock(AiRuntimeResolutionService::class, function ($mock): void {
        $mock->shouldReceive('resolve')->andReturn(new AiRuntimeBundle(
            [
                'openai' => [
                    'api_key' => 'sk-test',
                    'base_url' => 'https://api.openai.com/v1',
                    'model' => 'whisper-1',
                ],
            ],
            ['openai']
        ));
    });

    Http::fake([
        'api.openai.com/*' => Http::response(['text' => 'Telegram voice ok'], 200),
    ]);

    $text = app(CarinaSpeechTranscriptionService::class)->transcribePath($path, null);
    expect($text)->toBe('Telegram voice ok');

    @unlink($path);
});

it('rejects unsupported audio extension before calling Whisper', function (): void {
    [$tenant, $user] = transcriptionTenant();
    tenancy()->initialize($tenant);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Format check',
    ]);

    $badPath = storage_path('app/temp/bad_format_'.uniqid().'.exe');
    file_put_contents($badPath, str_repeat('x', 512));

    $result = app(TranscriptionToolHandler::class)->handle(
        'transcribe_audio',
        ['file_url' => $badPath],
        $user,
        $conversation,
    );

    expect($result->success)->toBeFalse()
        ->and($result->summary)->toContain('Unsupported audio format');

    @unlink($badPath);
    tenancy()->end();
});

it('transcribes fixture ogg sample via local path', function (): void {
    [$tenant, $user] = transcriptionTenant();
    tenancy()->initialize($tenant);

    $fixture = base_path('tests/fixtures/carina/sample-voice-note.ogg');
    expect(is_readable($fixture))->toBeTrue();

    $this->mock(AiRuntimeResolutionService::class, function ($mock): void {
        $mock->shouldReceive('resolve')->andReturn(new AiRuntimeBundle(
            [
                'openai' => [
                    'api_key' => 'sk-test',
                    'base_url' => 'https://api.openai.com/v1',
                    'model' => 'whisper-1',
                ],
            ],
            ['openai']
        ));
    });

    Http::fake([
        'api.openai.com/*' => Http::response(['text' => 'Viewing notes for 14 Oak Street'], 200),
    ]);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Fixture transcription',
    ]);

    $result = app(TranscriptionToolHandler::class)->handle(
        'transcribe_audio',
        ['file_url' => $fixture],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['transcript'])->toBe('Viewing notes for 14 Oak Street')
        ->and($result->data['file'])->toBe('sample-voice-note.ogg');

    tenancy()->end();
});
