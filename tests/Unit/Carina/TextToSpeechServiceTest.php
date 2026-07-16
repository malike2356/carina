<?php

declare(strict_types=1);

use App\Services\Ai\AiRuntimeResolutionService;
use App\Services\Ai\Dto\AiRuntimeBundle;
use App\Services\Ai\TextToSpeechService;
use App\Services\Carina\EdgeTtsService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    Config::set('services.tts.openai_model', 'tts-1');
    Config::set('services.tts.openai_voice', 'alloy');
});

it('falls back to OpenAI TTS when edge-tts is unavailable', function (): void {
    $this->mock(AiRuntimeResolutionService::class, function ($mock): void {
        $mock->shouldReceive('resolve')->andReturn(new AiRuntimeBundle(
            [
                'openai' => [
                    'api_key' => 'sk-test',
                    'base_url' => 'https://api.openai.com/v1',
                ],
            ],
            ['openai']
        ));
    });

    Http::fake([
        'api.openai.com/*' => Http::response('fake-mp3-bytes', 200),
    ]);

    app()->forgetInstance(TextToSpeechService::class);

    $path = app(TextToSpeechService::class)->generate('Hello fallback test.');

    expect($path)->not->toBe('')
        ->and(is_file($path))->toBeTrue()
        ->and(file_get_contents($path))->toBe('fake-mp3-bytes');

    @unlink($path);
});

it('EdgeTtsService lists five neural voices', function (): void {
    $voices = app(EdgeTtsService::class)->availableVoices();

    expect($voices)->toHaveCount(5)
        ->and($voices)->toHaveKey('en-GB-SoniaNeural');
});
