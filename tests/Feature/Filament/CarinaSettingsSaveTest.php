<?php

declare(strict_types=1);

use App\Filament\Pages\CarinaSettings;
use App\Models\Central\AiProvider;
use App\Models\Central\PlatformUser;
use App\Services\Carina\PlatformRateLimitConfig;
use Livewire\Livewire;

/**
 * @return array<string, mixed>
 */
function carinaSettingsFormPayload(array $overrides = []): array
{
    return array_merge([
        'default_provider' => 'deepseek',
        'default_chat_model' => 'deepseek-chat',
        'default_embedding_model' => 'text-embedding-3-small',
        'prompt_caching' => false,
        'tenant_hourly' => 99,
        'tenant_daily' => 888,
        'user_hourly' => 11,
        'user_daily' => 77,
        'chunk_size' => 1000,
        'chunk_overlap' => 200,
        'max_documents' => 200,
        'rag_file_types' => ['pdf', 'txt'],
        'incognito_ttl_hours' => 24,
        'incognito_allowed' => true,
    ], $overrides);
}

it('updates ai provider platform default when saving carina settings', function (): void {
    AiProvider::query()->update(['is_platform_default' => false]);

    $admin = PlatformUser::factory()->admin()->create();

    Livewire::actingAs($admin, 'platform')
        ->test(CarinaSettings::class)
        ->set('data', carinaSettingsFormPayload([
            'default_provider' => 'deepseek',
            'default_chat_model' => 'deepseek-reasoner',
        ]))
        ->call('save')
        ->assertNotified()
        ->assertSuccessful();

    $provider = AiProvider::query()->where('slug', 'deepseek')->first();

    expect($provider)->not->toBeNull()
        ->and($provider->is_platform_default)->toBeTrue()
        ->and($provider->default_model)->toBe('deepseek-reasoner')
        ->and(AiProvider::query()->where('is_platform_default', true)->count())->toBe(1);
});

it('returns saved rate limits from platform config after save flushes cache', function (): void {
    PlatformRateLimitConfig::flush();

    $admin = PlatformUser::factory()->admin()->create();

    Livewire::actingAs($admin, 'platform')
        ->test(CarinaSettings::class)
        ->set('data', carinaSettingsFormPayload([
            'tenant_hourly' => 42,
            'tenant_daily' => 4200,
            'user_hourly' => 7,
            'user_daily' => 70,
        ]))
        ->call('save')
        ->assertSuccessful();

    expect(PlatformRateLimitConfig::limits())->toMatchArray([
        'tenant_hourly' => 42,
        'tenant_daily' => 4200,
        'user_hourly' => 7,
        'user_daily' => 70,
    ]);
});

it('allows platform admin to save carina settings via livewire', function (): void {
    $admin = PlatformUser::factory()->admin()->create();

    expect($admin->canAccessFilamentPanel())->toBeTrue();

    Livewire::actingAs($admin, 'platform')
        ->test(CarinaSettings::class)
        ->set('data', carinaSettingsFormPayload())
        ->call('save')
        ->assertSuccessful()
        ->assertNotified();
});

it('redirects guests away from carina settings save', function (): void {
    $response = $this->get('/filament/carina-settings');

    $response->assertRedirect();
});
