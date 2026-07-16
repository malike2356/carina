<?php

declare(strict_types=1);

use App\Services\Ai\AiRuntimeResolutionService;
use App\Services\Ai\Dto\AiRuntimeBundle;
use App\Services\Carina\CarinaSpeechTranscriptionService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

it('posts audio to openai whisper and returns text', function (): void {
    Config::set('ai.speech_transcription.provider_priority', ['openai']);
    Config::set('ai.speech_transcription.models.openai', 'whisper-1');

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
        'api.openai.com/*' => Http::response(['text' => 'Hello from whisper'], 200),
    ]);

    $file = UploadedFile::fake()->createWithContent('clip.webm', str_repeat('x', 2048));

    $svc = app(CarinaSpeechTranscriptionService::class);
    $out = $svc->transcribe($file, null);

    expect($out)->toBe('Hello from whisper');

    Http::assertSent(function ($request): bool {
        return str_contains($request->url(), 'api.openai.com')
            && str_contains($request->url(), 'audio/transcriptions');
    });
});

it('falls back to groq when openai fails', function (): void {
    Config::set('ai.speech_transcription.provider_priority', ['openai', 'groq']);

    $this->mock(AiRuntimeResolutionService::class, function ($mock): void {
        $mock->shouldReceive('resolve')->once()->andReturn(new AiRuntimeBundle(
            [
                'openai' => [
                    'api_key' => 'sk-bad',
                    'base_url' => 'https://api.openai.com/v1',
                    'model' => 'gpt-4o-mini',
                ],
                'groq' => [
                    'api_key' => 'gsk-good',
                    'base_url' => 'https://api.groq.com/openai/v1',
                    'model' => 'llama-3.3-70b-versatile',
                ],
            ],
            ['openai', 'groq']
        ));
    });

    Http::fake([
        'api.openai.com/*' => Http::response(['error' => 'nope'], 500),
        'api.groq.com/*' => Http::response(['text' => 'Groq ok'], 200),
    ]);

    $file = UploadedFile::fake()->createWithContent('clip.webm', str_repeat('y', 2048));

    $svc = app(CarinaSpeechTranscriptionService::class);
    $out = $svc->transcribe($file, null);

    expect($out)->toBe('Groq ok');
});
